import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/config.js";
import { buildLevelData } from "../src/level.js";
import { BirthdayGame } from "../src/game.js";

const level = buildLevelData();

test("el recorrido contiene exactamente 150 gotitas únicas repartidas por etapa", () => {
  assert.equal(level.drops.length, 150);
  assert.equal(new Set(level.drops.map((drop) => drop.id)).size, 150);
  assert.deepEqual(
    CONFIG.stageData.map((stage) => level.drops.filter((drop) => drop.stageId === stage.id).length),
    [12, 24, 26, 24, 22, 28, 14],
  );
  assert.deepEqual(
    CONFIG.stageData.map((stage) => level.drops.filter((drop) => drop.stageId === stage.id && drop.optional).length),
    [0, 6, 8, 6, 6, 7, 2],
  );
});

test("el mundo es continuo, tiene tres regalos obligatorios y diez puntos de control", () => {
  assert.equal(level.width, 40 * 960);
  assert.deepEqual(level.gifts.map((gift) => gift.color), ["rojo", "azul", "amarillo"]);
  assert.equal(level.checkpoints.length, 10);
  assert.equal(new Set(level.checkpoints.map((checkpoint) => checkpoint.id)).size, 10);
});

test("el ancho lógico del Canvas se adapta a la pantalla sin cambiar la altura de juego", () => {
  const canvas = { width: 960, height: 540, getContext: () => null };
  const game = new BirthdayGame(canvas);
  game.resizeViewport(1480);
  assert.equal(game.viewWidth, 1480);
  assert.equal(canvas.width, 1480);
  assert.equal(canvas.height, 540);
});

test("cada tramo usa los fondos disponibles y no inventa fondo de ruinas", () => {
  const game = new BirthdayGame({ getContext: () => null });
  assert.equal(game.backgroundKeyForScreen(0), "day");
  assert.equal(game.backgroundKeyForScreen(4), "forest-1");
  assert.equal(game.backgroundKeyForScreen(16), "day");
  assert.equal(game.backgroundKeyForScreen(22), null);
  assert.equal(game.backgroundKeyForScreen(29), "party-1");
  assert.equal(game.backgroundKeyForScreen(35), "night");
  assert.equal(game.backgroundKeyForScreen(40), "night");
});

test("las gotitas y los regalos permanecen recogidos al reaparecer", () => {
  const game = new BirthdayGame({ getContext: () => null });
  game.collectedDrops.add("d-1-1");
  game.collectedGifts.add("rojo");
  game.respawnAtCheckpoint(true);
  assert.equal(game.collectedDrops.has("d-1-1"), true);
  assert.equal(game.collectedGifts.has("rojo"), true);
  assert.equal(game.lives, 3);
});

test("el escudo bloquea un impacto y empieza su recarga de ocho segundos", () => {
  const game = new BirthdayGame({ getContext: () => null });
  game.start();
  game.stageIndex = 1;
  game.activateShield();
  game.takeDamage("prueba");
  assert.equal(game.lives, 3);
  assert.equal(game.shieldRemaining, 0);
  assert.equal(game.shieldRecharge, CONFIG.physics.shieldRecharge);
});

test("el escudo no se activa antes de desbloquearse en la etapa 2", () => {
  const game = new BirthdayGame({ getContext: () => null });
  game.start();
  game.activateShield();
  assert.equal(game.shieldRemaining, 0);
});

test("al perder la última vida vuelve al punto de control con tres vidas", () => {
  const game = new BirthdayGame({ getContext: () => null });
  game.start();
  game.lives = 1;
  game.collectedDrops.add("d-1-1");
  game.takeDamage("prueba");
  assert.equal(game.status, "recovery");
  assert.equal(game.lives, 3);
  assert.equal(game.recoveryRemaining, 1.5);
  assert.equal(game.collectedDrops.has("d-1-1"), true);
});

test("el jugador se mueve y puede realizar un salto variable", () => {
  const game = new BirthdayGame({ getContext: () => null });
  game.start();
  game.setInput("right", true);
  for (let i = 0; i < 90; i += 1) game.step(1 / 60);
  assert.ok(game.player.x > 250);
  game.setInput("right", false);
  game.setInput("jump", true);
  game.step(1 / 60);
  assert.ok(game.player.vy < 0);
});

test("un chorro puede activar una rueda y su mecanismo", () => {
  const game = new BirthdayGame({ getContext: () => null });
  game.start();
  game.player.x = 2.1 * 960;
  game.player.y = CONFIG.world.floorY - game.player.h;
  game.fireJet();
  for (let i = 0; i < 60; i += 1) game.step(1 / 60);
  assert.equal(game.isActionComplete("bridge-meadow"), true);
});

test("la transición final requiere los tres regalos", () => {
  const game = new BirthdayGame({ getContext: () => null });
  game.start();
  game.player.x = level.width - 100;
  game.checkFinish();
  assert.equal(game.status, "running");
  game.collectedGifts.add("rojo");
  game.collectedGifts.add("azul");
  game.collectedGifts.add("amarillo");
  game.player.x = level.width - 100;
  game.checkFinish();
  assert.equal(game.status, "party");
});

test("la celebración también se puede pausar sin perder su tiempo", () => {
  const game = new BirthdayGame({ getContext: () => null });
  game.status = "party";
  game.partyTime = 12;
  game.pause("manual");
  game.step(1);
  assert.equal(game.partyTime, 12);
  game.resume();
  game.step(1 / 60);
  assert.ok(game.partyTime > 12);
});
