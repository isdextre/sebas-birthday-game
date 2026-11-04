import { CONFIG } from "./config.js";
import { GameAudio } from "./audio.js";
import { BirthdayGame } from "./game.js";

const canvas = document.querySelector("#game-canvas");
const cover = document.querySelector("#cover");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const resumeButton = document.querySelector("#resume-button");
const pauseOverlay = document.querySelector("#pause-overlay");
const pauseTitle = document.querySelector("#pause-title");
const pauseReason = document.querySelector("#pause-reason");
const orientationOverlay = document.querySelector("#orientation-overlay");
const countdownOverlay = document.querySelector("#ready-countdown");
const touchControls = document.querySelector(".touch-controls");
const volumeSlider = document.querySelector("#volume");
const volumeValue = document.querySelector("#volume-value");
const livesValue = document.querySelector("#lives-value");
const giftsValue = document.querySelector("#gifts-value");
const dropsValue = document.querySelector("#drops-value");
const stageValue = document.querySelector("#stage-value");
const shieldValue = document.querySelector("#shield-value");
const statusMessage = document.querySelector("#status-message");
const coverAudioNote = document.querySelector("#cover-audio-note");

const audio = new GameAudio(CONFIG.musicUrl, CONFIG.initialVolume);
let countdownRemaining = 0;
let game;

game = new BirthdayGame(canvas, {
  audio,
  onHud: (hud) => {
    livesValue.textContent = String(hud.lives);
    giftsValue.textContent = `${hud.gifts}/3`;
    dropsValue.textContent = `${hud.drops}/150`;
    stageValue.textContent = hud.stage;
    shieldValue.textContent = hud.shield;
    pauseButton.hidden = hud.status === "cover";
    pauseButton.textContent = hud.status === "paused" ? "Continuar" : "Pausa";
    pauseButton.setAttribute("aria-label", hud.status === "paused" ? "Continuar" : "Pausar");
    pauseOverlay.hidden = hud.status !== "paused" || hud.pauseReason === "orientation";
    if (hud.status === "paused") {
      pauseTitle.textContent = hud.pauseReason === "tab" ? "Partida detenida" : "Pausa";
      pauseReason.textContent = hud.pauseReason === "tab"
        ? "Cambiaste de pestaña. El recorrido está congelado."
        : "La simulación y la música están detenidas.";
    }
    const supportsTouch = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && matchMedia("(any-hover: none)").matches);
    touchControls.hidden = hud.status !== "running" || !supportsTouch || isNarrowPortrait();
  },
  onMessage: (message) => {
    if (message) statusMessage.textContent = message;
  },
});

function isNarrowPortrait() {
  return (matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && matchMedia("(any-hover: none)").matches)) && window.innerHeight > window.innerWidth;
}

function beginCountdown() {
  countdownRemaining = 3;
  countdownOverlay.hidden = false;
  countdownOverlay.textContent = "3";
}

function clearCountdown() {
  countdownRemaining = 0;
  countdownOverlay.hidden = true;
}

async function beginGame() {
  if (!game.art.ready || !game.start()) return;
  document.body.classList.add("is-playing");
  cover.hidden = true;
  pauseButton.hidden = false;
  if (isNarrowPortrait()) {
    game.pause("orientation");
    orientationOverlay.hidden = false;
  }
  const playing = await audio.start();
  if (playing) coverAudioNote.textContent = "La música del recorrido está sonando.";
  else {
    coverAudioNote.textContent = "El navegador no inició el audio. El juego sigue disponible.";
    statusMessage.textContent = "No se pudo iniciar la música; puedes seguir jugando.";
  }
  game.render();
}

function pauseOrResume() {
  if (game.status === "running" || game.status === "party" || game.status === "finished") {
    clearCountdown();
    game.pause("manual");
  }
  else if (game.status === "paused") {
    if (game.pauseReason === "orientation" && isNarrowPortrait()) return;
    if (game.resume()) beginCountdown();
  }
}

startButton.addEventListener("click", beginGame);
pauseButton.addEventListener("click", pauseOrResume);
resumeButton.addEventListener("click", () => {
  if (game.resume()) beginCountdown();
});

