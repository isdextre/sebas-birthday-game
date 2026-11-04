import { CONFIG } from "./config.js";

const screen = (n) => n * CONFIG.world.screenWidth;

function mergeRanges(ranges) {
  const sorted = ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function floorRanges() {
  const gaps = [
    [screen(1.36), screen(1.48)],
    [screen(5.34), screen(5.44)],
    [screen(6.15), screen(6.31)],
    [screen(7.28), screen(7.43)],
    [screen(30.5), screen(30.64)],
    [screen(32.1), screen(32.27)],
    [screen(36.72), screen(36.82)],
  ];
  const platforms = [];
  for (let screenIndex = 0; screenIndex < CONFIG.world.screens; screenIndex += 1) {
    const start = screen(screenIndex);
    const end = screen(screenIndex + 1);
    const cuts = gaps.filter(([a, b]) => a < end && b > start);
    let cursor = start;
    for (const [cutStart, cutEnd] of cuts) {
      if (cutStart > cursor) platforms.push({ x: cursor, y: CONFIG.world.floorY, w: cutStart - cursor, h: 34, kind: "floor" });
      cursor = Math.max(cursor, cutEnd);
    }
    if (cursor < end) platforms.push({ x: cursor, y: CONFIG.world.floorY, w: end - cursor, h: 34, kind: "floor" });
  }
  return platforms;
}

function makeDrops() {
  const drops = [];
  for (const stage of CONFIG.stageData) {
    const requiredCount = stage.drops - stage.optional;
    const stageStart = screen(stage.startScreen);
    const stageWidth = screen(stage.endScreen - stage.startScreen);
    for (let i = 0; i < requiredCount; i += 1) {
      const x = stageStart + 145 + ((i + 0.5) * (stageWidth - 290)) / requiredCount;
      const heightPattern = [0, 34, 64, 20, 48, 10];
      const y = 374 - heightPattern[i % heightPattern.length];
      drops.push({ id: `d-${stage.id}-${i + 1}`, x, y, optional: false, stageId: stage.id });
    }
    for (let i = 0; i < stage.optional; i += 1) {
      const x = stageStart + stageWidth * 0.25 + ((i + 0.5) * stageWidth * 0.5) / stage.optional;
      const y = 235 - (i % 3) * 27;
      drops.push({ id: `d-${stage.id}-o${i + 1}`, x, y, optional: true, stageId: stage.id });
    }
  }
  return drops;
}

function makePlatforms() {
  const platforms = floorRanges();
  const add = (x, y, w, h = 20, kind = "platform", extra = {}) =>
    platforms.push({ x, y, w, h, kind, ...extra });

  // Broad recovery ledges and visible landing zones.
  [
    [screen(1.15), 388, 245], [screen(1.52), 410, 210],
    [screen(5.28), 390, 240], [screen(5.72), 358, 180], [screen(6.35), 395, 230],
    [screen(7.1), 364, 220], [screen(7.62), 390, 220], [screen(8.1), 372, 250],
    [screen(9.05), 375, 310],
    [screen(10.25), 335, 760], [screen(12.2), 335, 250], [screen(14.8), 350, 310],
    [screen(15.55), 372, 360],
    [screen(16.08), 375, 360], [screen(17.2), 335, 240], [screen(18.25), 300, 250],
    [screen(19.4), 345, 210], [screen(20.65), 385, 350], [screen(21.05), 395, 330],
    [screen(22.05), 382, 270], [screen(23), 385, 230], [screen(24.2), 375, 220],
    [screen(25.2), 345, 210], [screen(26.1), 388, 220], [screen(27), 350, 230],
    [screen(28), 392, 280],
    [screen(29.1), 390, 340], [screen(30), 398, 240], [screen(31.05), 372, 230],
    [screen(32.1), 350, 220], [screen(33), 385, 300], [screen(34.08), 388, 400],
    [screen(35.15), 395, 340], [screen(36.1), 380, 270], [screen(37.3), 392, 300],
  ].forEach(([x, y, w]) => add(x, y, w));

  // The water route has a visible, safe lower recovery path.
  [
    [screen(1.33), 536, screen(0.21)],
    [screen(5.31), 536, screen(0.45)],
    [screen(10.02), 536, screen(5.9)],
    [screen(29), 536, screen(5.9)],
  ].forEach(([x, y, w]) => add(x, y, w, 22, "water-bottom"));

  // Three moving platforms in the forest; wide fixed route remains below.
  [
    { x: screen(6.05), y: 340, w: 180, h: 18, axis: "x", distance: 240, speed: 75, phase: 0 },
    { x: screen(7.0), y: 305, w: 160, h: 18, axis: "x", distance: 330, speed: 82, phase: 1.4 },
    { x: screen(7.65), y: 330, w: 180, h: 18, axis: "x", distance: 390, speed: 90, phase: 2.6 },
    { x: screen(30), y: 344, w: 190, h: 18, axis: "x", distance: 205, speed: 68, phase: 0.9 },
    { x: screen(31), y: 335, w: 180, h: 18, axis: "y", distance: 64, speed: 48, phase: 2.1 },
    { x: screen(32.3), y: 326, w: 170, h: 18, axis: "y", distance: 70, speed: 50, phase: 3.2 },
  ].forEach((platform) => add(platform.x, platform.y, platform.w, platform.h, "moving", {
    ...platform,
    xBase: platform.x,
    yBase: platform.y,
  }));

  return platforms;
}

function buildLevelData() {
  const gifts = [
    { id: "gift-red", color: "rojo", x: screen(9.22), y: 338, w: 42, h: 42, stageId: 2 },
    { id: "gift-blue", color: "azul", x: screen(21.22), y: 348, w: 42, h: 42, stageId: 4 },
    { id: "gift-yellow", color: "amarillo", x: screen(34.24), y: 340, w: 42, h: 42, stageId: 6 },
  ];

  const targets = [
    { id: "wheel-meadow", kind: "wheel", x: screen(2.55), y: 385, hits: 1, action: "bridge-meadow" },
    { id: "wheel-river", kind: "wheel", x: screen(12.62), y: 330, hits: 1, action: "river-gate" },
    { id: "wheel-ruins-1", kind: "wheel", x: screen(26.3), y: 407, hits: 1, action: "ruins-door" },
    { id: "wheel-ruins-2", kind: "wheel", x: screen(27.1), y: 342, hits: 1, action: "ruins-door" },
    { id: "wheel-ruins-3", kind: "wheel", x: screen(27.92), y: 407, hits: 1, action: "ruins-door" },
    { id: "wheel-bridge", kind: "wheel", x: screen(33.62), y: 374, hits: 2, action: "bridge-final" },
  ];

  const gates = [
    { id: "meadow-bridge", x: screen(2.92), y: 300, h: 152, requires: "bridge-meadow" },
    { id: "red-gift-gate", x: screen(9.94), y: 300, h: 152, requiresGift: "rojo" },
    { id: "river-gate", x: screen(13.18), y: 300, h: 152, requires: "river-gate" },
    { id: "blue-gift-gate", x: screen(21.94), y: 300, h: 152, requiresGift: "azul" },
    { id: "ruins-door", x: screen(28.86), y: 300, h: 152, requires: "ruins-door" },
    { id: "bridge-gate", x: screen(33.94), y: 300, h: 152, requires: "bridge-final" },
    { id: "yellow-gift-gate", x: screen(34.92), y: 300, h: 152, requiresGift: "amarillo" },
  ];

  const hazards = [
    { id: "river-pulse-1", type: "electric", x: screen(13.48), y: 383, w: 210, h: 30, period: 5, phase: 0 },
    { id: "river-pulse-2", type: "electric", x: screen(14.72), y: 383, w: 190, h: 30, period: 5, phase: 2.5 },
    { id: "ruins-slab-1", type: "electric", x: screen(22.78), y: 424, w: 92, h: 28, period: 5, phase: 0 },
    { id: "ruins-slab-2", type: "electric", x: screen(23.42), y: 424, w: 92, h: 28, period: 5, phase: 1.2 },
    { id: "ruins-slab-3", type: "electric", x: screen(24.06), y: 424, w: 92, h: 28, period: 5, phase: 2.4 },
  ];

  const enemies = [
    { id: "zubat-1", type: "zubat", x: screen(4.9), y: 348, range: 190, speed: 42 },
    { id: "zubat-2", type: "zubat", x: screen(17.72), y: 290, range: 240, speed: 49 },
    { id: "voltorb-1", type: "voltorb", x: screen(25), y: 405, range: 0, speed: 0 },
    { id: "zubat-3", type: "zubat", x: screen(31.65), y: 310, range: 230, speed: 46 },
    { id: "zubat-4", type: "zubat", x: screen(36.2), y: 348, range: 180, speed: 40 },
  ];

  const water = [
    { id: "meadow-pool", x: screen(1.34), y: 414, w: screen(0.18), h: 122, clean: true, current: 0 },
    { id: "forest-pool", x: screen(5.32), y: 400, w: screen(0.43), h: 144, clean: true, current: 15 },
    { id: "river", x: screen(10.02), y: 346, w: screen(5.9), h: 202, clean: true, current: 24 },
    { id: "bridge-river", x: screen(29), y: 402, w: screen(5.9), h: 146, clean: true, current: 10 },
  ];

  const geysers = [
    { id: "geyser-river", x: screen(15.25), y: 410, w: 90, h: 44 },
    { id: "geyser-sky", x: screen(16.07), y: 400, w: 80, h: 52 },
    { id: "geyser-sky-2", x: screen(19.5), y: 400, w: 80, h: 52 },
    { id: "geyser-bridge", x: screen(31.12), y: 402, w: 90, h: 48 },
  ];

  const hoops = [];
  for(const [start,end] of [[16.5,21],[31.5,33]]) {
    for(let x=start;x<end;x+=.52) hoops.push({id:`hoop-${x.toFixed(2)}`,x:screen(x),y:270+Math.sin(x*4)*45,r:54});
  }
  const emitters = [
    {id:'emitter-forest',x:screen(8.55),y:360,w:40,h:40,period:4,phase:0},
    {id:'emitter-ruins',x:screen(27.75),y:352,w:40,h:40,period:4,phase:1},
    {id:'emitter-bridge',x:screen(33.8),y:365,w:40,h:40,period:4,phase:2}
  ];

  const checkpoints = [
    { id: "cp-0", x: screen(0) + 80 },
    { id: "cp-1", x: screen(4) + 80 },
    { id: "cp-red", x: screen(9.25) },
    { id: "cp-2", x: screen(10) + 80 },
    { id: "cp-3", x: screen(16) + 80 },
    { id: "cp-blue", x: screen(21.25) },
    { id: "cp-4", x: screen(22) + 80 },
    { id: "cp-5", x: screen(29) + 80 },
    { id: "cp-yellow", x: screen(34.25) },
    { id: "cp-6", x: screen(35) + 80 },
  ];

  return {
    width: screen(CONFIG.world.screens),
    floors: floorRanges(),
    platforms: makePlatforms(),
    drops: makeDrops(),
    gifts,
    targets,
    gates,
    hazards,
    enemies,
    water,
    geysers,
    hoops,
    checkpoints,
    emitters,
  };
}

export const LEVEL = buildLevelData();
export { buildLevelData, screen, mergeRanges };
