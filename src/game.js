import { CONFIG } from "./config.js";
import { LEVEL } from "./level.js";
import { Art } from "./art.js";
import { renderWorld, renderParty } from "./scene.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const screen = (value) => value * CONFIG.world.screenWidth;

const STAGE_ENDS = CONFIG.stageData.map((stage) => stage.endScreen * CONFIG.world.screenWidth);
export class BirthdayGame {
  constructor(canvas, { onHud = () => {}, onMessage = () => {}, audio } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.viewWidth = canvas.width || CONFIG.canvas.width;
    this.onHud = onHud;
    this.onMessage = onMessage;
    this.audio = audio;
    this.art = new Art();
    this.menuTime = 0;
    this.enemyProjectiles = [];
    this.emitterCycles = new Map();
    this.status = "cover";
    this.pauseReason = "";
    this.worldTime = 0;
    this.cameraX = 0;
    this.lives = 3;
    this.collectedDrops = new Set();
    this.collectedGifts = new Set();
    this.claimedLifeThresholds = new Set();
    this.currentCheckpoint = { id: "cp-0", x: 80, y: CONFIG.world.floorY - 42 };
    this.checkpointIds = new Set();
    this.hitTargets = new Map();
    this.stunnedEnemies = new Map();
    this.projectiles = [];
    this.stageIndex = 0;
    this.stageNoticeUntil = 0;
    this.tutorialsSeen = new Set();
    this.jetsSinceHit = 0;
    this.jetCooldown = 0;
    this.shieldRemaining = 0;
    this.shieldRecharge = 0;
    this.invulnerable = 0;
    this.recoveryRemaining = 0;
    this.partyTime = 0;
    this.partyPhase = "";
    this.partyTransitioned = false;
    this.finalFadeStarted = false;
    this.lastMessage = "";
    this.inputs = new Set();
    this.edges = new Set();
    this.platforms = LEVEL.platforms.map((platform, index) => ({ ...platform, index, previousX: platform.x, previousY: platform.y }));
    this.enemies = LEVEL.enemies.map((enemy) => ({ ...enemy, baseX: enemy.x, baseY: enemy.y, yBase: enemy.y, stun: 0, cycleTime: 0 }));
    this.hazardSafeUntil = 0;
    this.player = this.createPlayer(80, CONFIG.world.floorY - 42);
    this.updateHud();
  }

  resizeViewport(logicalWidth) {
    const width = Math.max(480, Math.round(logicalWidth));
    if (width === this.viewWidth && this.canvas.height === CONFIG.canvas.height) return;
    this.viewWidth = width;
    this.canvas.width = width;
    this.canvas.height = CONFIG.canvas.height;
    this.cameraX = clamp(this.cameraX, 0, LEVEL.width - this.viewWidth);
  }

  createPlayer(x, y) {
    return {
      x, y, w: 32, h: 42, vx: 0, vy: 0, facing: 1,
      onGround: false, groundPlatform: null, coyote: 0, jumpBuffer: 0,
      inWater: false, flightRemaining: 0, flightActive: false,
      safeX: x, safeY: y,
    };
  }

  start() {
    if (this.status !== "cover") return false;
    this.status = "running";
    this.player.vy = -130;
    this.setMessage("¡Vamooos!", 1.2);
    this.tutorialsSeen.add("intro");
    this.updateHud();
    return true;
  }

  setMessage(message, seconds = 2.4) {
    this.lastMessage = message;
    this.stageNoticeUntil = this.worldTime + seconds;
    this.onMessage(message);
  }

  setInput(name, down) {
    if (down && !this.inputs.has(name)) this.edges.add(name);
    if (down) this.inputs.add(name);
    else this.inputs.delete(name);
  }

  pause(reason = "manual") {
    if (this.status !== "running" && this.status !== "party" && this.status !== "finished") return false;
    this.prePauseStatus = this.status;
    this.status = "paused";
    this.pauseReason = reason;
    this.inputs.clear(); this.edges.clear();
    this.audio?.pause();
    this.updateHud();
    return true;
  }

  resume() {
    if (this.status !== "paused") return false;
    this.status = this.prePauseStatus || "running";
    this.prePauseStatus = null;
    this.pauseReason = "";
    this.audio?.resume();
    this.updateHud();
    return true;
  }