volumeSlider.value = String(Math.round(CONFIG.initialVolume * 100));
volumeValue.textContent = `${volumeSlider.value} %`;
volumeSlider.addEventListener("input", () => {
  audio.setVolume(Number(volumeSlider.value) / 100);
  volumeValue.textContent = `${volumeSlider.value} %`;
});

const keyMap = new Map([
  ["ArrowLeft", "left"], ["KeyA", "left"],
  ["ArrowRight", "right"], ["KeyD", "right"],
  ["Space", "jump"], ["KeyJ", "water"], ["KeyK", "shield"],
]);
window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" || event.code === "KeyP") {
    event.preventDefault();
    pauseOrResume();
    return;
  }
  const control = keyMap.get(event.code);
  if (!control || game.status !== "running" || countdownRemaining > 0) return;
  event.preventDefault();
  game.setInput(control, true);
}, { passive: false });

window.addEventListener("keyup", (event) => {
  const control = keyMap.get(event.code);
  if (!control) return;
  event.preventDefault();
  game.setInput(control, false);
}, { passive: false });

for (const button of touchControls.querySelectorAll("[data-control]")) {
  const control = button.dataset.control;
  button.addEventListener("pointerdown", (event) => {
    if (game.status !== "running" || countdownRemaining > 0) return;
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    button.classList.add("is-pressed");
    game.setInput(control, true);
  });
  const release = (event) => {
    event.preventDefault();
    button.classList.remove("is-pressed");
    game.setInput(control, false);
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", (event) => {
    button.classList.remove("is-pressed");
    game.setInput(control, false);
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearCountdown();
    game.pause("tab");
  }
  else if (game.status === "paused" && game.pauseReason === "orientation" && !isNarrowPortrait()) {
    orientationOverlay.hidden = true;
    if (game.resume()) beginCountdown();
  }
});

function syncOrientation() {
  if (!game || game.status === "cover" || game.status === "finished") {
    orientationOverlay.hidden = !isNarrowPortrait();
    return;
  }
  if (isNarrowPortrait()) {
    clearCountdown();
    orientationOverlay.hidden = false;
    pauseOverlay.hidden = true;
    game.pause("orientation");
  } else {
    orientationOverlay.hidden = true;
    if (game.status === "paused" && game.pauseReason === "orientation") {
      if (game.resume()) beginCountdown();
    }
  }
}
window.addEventListener("resize", syncOrientation);
window.addEventListener("orientationchange", syncOrientation);
syncOrientation();

function resizeCanvasToFrame() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const logicalWidth = Math.max(480, Math.round(CONFIG.canvas.height * rect.width / rect.height));
  game.resizeViewport(logicalWidth);
}
const canvasResizeObserver = new ResizeObserver(resizeCanvasToFrame);
canvasResizeObserver.observe(canvas.parentElement);
window.addEventListener("resize", resizeCanvasToFrame);
resizeCanvasToFrame();

let previous = performance.now();
let accumulator = 0;
function frame(now) {
  const elapsed = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  if (countdownRemaining > 0) {
    countdownRemaining -= elapsed;
    countdownOverlay.textContent = String(Math.max(1, Math.ceil(countdownRemaining)));
    if (countdownRemaining <= 0) {
      countdownOverlay.hidden = true;
      countdownRemaining = 0;
    }
  } else if (game.status !== "paused" && game.status !== "cover") {
    accumulator += elapsed;
    const fixedStep = 1 / 60;
    let steps = 0;
    while (accumulator >= fixedStep && steps < 5) {
      game.step(fixedStep);
      accumulator -= fixedStep;
      steps += 1;
    }
  } else {
    accumulator = 0;
  }
  game.menuTime += elapsed;
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

startButton.disabled = true;
startButton.textContent = "CARGANDO…";
game.art.load().then(()=>{
  startButton.disabled=false;
  startButton.textContent="COMENZAR!";
  document.body.classList.add("assets-ready");
}).catch(error=>{
  startButton.textContent="RECARGAR";
  startButton.disabled=false;
  startButton.onclick=()=>location.reload();
  coverAudioNote.textContent=error.message;
  coverAudioNote.hidden=false;
});