  step(dt) {
    if (this.status === "cover" || this.status === "paused") return;
    const step = Math.min(dt, 1 / 30);
    this.audio?.update(step);
    if (this.status === "recovery") {
      this.recoveryRemaining -= step;
      if (this.recoveryRemaining <= 0) {
        this.status = "running";
        this.updateHud();
      }
      this.edges.clear();
      return;
    }
    if (this.status === "party" || this.status === "finished") {
      this.updateParty(step);
      return;
    }

    this.worldTime += step;
    this.updateTimers(step);
    this.updatePlatforms();
    this.updateEnemies(step);
    this.updateEmitters(step);
    this.updateProjectiles(step);
    this.updatePlayer(step);
    this.collectObjects();
    this.checkHazards();
    this.checkEnemyContacts();
    this.checkGates();
    this.checkCheckpoints();
    this.updateStage();
    this.checkFinish();
    this.updateTutorial();
    this.edges.clear();
    this.updateHud();
  }

  updateTimers(dt) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.jetCooldown = Math.max(0, this.jetCooldown - dt);
    if (this.shieldRemaining > 0) {
      this.shieldRemaining = Math.max(0, this.shieldRemaining - dt);
      if (this.shieldRemaining === 0) this.shieldRecharge = CONFIG.physics.shieldRecharge;
    } else if (this.shieldRecharge > 0) {
      this.shieldRecharge = Math.max(0, this.shieldRecharge - dt);
    }
    for (const [id, remaining] of this.stunnedEnemies) {
      if (remaining <= dt) this.stunnedEnemies.delete(id);
      else this.stunnedEnemies.set(id, remaining - dt);
    }
  }

  updatePlatforms() {
    for (const platform of this.platforms) {
      platform.previousX = platform.x;
      platform.previousY = platform.y;
      if (platform.kind !== "moving") continue;
      const cycle = this.worldTime * platform.speed / Math.max(platform.distance, 1) + platform.phase;
      const offset = Math.sin(cycle) * platform.distance;
      if (platform.axis === "y") platform.y = platform.yBase + offset;
      else platform.x = platform.xBase + offset;
    }
  }

  updateEnemies(dt) {
    for (const enemy of this.enemies) {
      enemy.cycleTime += dt;
      if (enemy.type === "zubat") {
        enemy.x = enemy.baseX + Math.sin(this.worldTime * 0.8 + enemy.baseX / 300) * enemy.range;
        enemy.y = enemy.yBase + Math.sin(this.worldTime * 1.9 + enemy.baseX / 170) * 17;
      }
    }
  }

  updateEmitters(dt) {
    for (const emitter of LEVEL.emitters || []) {
      const cycle=Math.floor((this.worldTime+emitter.phase)/emitter.period);
      if(this.emitterCycles.get(emitter.id)!==cycle && Math.abs(emitter.x-this.player.x)<1100 && this.worldTime>this.hazardSafeUntil){
        this.emitterCycles.set(emitter.id,cycle);
        this.enemyProjectiles.push({x:emitter.x,y:emitter.y+18,vx:-150,age:0});
      }
    }
    this.enemyProjectiles=this.enemyProjectiles.filter(shot=>{
      shot.x+=shot.vx*dt;shot.age+=dt;
      if(Math.abs(shot.x-this.player.x)<24 && Math.abs(shot.y-(this.player.y+20))<25){this.takeDamage("esfera eléctrica");return false;}
      return shot.age<7;
    });
  }

  updateProjectiles(dt) {
    this.projectiles = this.projectiles.filter((projectile) => {
      projectile.x += projectile.vx * dt;
      projectile.age += dt;
      if (projectile.age * Math.abs(projectile.vx) > CONFIG.physics.jetRange) return false;
      for (const target of LEVEL.targets) {
        if (Math.abs(target.x - projectile.x) < 36 && Math.abs(target.y - projectile.y) < 48) {
          const hits = (this.hitTargets.get(target.id) || 0) + 1;
          this.hitTargets.set(target.id, Math.min(hits, target.hits));
          this.onMessage(`${target.kind === "wheel" ? "Rueda" : "Mecanismo"} activado · ${hits}/${target.hits}`);
          return false;
        }
      }
      for (const enemy of this.enemies) {
        if (Math.abs(enemy.x - projectile.x) < 32 && Math.abs(enemy.y - projectile.y) < 34) {
          this.stunnedEnemies.set(enemy.id, 4);
          return false;
        }
      }
      return true;
    });
  }

  updatePlayer(dt) {
    const p = this.player;
    const left = this.inputs.has("left");
    const right = this.inputs.has("right");
    const jump = this.inputs.has("jump");
    const axis = Number(right) - Number(left);
    const wasGrounded = p.onGround;
    if (wasGrounded) p.coyote = CONFIG.physics.coyoteSeconds;
    else p.coyote = Math.max(0, p.coyote - dt);
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

    if (this.edges.has("jump")) p.jumpBuffer = CONFIG.physics.jumpBufferSeconds;
    if (this.edges.has("water")) this.fireJet();
    if (this.edges.has("shield")) this.activateShield();

    const water = this.waterAt(p.x + p.w / 2, p.y + p.h / 2);
    const leavingWater = p.inWater && !water;
    p.inWater = Boolean(water);
    if (leavingWater && jump) p.vy = -CONFIG.physics.jumpVelocity * .85;
    const speed = p.inWater ? CONFIG.physics.swimSpeed : CONFIG.physics.runSpeed;
    let targetSpeed = p.flightActive
      ? clamp(160 + axis * 80, 80, 240)
      : axis * speed;
    if (water && water.id === "river" && p.x > 12.9 * CONFIG.world.screenWidth && p.x < 13.2 * CONFIG.world.screenWidth) {
      const flow = this.isActionComplete("river-gate") ? 32 : -48;
      targetSpeed += flow;
      if (axis >= 0 && !p.flightActive) targetSpeed = Math.max(62, targetSpeed);
    } else if (water && axis === 0 && !p.flightActive) {
      targetSpeed += water.current;
    }
    const accel = axis === 0 ? CONFIG.physics.acceleration * 1.45 : CONFIG.physics.acceleration;
    p.vx = this.approach(p.vx, targetSpeed, accel * dt);
    if (axis) p.facing = axis;

    if (p.flightActive) {
      p.flightRemaining = Math.max(0, p.flightRemaining - dt);
      p.vy = jump ? -180 : 130;
      if (p.flightRemaining <= 0) p.flightActive = false;
    } else if (p.inWater) {
      if (jump) p.vy = this.approach(p.vy, -170, 500 * dt);
      else p.vy = Math.min(125, p.vy + 155 * dt);
    } else {
      if (p.jumpBuffer > 0 && p.coyote > 0) {
        p.vy = -CONFIG.physics.jumpVelocity;
        p.onGround = false;
        p.groundPlatform = null;
        p.coyote = 0;
        p.jumpBuffer = 0;
        this.audio?.effect?.("jump");
      }
      const variableJumpGravity = jump && p.vy < 0 ? CONFIG.physics.gravity * 0.52 : CONFIG.physics.gravity;
      p.vy = Math.min(900, p.vy + variableJumpGravity * dt);
    }

    if (wasGrounded && p.groundPlatform !== null) {
      const support = this.platforms.find((platform) => platform.index === p.groundPlatform);
      if (support) {
        p.x += support.x - support.previousX;
        p.y += support.y - support.previousY;
      }
    }

    const previousX = p.x;
    p.x = clamp(p.x + p.vx * dt, 0, LEVEL.width - p.w);
    this.resolveHorizontal(previousX);

    const previousY = p.y;
    p.y += p.vy * dt;
    if (p.flightActive) p.y = Math.max(70, p.y);
    p.onGround = false;
    p.groundPlatform = null;
    this.resolveVertical(previousY);

    this.touchGeysers();
    this.touchHoops();
    if (p.y > CONFIG.world.deathY) {
      if (p.inWater) {
        p.y = CONFIG.world.deathY - p.h - 8;
        p.vy = -120;
      } else this.takeDamage("caída", true);
    }
    p.safeX = p.onGround ? p.x : p.safeX;
    p.safeY = p.onGround ? p.y : p.safeY;
    const lookAhead = p.vx >= 0 ? 0.39 : 0.57;
    const desired = clamp(p.x - this.viewWidth * lookAhead, 0, LEVEL.width - this.viewWidth);
    this.cameraX += (desired - this.cameraX) * Math.min(1, 7 * dt);
  }

  approach(value, target, amount) {
    if (value < target) return Math.min(target, value + amount);
    return Math.max(target, value - amount);
  }

  playerBox() {
    return { x: this.player.x + 4, y: this.player.y + 4, w: this.player.w - 8, h: this.player.h - 5 };
  }

  resolveHorizontal(previousX) {
    const p = this.player;
    const box = this.playerBox();
    for (const platform of this.platforms) {
      if (!overlaps(box, platform)) continue;
      if (p.vx > 0 && previousX + p.w <= platform.x + 8) {
        p.x = platform.x - p.w;
        p.vx = 0;
      } else if (p.vx < 0 && previousX + p.w >= platform.x + platform.w - 8) {
        p.x = platform.x + platform.w;
        p.vx = 0;
      }
    }
  }

  resolveVertical(previousY) {
    const p = this.player;
    for (const platform of this.platforms) {
      const horizontalOverlap = p.x + p.w - 4 > platform.x && p.x + 4 < platform.x + platform.w;
      if (!horizontalOverlap) continue;
      if (p.vy >= 0 && previousY + p.h <= platform.previousY + 9 && p.y + p.h >= platform.y) {
        p.y = platform.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.groundPlatform = platform.index;
      } else if (p.vy < 0 && previousY >= platform.previousY + platform.h - 8 && p.y < platform.y + platform.h) {
        p.y = platform.y + platform.h;
        p.vy = 0;
      }
    }
  }

  waterAt(x, y) {
    return LEVEL.water.find((zone) => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h);
  }

  touchGeysers() {
    const p = this.playerBox();
    for (const geyser of LEVEL.geysers) {
      if (overlaps(p, geyser)) {
        this.player.flightActive = true;
        this.player.flightRemaining = CONFIG.physics.flightSeconds;
        this.player.vy = -160;
        this.player.y = Math.min(this.player.y, geyser.y - this.player.h);
      }
    }
  }

  touchHoops() {
    const p = this.player;
    const insideNow = new Set();
    for (const hoop of LEVEL.hoops) {
      const centerX = p.x + p.w / 2;
      const centerY = p.y + p.h / 2;
      if (Math.hypot(centerX - hoop.x, centerY - hoop.y) < hoop.r) {
        insideNow.add(hoop.id);
        if (!this.activeHoops?.has(hoop.id)) {
          p.flightActive = true;
          p.flightRemaining = CONFIG.physics.flightSeconds;
        }
      }
    }
    this.activeHoops = insideNow;
  }

  fireJet() {
    if (this.status !== "running" || this.jetCooldown > 0 || this.projectiles.length >= CONFIG.physics.maxJets) return;
    const p = this.player;
    this.projectiles.push({ x: p.x + (p.facing > 0 ? p.w : 0), y: p.y + 20, vx: p.facing * 690, age: 0 });
    this.jetCooldown = CONFIG.physics.jetCooldown;
    this.audio?.effect?.("water");
  }

  activateShield() {
    if (this.status !== "running" || this.shieldRemaining > 0 || this.shieldRecharge > 0 || this.stageIndex < 1) return;
    this.shieldRemaining = CONFIG.physics.shieldSeconds;
    this.audio?.effect?.("shield");
  }

  collectObjects() {
    const p = this.playerBox();
    for (const drop of LEVEL.drops) {
      if (this.collectedDrops.has(drop.id)) continue;
      if (overlaps(p, { x: drop.x - 12, y: drop.y - 12, w: 24, h: 24 })) {
        this.collectedDrops.add(drop.id);
        this.audio?.effect?.("drop");
        const count = this.collectedDrops.size;
        for (const threshold of [50, 100, 150]) {
          if (count >= threshold && !this.claimedLifeThresholds.has(threshold)) {
            this.claimedLifeThresholds.add(threshold);
            if (this.lives < CONFIG.physics.maxLives) this.lives += 1;
          }
        }
      }
    }
    for (const gift of LEVEL.gifts) {
      if (this.collectedGifts.has(gift.color)) continue;
      if (overlaps(p, gift)) {
        this.collectedGifts.add(gift.color);
        this.audio?.effect?.("gift");
        const cp = LEVEL.checkpoints.find((checkpoint) => Math.abs(checkpoint.x - gift.x) < 100);
        if (cp) this.activateCheckpoint(cp, true);
        this.onMessage(`Regalo ${gift.color} recogido · ${this.collectedGifts.size}/3`);
      }
    }
  }

  checkHazards() {
    if (this.worldTime < this.hazardSafeUntil) return;
    const box = this.playerBox();
    for (const hazard of LEVEL.hazards) {
      const phase = (this.worldTime + hazard.phase) % hazard.period;
      if (phase < hazard.period - 2) continue; // Three seconds inactive, one warning, one active.
      if (phase < hazard.period - 1) continue;
      if (overlaps(box, hazard)) {
        this.takeDamage("descarga");
        if (hazard.id.startsWith("river") && this.status === "running") {
          this.player.x=hazard.x-70; this.player.y=CONFIG.world.floorY-this.player.h;
          this.player.vx=0; this.player.vy=0;
        }
      }
    }
  }

  checkEnemyContacts() {
    const p = this.player;
    const box = this.playerBox();
    for (const enemy of this.enemies) {
      const isStunned = this.stunnedEnemies.has(enemy.id);
      if (isStunned) continue;
      const voltorbCycle = this.worldTime % 6;
      const activeVoltorb = enemy.type === "voltorb" && voltorbCycle >= 3 && voltorbCycle < 4;
      const hitbox = enemy.type === "voltorb"
        ? { x: enemy.x - (activeVoltorb ? 40 : 22), y: enemy.y - 28, w: activeVoltorb ? 80 : 44, h: 56 }
        : { x: enemy.x - 20, y: enemy.y - 18, w: 40, h: 36 };
      if (!overlaps(box, hitbox)) continue;
      const previousBottom = p.y + p.h - p.vy * (1 / 60);
      if (p.vy > 60 && previousBottom <= hitbox.y + 12 && !activeVoltorb) {
        this.stunnedEnemies.set(enemy.id, 4);
        p.vy = -270;
        continue;
      }
      if (activeVoltorb) this.takeDamage("pulso de Voltorb");
      else this.takeDamage("rival");
    }
  }

  checkGates() {
    const p = this.player;
    for (const gate of LEVEL.gates) {
      if (p.x + p.w <= gate.x || p.x >= gate.x + 24) continue;
      const targetOpen = gate.requires
        ? this.isActionComplete(gate.requires)
        : this.collectedGifts.has(gate.requiresGift);
      if (!targetOpen) {
        p.x = gate.x - p.w;
        p.vx = Math.min(0, p.vx);
        if (this.worldTime > this.stageNoticeUntil) {
          const message = gate.requiresGift
            ? `Recoge el regalo ${gate.requiresGift} para abrir el paso.`
            : "Activa el mecanismo con el chorro de agua.";
          this.setMessage(message, 2.4);
        }
      }
    }
  }

  isActionComplete(action) {
    const targets = LEVEL.targets.filter((target) => target.action === action);
    return targets.length > 0 && targets.every((target) => (this.hitTargets.get(target.id) || 0) >= target.hits);
  }

  checkCheckpoints() {
    for (const checkpoint of LEVEL.checkpoints) {
      if (this.player.x >= checkpoint.x && !this.checkpointIds.has(checkpoint.id)) this.activateCheckpoint(checkpoint);
    }
  }

  activateCheckpoint(checkpoint, gift = false) {
    if (!gift && this.checkpointIds.has(checkpoint.id)) return;
    this.checkpointIds.add(checkpoint.id);
    this.currentCheckpoint = {
      id: checkpoint.id,
      x: checkpoint.x,
      y: Math.min(CONFIG.world.floorY, ...this.platforms.filter(p=>p.kind!=="moving" && p.x<=checkpoint.x+16 && p.x+p.w>=checkpoint.x+16).map(p=>p.y)) - this.player.h,
    };
  }

  updateStage() {
    const nextStage = STAGE_ENDS.findIndex((end) => this.player.x < end);
    const stageIndex = nextStage === -1 ? CONFIG.stageData.length - 1 : nextStage;
    if (stageIndex !== this.stageIndex) {
      this.stageIndex = stageIndex;
      const stage = CONFIG.stageData[stageIndex];
      if (stageIndex === 1 && !this.tutorialsSeen.has("shield-unlocked")) {
        this.tutorialsSeen.add("shield-unlocked");
        this.setMessage("Escudo desbloqueado · K o botón Escudo", 3);
      }
      this.updateHud();
    }
    if (stageIndex === 6 && this.player.x >= screen(37) && !this.finalFadeStarted) {
      this.finalFadeStarted = true;
      if (this.audio) this.audio.fadeTo(this.audio.volume * 0.68, 3);
    }
  }

  updateTutorial() {
    const x = this.player.x;
    const tutorials = [
      { id: "move", at: 250, until: 910, text: "Muévete con ←/→ o A/D · En celular, usa las flechas" },
      { id: "jump", at: 960, until: 1850, text: "Salta con Espacio · Mantén para llegar más alto" },
      { id: "water", at: 1850, until: 2780, text: "Chorro de agua: J · Activa la rueda y abre el puente" },
      { id: "rival", at: screen(4.25), until: screen(5.35), text: "Usa el chorro para aturdir al rival" },
      { id: "shield", at: screen(7.8), until: screen(8.8), text: "Escudo burbuja: K · Bloquea un impacto" },
      { id: "swim", at: screen(10.15), until: screen(11.8), text: "Agua limpia: mantén Espacio para nadar hacia arriba" },
      { id: "flight", at: screen(16.05), until: screen(17.3), text: "Vuelo asistido: mantén Espacio para subir" },
    ];
    const tutorial = tutorials.find((item) => x >= item.at && x < item.until && !this.tutorialsSeen.has(item.id));
    if (tutorial) {
      this.tutorialsSeen.add(tutorial.id);
      this.setMessage(tutorial.text, Math.min(4, (tutorial.until - tutorial.at) / 220));
    }
  }

  checkFinish() {
    if (this.player.x < LEVEL.width - 100) return;
    if (this.collectedGifts.size < 3) {
      this.player.x = LEVEL.width - 110;
      this.player.vx = 0;
      this.setMessage("La entrada final necesita los tres regalos.", 3);
      return;
    }
    if (!this.partyTransitioned) {
      this.partyTransitioned = true;
      this.status = "party";
      this.partyTime = 0;
      this.audio?.fadeTo(0, 1.5);
      this.updateHud();
      this.onMessage("¡Llegaste a tu fiesta!");
      this.audio?.party?.(CONFIG.birthdayAudioUrl);
    }
  }

  takeDamage(cause, falling = false) {
    if (this.invulnerable > 0 || this.status !== "running") return;
    if (this.shieldRemaining > 0) {
      this.shieldRemaining = 0;
      this.shieldRecharge = CONFIG.physics.shieldRecharge;
      this.invulnerable = CONFIG.physics.damageCooldown;
      if (falling) this.respawnAtCheckpoint(false);
      else this.player.vx = -this.player.facing * 120;
      this.onMessage("El escudo bloqueó el impacto · recarga 8 s");
      this.updateHud();
      return;
    }
    this.lives -= 1;
    this.audio?.effect?.("hit");
    this.invulnerable = CONFIG.physics.damageCooldown;
    if (falling) this.respawnAtCheckpoint(false);
    else {
      this.player.vx = -this.player.facing * 180;
      this.player.vy = -160;
    }
    this.onMessage(`Impacto: ${cause} · ${Math.max(0, this.lives)} vidas`);
    if (this.lives <= 0) {
      this.status = "recovery";
      this.recoveryRemaining = 1.5;
      this.respawnAtCheckpoint(true);
      this.onMessage("¡Otra ronda!");
    }
    this.updateHud();
  }

  respawnAtCheckpoint(fullReset) {
    if (fullReset) this.lives = 3;
    const cp = this.currentCheckpoint;
    this.player.x = cp.x;
    this.player.y = cp.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
    this.player.flightActive = false;
    this.player.flightRemaining = 0;
    this.invulnerable = CONFIG.physics.damageCooldown;
    this.projectiles = [];
    this.hazardSafeUntil = this.worldTime + 2;
    const resetActions = new Set(
      LEVEL.targets
        .filter((target) => target.x >= cp.x && !this.isActionComplete(target.action) && !this.giftGateAction(target.action))
        .map((target) => target.action),
    );
    for (const target of LEVEL.targets) {
      if (resetActions.has(target.action)) this.hitTargets.delete(target.id);
    }
    this.cameraX = clamp(cp.x - 340, 0, LEVEL.width - this.viewWidth);
  }

  giftGateAction(action) {
    return action === "gift-rojo" || action === "gift-azul" || action === "gift-amarillo";
  }

  updateParty(dt) {
    this.partyTime += dt;
    const t = this.partyTime;
    const phase = t < 2 ? "arrival"
      : t < 10 ? "dance"
        : t < 15 ? "cake-approach"
          : t < 17 ? "cake-front"
            : t < 18 ? "blow"
              : t < 21 ? "countdown"
                : t < 23 ? "candles"
                  : t < 31 ? "birthday"
                    : t < 40 ? "personal-message"
                      : "celebration-loop";
    if (phase !== this.partyPhase) {
      this.partyPhase = phase;
      const messages = {
        arrival: "¡Llegaste a tu fiesta!",
        dance: "¡A bailar!",
        "cake-approach": "Squirtle trae una sorpresa",
        "cake-front": "Pide un deseo",
        blow: "Sopla en",
        countdown: String(Math.max(1, 3 - Math.floor(t - 18))),
        candles: "¡Deseo pedido!",
        birthday: "¡Feliz cumpleaños, Sebastián!",
        "personal-message": CONFIG.personalMessage,
        "celebration-loop": CONFIG.personalMessage,
      };
      if (messages[phase]) this.onMessage(messages[phase]);
    }
    if (t >= 40 && this.status !== "finished") {
      this.status = "finished";
      this.updateHud();
    }
  }

  stageAtWorldX(x) {
    const screenIndex = Math.floor(x / CONFIG.world.screenWidth);
    return CONFIG.stageData.find((stage) => screenIndex >= stage.startScreen && screenIndex < stage.endScreen) || CONFIG.stageData.at(-1);
  }

  updateHud() {
    const stage = this.stageAtWorldX(this.player.x);
    this.onHud({
      lives: this.lives,
      gifts: this.collectedGifts.size,
      drops: this.collectedDrops.size,
      stage: this.status === "cover" ? "Portada" : stage.name,
      shield: this.stageIndex < 1
        ? "Escudo: bloqueado"
        : this.shieldRemaining > 0
          ? `Escudo activo · ${this.shieldRemaining.toFixed(1)} s`
          : this.shieldRecharge > 0
            ? `Escudo recarga · ${this.shieldRecharge.toFixed(1)} s`
            : "Escudo disponible",
      status: this.status,
      pauseReason: this.pauseReason,
    });
  }

  render() {
    const ctx = this.ctx;
    const sx = this.canvas.width / this.viewWidth;
    const sy = this.canvas.height / CONFIG.canvas.height;
    ctx.save();
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.viewWidth, CONFIG.canvas.height);
    if (this.status === "party" || this.status === "finished") this.renderParty(ctx);
    else this.renderWorld(ctx);
    ctx.restore();
  }

  renderWorld(ctx) { renderWorld(this, ctx); }

  backgroundKeyForScreen(screenIndex) {
    if (!Number.isInteger(screenIndex) || screenIndex < 0) return null;
    if (screenIndex >= CONFIG.world.screens) return "night";
    if (screenIndex < 4) return "day";
    if (screenIndex < 10) return `forest-${((screenIndex - 4) % 4) + 1}`;
    if (screenIndex < 16) return `forest-${((screenIndex - 10) % 4) + 1}`;
    if (screenIndex < 22) return "day";
    if (screenIndex < 29) return null;
    if (screenIndex < 35) return `party-${((screenIndex - 29) % 4) + 1}`;
    return "night";
  }

  renderParty(ctx) { renderParty(this, ctx); }

  drawConfetti(ctx, t) {
    const colors = ["#e7d28e", "#91c9b5", "#db9b8b", "#b7a7d4", "#dce4a1"];
    const progress = (t - 21) / 23;
    for (let i = 0; i < 56; i += 1) {
      const x = (i * 83 + (t - 21) * (30 + i % 17)) % (this.viewWidth - 30) + 15;
      const y = ((i * 47 + (t - 21) * (46 + i % 19)) % 390) + 80;
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = Math.max(0.15, 0.7 - progress * 0.45);
      ctx.fillRect(x, y, 5, 9);
    }
    ctx.globalAlpha = 1;
  }

  drawPersonalMessage(ctx, centerX, startY, progress) {
    const characters = Array.from(CONFIG.personalMessage);
    if (characters.length === 0) return;
    const shownText = characters.slice(0, Math.floor(characters.length * clamp(progress, 0, 1))).join("");
    ctx.fillStyle = "#e6efe6";
    ctx.font = "17px system-ui";
    shownText.split("\n").forEach((line, index) => ctx.fillText(line, centerX, startY + index * 26));
  }

  centerText(ctx, text, y, fontSize, color) {
    ctx.fillStyle = color;
    ctx.font = `700 ${fontSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText(text, this.viewWidth / 2, y);
    ctx.textAlign = "left";
  }
}
