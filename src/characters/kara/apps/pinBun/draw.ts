/*
 * Draws Pin Bun's table: KARA'S MIDNIGHT DRIVE-THRU. A serious, expensive-looking machine from about 2003, smooth
 * and glossy like the rest of Kara's computer, not pixels, with nothing normal printed on it. Cold metal and
 * midnight blue for the machine, warm cheese and tomato for the food, lime for Kara's things.
 *
 * What never moves is drawn once into a picture of its own and copied each frame. Glows that move are radial
 * gradients rather than canvas shadows, which are too slow to redraw every frame.
 */

import {
  ARC,
  BALL_RADIUS,
  BUMPERS,
  FLIPPER_LENGTH,
  FLIPPER_RADIUS,
  FLIPPERS,
  HEIGHT,
  LANE,
  LANE_LABELS,
  LANES,
  PLAYFIELD_MIDDLE,
  SLINGS,
  TARGET_LETTERS,
  TARGETS,
  WALLS,
  WIDTH,
  ballOnPlunger,
  type Game,
} from "./engine";

/** How long something stays lit after being hit, in seconds. */
const HIT_GLOW = 0.15;
/** How long the whole table flashes after a set is done. */
const BONUS_FLASH_SECONDS = 1.2;
/** How far the plunger is pulled down at full charge. */
const PLUNGER_TRAVEL = 30;

const C = {
  night: "#171b2b",
  tileA: "#1c2236",
  tileB: "#151a29",
  metal: "#344356",
  metalLight: "#8fa3bd",
  metalShine: "rgba(235, 244, 255, 0.85)",
  metalDark: "#11161f",
  cheese: "#ffad42",
  tomato: "#ff5159",
  lime: "#b6ff5c",
  mint: "#58e0c0",
  print: "rgba(255, 236, 200, 0.8)",
};

const FONT = "Tahoma, Verdana, sans-serif";

let still: { canvas: HTMLCanvasElement; scale: number } | null = null;

/** The table at `scale` canvas pixels per table pixel. */
export function drawTable(context: CanvasRenderingContext2D, game: Game, scale: number) {
  if (!still || still.scale !== scale) still = { canvas: drawStill(scale), scale };
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(still.canvas, 0, 0);
  context.setTransform(scale, 0, 0, scale, 0, 0);

  drawArcBulbs(context, game);
  drawClock(context, game);
  drawLights(context, game);
  drawTargets(context, game);
  drawSlingGlow(context, game);
  drawBumpers(context, game);
  drawPlunger(context, game);
  drawFlippers(context, game);
  if (game.ball) drawBall(context, game.ball.x, game.ball.y, game.ball.spin);
}

// ---------------------------------------------------------------------------------------------------------------
// Small pieces used everywhere.

function text(
  c: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = "bold",
) {
  c.font = `${weight} ${size}px ${FONT}`;
  c.fillStyle = color;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(line, x, y);
}

/** Text in a neon tube: a wide soft glow, the colored tube, and a white-hot core. Still picture only (shadows). */
function neon(c: CanvasRenderingContext2D, line: string, x: number, y: number, size: number, color: string) {
  c.save();
  c.font = `bold ${size}px ${FONT}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.shadowColor = color;
  c.shadowBlur = size * 0.7;
  c.lineWidth = size * 0.12;
  c.strokeStyle = color;
  c.strokeText(line, x, y);
  c.shadowBlur = size * 0.4;
  c.strokeText(line, x, y);
  c.shadowBlur = 0;
  c.lineWidth = size * 0.05;
  c.strokeStyle = "rgba(255, 255, 255, 0.9)";
  c.strokeText(line, x, y);
  c.restore();
}

/**
 * A light bulb under a colored cap: off, just tinted glass with a glint; on, a soft halo, the saturated cap and a
 * white core. `glow` from 0 to 1 dims it in between.
 */
function bulb(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, glow: number) {
  if (glow > 0) {
    const halo = c.createRadialGradient(x, y, r * 0.5, x, y, r * 3);
    halo.addColorStop(0, withAlpha(color, 0.55 * glow));
    halo.addColorStop(1, withAlpha(color, 0));
    c.fillStyle = halo;
    c.beginPath();
    c.arc(x, y, r * 3, 0, Math.PI * 2);
    c.fill();
  }
  const cap = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  if (glow > 0) {
    cap.addColorStop(0, "#ffffff");
    cap.addColorStop(0.35, withAlpha(color, 0.6 + 0.4 * glow));
    cap.addColorStop(1, withAlpha(color, 0.5 + 0.5 * glow));
  } else {
    cap.addColorStop(0, withAlpha(color, 0.32));
    cap.addColorStop(1, withAlpha(color, 0.08));
  }
  c.fillStyle = cap;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 0.8;
  c.strokeStyle = "rgba(0, 0, 0, 0.5)";
  c.stroke();
  c.fillStyle = "rgba(255, 255, 255, 0.6)";
  c.beginPath();
  c.arc(x - r * 0.35, y - r * 0.4, r * 0.22, 0, Math.PI * 2);
  c.fill();
}

const alphaCache = new Map<string, string>();

/** A #rrggbb color at some opacity. */
function withAlpha(hex: string, alpha: number): string {
  const key = `${hex}${alpha.toFixed(2)}`;
  let value = alphaCache.get(key);
  if (!value) {
    const n = parseInt(hex.slice(1), 16);
    value = `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha.toFixed(2)})`;
    alphaCache.set(key, value);
  }
  return value;
}

/** A screw head, for anything bolted on. */
function screw(c: CanvasRenderingContext2D, x: number, y: number, r = 2.2) {
  const head = c.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
  head.addColorStop(0, "#e9f0f8");
  head.addColorStop(1, "#5a6a80");
  c.fillStyle = head;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(0, 0, 0, 0.6)";
  c.lineWidth = 0.6;
  c.stroke();
  c.beginPath();
  c.moveTo(x - r * 0.6, y - r * 0.2);
  c.lineTo(x + r * 0.6, y + r * 0.2);
  c.stroke();
}

/** A plastic arrow insert, the kind tables use to point at what to shoot for. */
function arrow(c: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, color: string) {
  const head = Math.min(10, length * 0.4);
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(0, -4);
  c.lineTo(length - head, -4);
  c.lineTo(length - head, -9);
  c.lineTo(length, 0);
  c.lineTo(length - head, 9);
  c.lineTo(length - head, 4);
  c.lineTo(0, 4);
  c.closePath();
  const plastic = c.createLinearGradient(0, -9, 0, 9);
  plastic.addColorStop(0, withAlpha(color, 0.95));
  plastic.addColorStop(1, withAlpha(color, 0.45));
  c.fillStyle = plastic;
  c.fill();
  c.lineWidth = 1;
  c.strokeStyle = "rgba(255, 255, 255, 0.55)";
  c.stroke();
  c.restore();
}

/** A soft shadow under whatever `shape` draws, offset down and to the right. Still picture only (filters). */
function dropShadow(c: CanvasRenderingContext2D, dx: number, dy: number, blur: number, shape: () => void) {
  c.save();
  c.translate(dx, dy);
  c.filter = `blur(${blur}px)`;
  shape();
  c.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// The still picture: everything bolted down or printed on.

function drawStill(scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const c = canvas.getContext("2d");
  if (!c) return canvas;
  c.setTransform(scale, 0, 0, scale, 0, 0);

  drawFloor(c);
  drawCabinet(c);
  drawPrint(c);
  drawSlingBodies(c);
  drawRails(c);
  drawPostRubbers(c);
  drawBumperBases(c);
  return canvas;
}

/** Diner floor tiles under the glass, lit by the sign from above, with grease where grease goes. */
function drawFloor(c: CanvasRenderingContext2D) {
  c.fillStyle = C.night;
  c.fillRect(0, 0, WIDTH, HEIGHT);

  const tile = 24;
  c.save();
  c.translate(PLAYFIELD_MIDDLE, 380);
  c.rotate(Math.PI / 4);
  for (let x = -24; x < 24; x++) {
    for (let y = -24; y < 24; y++) {
      c.fillStyle = (x + y) % 2 === 0 ? C.tileA : C.tileB;
      c.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  c.restore();

  // The sign's light pooling on the floor, warm at the top, fading into the night.
  const sign = c.createRadialGradient(PLAYFIELD_MIDDLE, 170, 10, PLAYFIELD_MIDDLE, 170, 260);
  sign.addColorStop(0, "rgba(255, 173, 66, 0.22)");
  sign.addColorStop(1, "rgba(255, 173, 66, 0)");
  c.fillStyle = sign;
  c.fillRect(0, 0, WIDTH, HEIGHT);

  // Darker towards the drain.
  const dark = c.createLinearGradient(0, 460, 0, HEIGHT);
  dark.addColorStop(0, "rgba(5, 6, 12, 0)");
  dark.addColorStop(1, "rgba(5, 6, 12, 0.75)");
  c.fillStyle = dark;
  c.fillRect(0, 0, WIDTH, HEIGHT);

  // Grease: a few glossy smears.
  for (const [x, y, rx, ry, turn] of [
    [80, 380, 30, 12, 0.4],
    [290, 470, 26, 10, -0.6],
    [200, 520, 34, 9, 0.1],
  ] as const) {
    const sheen = c.createRadialGradient(x, y, 0, x, y, rx);
    sheen.addColorStop(0, "rgba(255, 220, 150, 0.08)");
    sheen.addColorStop(1, "rgba(255, 220, 150, 0)");
    c.save();
    c.translate(x, y);
    c.rotate(turn);
    c.scale(1, ry / rx);
    c.translate(-x, -y);
    c.fillStyle = sheen;
    c.beginPath();
    c.arc(x, y, rx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Sauce that missed.
  splat(c, 70, 560, 7, C.tomato);
  splat(c, 300, 300, 5, "#f5c518");
  splat(c, 250, 590, 4, C.tomato);
}

function splat(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = withAlpha(color, 0.28);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  for (const [dx, dy, size] of [
    [1.6, -0.4, 0.35],
    [-1.2, 1.1, 0.3],
    [0.4, 1.8, 0.22],
    [-1.8, -0.9, 0.18],
  ] as const) {
    c.moveTo(x + dx * r + size * r, y + dy * r);
    c.arc(x + dx * r, y + dy * r, size * r, 0, Math.PI * 2);
  }
  c.fill();
}

/** Outside the playfield: the cabinet's brushed metal, the plunger lane, the dead corners under the guides. */
function drawCabinet(c: CanvasRenderingContext2D) {
  const metal = c.createLinearGradient(0, 0, WIDTH, 0);
  metal.addColorStop(0, "#232c3a");
  metal.addColorStop(0.5, C.metal);
  metal.addColorStop(1, "#232c3a");
  c.fillStyle = metal;
  c.beginPath();
  c.rect(0, 0, WIDTH, HEIGHT);
  c.moveTo(12, 540);
  c.lineTo(12, ARC.y);
  c.arc(ARC.x, ARC.y, ARC.r, Math.PI, 0);
  c.lineTo(388, HEIGHT);
  c.lineTo(LANE.left, HEIGHT);
  c.lineTo(LANE.left, 540);
  c.lineTo(254, 628);
  c.lineTo(254, HEIGHT);
  c.lineTo(118, HEIGHT);
  c.lineTo(118, 628);
  c.closePath();
  c.fill("evenodd");

  // The plunger lane, a dark metal channel.
  const lane = c.createLinearGradient(LANE.left, 0, LANE.right, 0);
  lane.addColorStop(0, "#0b0e16");
  lane.addColorStop(0.5, "#1b2230");
  lane.addColorStop(1, "#0b0e16");
  c.fillStyle = lane;
  c.fillRect(LANE.left, LANE.top - 20, LANE.right - LANE.left, HEIGHT - LANE.top + 20);

  // The cabinet's own screws, and the ones holding the corners under the guides down.
  for (const [x, y] of [
    [6, 60],
    [394, 60],
    [6, 700],
    [394, 700],
    [6, 380],
    [394, 380],
    [26, 668],
    [98, 704],
    [274, 704],
    [346, 668],
  ] as const) {
    screw(c, x, y);
  }
}

function drawRails(c: CanvasRenderingContext2D) {
  c.lineCap = "round";
  c.lineJoin = "round";
  const railPath = () => {
    c.beginPath();
    for (const wall of WALLS) {
      if (wall.kind === "gate") continue;
      c.moveTo(wall.ax, wall.ay);
      c.lineTo(wall.bx, wall.by);
    }
  };

  // Shadow, then a dark edge, the metal, and a shine along its top-left.
  dropShadow(c, 2, 3, 2, () => {
    railPath();
    c.lineWidth = 8;
    c.strokeStyle = "rgba(0, 0, 0, 0.45)";
    c.stroke();
  });

  railPath();
  c.lineWidth = 8;
  c.strokeStyle = C.metalDark;
  c.stroke();
  c.lineWidth = 5.5;
  c.strokeStyle = C.metalLight;
  c.stroke();
  c.save();
  c.translate(-0.8, -0.8);
  railPath();
  c.lineWidth = 1.4;
  c.strokeStyle = C.metalShine;
  c.stroke();
  c.restore();

  // Rivets where long straight rails start and end.
  for (const wall of WALLS) {
    if (wall.kind !== "wall" || Math.hypot(wall.bx - wall.ax, wall.by - wall.ay) < 40) continue;
    screw(c, wall.ax, wall.ay, 1.8);
    screw(c, wall.bx, wall.by, 1.8);
  }

  // The gate, a thin spring-steel flap.
  const gate = WALLS.find((wall) => wall.kind === "gate");
  if (gate) {
    c.lineWidth = 2;
    c.strokeStyle = C.metalLight;
    c.beginPath();
    c.moveTo(gate.ax, gate.ay);
    c.lineTo(gate.bx, gate.by);
    c.stroke();
  }
}

/** Red rubber rings on the ends of the posts between the top lanes. */
function drawPostRubbers(c: CanvasRenderingContext2D) {
  for (const wall of WALLS) {
    if (wall.ax !== wall.bx || wall.ay !== 92) continue;
    for (const y of [wall.ay, wall.by]) {
      c.fillStyle = "#b8232b";
      c.beginPath();
      c.arc(wall.ax, y, 4.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255, 255, 255, 0.4)";
      c.beginPath();
      c.arc(wall.ax - 1.2, y - 1.4, 1.4, 0, Math.PI * 2);
      c.fill();
    }
  }
}

/** The slingshots: a shadow, an orange plastic cover printed HOT, and the white rubber on the kicking edge. */
function drawSlingBodies(c: CanvasRenderingContext2D) {
  SLINGS.forEach(({ a, b, c: corner }, i) => {
    const triangle = () => {
      c.beginPath();
      c.moveTo(...a);
      c.lineTo(...b);
      c.lineTo(...corner);
      c.closePath();
    };
    dropShadow(c, 3, 4, 3, () => {
      triangle();
      c.fillStyle = "rgba(0, 0, 0, 0.45)";
      c.fill();
    });

    triangle();
    const plastic = c.createLinearGradient(a[0], a[1], corner[0], b[1]);
    plastic.addColorStop(0, "#ffc46e");
    plastic.addColorStop(1, "#e0731f");
    c.fillStyle = plastic;
    c.fill();

    const middleX = (a[0] + b[0] + corner[0]) / 3;
    const middleY = (a[1] + b[1] + corner[1]) / 3;
    c.save();
    c.translate(middleX, middleY);
    c.rotate(i === 0 ? 1.1 : -1.1);
    text(c, "HOT", 0, 0, 10, "rgba(120, 30, 10, 0.75)");
    c.restore();
    screw(c, middleX + (i === 0 ? -6 : 6), middleY + 18, 1.6);

    c.lineCap = "round";
    c.lineWidth = 4.5;
    c.strokeStyle = "#f6f4ea";
    c.beginPath();
    c.moveTo(...a);
    c.lineTo(...corner);
    c.stroke();
  });
}

/** The metal skirts the burgers sit on, and their shadows. The burgers themselves light up, so they're redrawn. */
function drawBumperBases(c: CanvasRenderingContext2D) {
  for (const { x, y, r } of BUMPERS) {
    dropShadow(c, 3, 5, 4, () => {
      c.fillStyle = "rgba(0, 0, 0, 0.5)";
      c.beginPath();
      c.arc(x, y, r + 2, 0, Math.PI * 2);
      c.fill();
    });

    const skirt = c.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.4, x, y, r + 3);
    skirt.addColorStop(0, "#dfe8f2");
    skirt.addColorStop(0.7, C.metalLight);
    skirt.addColorStop(1, "#3a4659");
    c.fillStyle = skirt;
    c.beginPath();
    c.arc(x, y, r + 3, 0, Math.PI * 2);
    c.fill();
  }
}

/** What's printed on the playfield. Very official, all of it. */
function drawPrint(c: CanvasRenderingContext2D) {
  // The sign.
  neon(c, "KARA'S MIDNIGHT", PLAYFIELD_MIDDLE, 152, 15, C.lime);
  neon(c, "DRIVE-THRU", PLAYFIELD_MIDDLE, 174, 19, C.cheese);
  text(c, "OPEN 24/7*", PLAYFIELD_MIDDLE, 195, 11, C.tomato);
  text(c, "*except thursday", PLAYFIELD_MIDDLE, 208, 8.5, "rgba(255, 236, 200, 0.6)", "normal");

  drawWeb(c, 330, 150);

  // Pointing out what to shoot for, more or less.
  text(c, "BURGERS", 58, 221, 11, C.print);
  arrow(c, 32, 236, 0, 50, C.cheese);

  text(c, "JACKPOT", 322, 383, 11, C.print);
  text(c, "(probably)", 322, 418, 9, "rgba(255, 236, 200, 0.7)", "normal");
  arrow(c, 298, 400, 0, 52, C.mint);

  text(c, "DO NOT AIM HERE", PLAYFIELD_MIDDLE, 566, 10, C.print);
  arrow(c, PLAYFIELD_MIDDLE, 576, Math.PI / 2, 24, C.tomato);

  // The clock's housing; its digits and the days of the week are drawn every frame.
  const housing = c.createLinearGradient(0, 372, 0, 402);
  housing.addColorStop(0, "#4a596f");
  housing.addColorStop(1, "#1a212d");
  c.fillStyle = housing;
  c.beginPath();
  c.roundRect(PLAYFIELD_MIDDLE - 36, 372, 72, 30, 4);
  c.fill();
  c.fillStyle = "#07080c";
  c.fillRect(PLAYFIELD_MIDDLE - 31, 376, 62, 22);

  // Up the plunger lane, reading upwards.
  c.save();
  c.translate((LANE.left + LANE.right) / 2, 590);
  c.rotate(-Math.PI / 2);
  text(c, "PULL (gently)", 0, 0, 10, "rgba(255, 236, 200, 0.6)");
  c.restore();
}

/** Mr. Spicy's web in the corner, and Mr. Spicy: small, red, eight legs, one tiny hat. */
function drawWeb(c: CanvasRenderingContext2D, x: number, y: number) {
  c.save();
  c.strokeStyle = "rgba(220, 230, 255, 0.28)";
  c.lineWidth = 0.7;
  const spokes = 9;
  for (let n = 0; n < spokes; n++) {
    const angle = (n / spokes) * Math.PI * 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(angle) * 34, y + Math.sin(angle) * 34);
    c.stroke();
  }
  for (const ring of [8, 15, 22, 29]) {
    c.beginPath();
    for (let n = 0; n <= spokes; n++) {
      const angle = (n / spokes) * Math.PI * 2;
      // Sagging a little between spokes, the way webs do.
      const sag = n % 2 === 0 ? ring : ring * 0.92;
      c.lineTo(x + Math.cos(angle) * sag, y + Math.sin(angle) * sag);
    }
    c.stroke();
  }

  c.strokeStyle = "#2a0d0d";
  c.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    for (let leg = 0; leg < 4; leg++) {
      const lift = (leg - 1.5) * 0.45;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + side * 7, y - 6 + lift * 8, x + side * 11, y + lift * 10);
      c.stroke();
    }
  }
  const body = c.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5);
  body.addColorStop(0, "#ff8a6a");
  body.addColorStop(1, "#b0141c");
  c.fillStyle = body;
  c.beginPath();
  c.arc(x, y, 4.6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#fff";
  c.beginPath();
  c.arc(x - 1.6, y - 1, 1.1, 0, Math.PI * 2);
  c.arc(x + 1.6, y - 1, 1.1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#1a1a1a";
  c.fillRect(x - 2.6, y - 7.4, 5.2, 1.4);
  c.fillRect(x - 1.6, y - 10, 3.2, 2.8);
  text(c, "MR. SPICY", x, y + 42, 9, "rgba(255, 236, 200, 0.65)");
  text(c, "(do not hit)", x, y + 53, 8, "rgba(255, 236, 200, 0.55)", "normal");
  c.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// What moves or lights up, drawn every frame.

const ARC_BULBS = 23;
const ARC_BULB_RADIUS = ARC.r - 16;

/**
 * The bulbs around the dome. Waiting on the plunger, they chase round like an arcade asking for coins. In play,
 * a slow sparkle. After a bonus, all of them, flashing.
 */
function drawArcBulbs(c: CanvasRenderingContext2D, game: Game) {
  const bonus = game.time - game.bonusAt < BONUS_FLASH_SECONDS;
  const attract = !bonus && ballOnPlunger(game);
  const chase = Math.floor(game.time * 14);
  const sparkle = Math.floor(game.time * 3);
  for (let i = 0; i < ARC_BULBS; i++) {
    const angle = Math.PI + 0.14 + ((Math.PI - 0.28) * i) / (ARC_BULBS - 1);
    const x = ARC.x + ARC_BULB_RADIUS * Math.cos(angle);
    const y = ARC.y + ARC_BULB_RADIUS * Math.sin(angle);
    const color = i % 3 === 0 ? C.tomato : i % 3 === 1 ? C.cheese : C.lime;
    let glow = 0;
    if (bonus) glow = Math.floor(game.time * 8) % 2 === 0 ? 1 : 0.2;
    else if (attract) glow = (i + chase) % 5 === 0 ? 1 : (i + chase) % 5 === 1 ? 0.35 : 0;
    else glow = (i * 7 + sparkle) % 9 === 0 ? 0.7 : 0;
    bulb(c, x, y, 3.2, color, glow);
  }
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const THURSDAY = 3;
const DAY_SPACING = 22;
const DAYS_LEFT = PLAYFIELD_MIDDLE - 3 * DAY_SPACING;

/** Monday first, matching DAYS. Looked up once: nobody plays pinball past midnight. (Kara does.) */
const TODAY = (new Date().getDay() + 6) % 7;

/** It's always nearly 4:20. The colon blinks; the week has no Thursday. */
function drawClock(c: CanvasRenderingContext2D, game: Game) {
  const colon = Math.floor(game.time * 2) % 2 === 0;
  c.save();
  c.font = `bold 17px Consolas, "Courier New", monospace`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "rgba(255, 81, 89, 0.13)";
  c.fillText("88:88", PLAYFIELD_MIDDLE, 388);
  c.fillStyle = C.tomato;
  c.fillText(colon ? "04:19" : "04 19", PLAYFIELD_MIDDLE, 388);
  c.restore();

  DAYS.forEach((day, i) => {
    const x = DAYS_LEFT + i * DAY_SPACING;
    bulb(c, x, 418, 5, C.cheese, i === TODAY && i !== THURSDAY ? 0.9 : 0);
    text(c, day, x, 432, 7.5, C.print);
  });

  // Thursday, taped over. A bit crooked, done in a hurry.
  c.save();
  c.translate(DAYS_LEFT + THURSDAY * DAY_SPACING, 425);
  c.rotate(-0.25);
  c.fillStyle = "#0a0a0a";
  c.fillRect(-13, -11, 26, 23);
  c.fillStyle = "rgba(255, 255, 255, 0.12)";
  c.fillRect(-13, -11, 26, 3);
  c.restore();
}

/** The 4, 2, 0 lanes at the top, and the multiplier lights above the flippers. */
function drawLights(c: CanvasRenderingContext2D, game: Game) {
  LANES.forEach((lane, i) => {
    const lit = game.lanesLit[i];
    bulb(c, lane.x, lane.y, 8, C.cheese, lit ? 1 : 0);
    text(c, LANE_LABELS[i], lane.x, lane.y + 0.5, 10, lit ? "#5a2c00" : "#ffe2b8");
  });
  [2, 3, 4, 5].forEach((n, i) => {
    const x = PLAYFIELD_MIDDLE - 42 + i * 28;
    const lit = game.multiplier >= n;
    bulb(c, x, 545, 8, C.mint, lit ? 1 : 0);
    text(c, `${n}x`, x, 545.5, 9, lit ? "#073b30" : "#d2fff3");
  });
}

function drawTargets(c: CanvasRenderingContext2D, game: Game) {
  TARGETS.forEach((target, i) => {
    const down = game.targetsDown[i];
    const top = target.ay - 1;
    const height = target.by - target.ay + 2;
    const lightY = (target.ay + target.by) / 2;
    bulb(c, target.ax + 20, lightY, 7.5, C.lime, down ? 1 : 0);
    text(c, TARGET_LETTERS[i], target.ax + 20, lightY + 0.5, 9, down ? "#1d3a00" : "#e6ffcc");
    if (down) {
      c.fillStyle = "rgba(0, 0, 0, 0.5)";
      c.fillRect(target.ax - 3, top, 6, height);
      return;
    }
    c.fillStyle = "rgba(0, 0, 0, 0.4)";
    c.fillRect(target.ax - 1, top + 3, 6, height);
    const face = c.createLinearGradient(target.ax - 3, 0, target.ax + 3, 0);
    face.addColorStop(0, "#8e1b22");
    face.addColorStop(0.5, C.tomato);
    face.addColorStop(1, "#b52a31");
    c.fillStyle = face;
    c.fillRect(target.ax - 3, top, 6, height);
    c.fillStyle = "rgba(255, 255, 255, 0.55)";
    c.fillRect(target.ax - 1.5, top + 2, 1, height - 4);
  });
}

function drawSlingGlow(c: CanvasRenderingContext2D, game: Game) {
  SLINGS.forEach(({ a, c: corner }, i) => {
    const age = game.time - game.slingHits[i];
    if (age > HIT_GLOW) return;
    const fade = 1 - age / HIT_GLOW;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(...a);
    c.lineTo(...corner);
    c.lineWidth = 12;
    c.strokeStyle = withAlpha(C.cheese, 0.35 * fade);
    c.stroke();
    c.lineWidth = 5;
    c.strokeStyle = withAlpha("#fff6d8", fade);
    c.stroke();
  });
}

const SEEDS = [
  [-8, -7, 0.4],
  [3, -10, -0.3],
  [9, -2, 1.1],
  [-2, 1, 0.2],
  [-10, 4, -0.8],
  [5, 7, 0.6],
] as const;

/** A burger from above, sitting on its metal skirt: lettuce, cheese, a glossy bun. Lit up for a moment when hit. */
function drawBumpers(c: CanvasRenderingContext2D, game: Game) {
  BUMPERS.forEach((bumper, i) => {
    const age = game.time - game.bumperHits[i];
    const lit = age < HIT_GLOW;
    const { x, y, r } = bumper;

    c.save();
    c.translate(x, y);
    if (lit) {
      const ring = c.createRadialGradient(0, 0, r, 0, 0, r + 14);
      ring.addColorStop(0, withAlpha(C.cheese, 0.8 * (1 - age / HIT_GLOW)));
      ring.addColorStop(1, withAlpha(C.cheese, 0));
      c.fillStyle = ring;
      c.beginPath();
      c.arc(0, 0, r + 14, 0, Math.PI * 2);
      c.fill();
      c.scale(1.06, 1.06);
    }

    // Lettuce, a wavy ring.
    c.fillStyle = "#4fae3a";
    c.beginPath();
    for (let n = 0; n <= 36; n++) {
      const angle = (n / 36) * Math.PI * 2;
      const wave = r - 1 + (n % 2 === 0 ? 1.5 : -1);
      c.lineTo(Math.cos(angle) * wave, Math.sin(angle) * wave);
    }
    c.fill();

    // Cheese, a square turned a little, its corners showing.
    c.save();
    c.rotate(0.3 + i);
    c.fillStyle = "#f5c518";
    const cheese = r * 0.78;
    c.fillRect(-cheese, -cheese, cheese * 2, cheese * 2);
    c.restore();

    // The bun: a dome, darker at its rim, with a hard shine.
    const bun = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 0.86);
    bun.addColorStop(0, lit ? "#ffe9c0" : "#ffd08a");
    bun.addColorStop(0.55, C.cheese);
    bun.addColorStop(0.85, "#c46a1e");
    bun.addColorStop(1, "#7a3a0c");
    c.fillStyle = bun;
    c.beginPath();
    c.arc(0, 0, r * 0.84, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "#fff6e0";
    for (const [sx, sy, turn] of SEEDS) {
      c.beginPath();
      c.ellipse(sx, sy, 2, 1, turn, 0, Math.PI * 2);
      c.fill();
    }

    c.strokeStyle = "rgba(255, 255, 255, 0.75)";
    c.lineWidth = 2;
    c.lineCap = "round";
    c.beginPath();
    c.arc(0, 0, r * 0.66, Math.PI * 1.1, Math.PI * 1.45);
    c.stroke();
    c.restore();
  });
}

function drawPlunger(c: CanvasRenderingContext2D, game: Game) {
  const left = LANE.left + 3;
  const width = LANE.right - LANE.left - 6;
  const top = LANE.floor + game.charge * PLUNGER_TRAVEL;

  // The spring, squashed as it's pulled.
  c.strokeStyle = C.metalLight;
  c.lineWidth = 1.5;
  c.beginPath();
  const coils = 7;
  const springTop = top + 8;
  const springHeight = HEIGHT - springTop;
  for (let n = 0; n <= coils * 2; n++) {
    c.lineTo(n % 2 === 0 ? left + 2 : left + width - 2, springTop + (springHeight * n) / (coils * 2));
  }
  c.stroke();

  const head = c.createLinearGradient(left, 0, left + width, 0);
  head.addColorStop(0, "#5a6a80");
  head.addColorStop(0.45, "#f2f6fb");
  head.addColorStop(1, "#4a586c");
  c.fillStyle = head;
  c.fillRect(left, top, width, 8);
  c.fillStyle = C.tomato;
  c.fillRect(left, top, width, 2);
}

function drawFlippers(c: CanvasRenderingContext2D, game: Game) {
  game.flippers.forEach((flipper, i) => {
    const pivot = FLIPPERS[i];
    const fat = FLIPPER_RADIUS + 2;
    const thin = FLIPPER_RADIUS - 2;
    const outline = () => {
      c.beginPath();
      c.arc(0, 0, fat, Math.PI / 2, -Math.PI / 2);
      c.lineTo(FLIPPER_LENGTH, -thin);
      c.arc(FLIPPER_LENGTH, 0, thin, -Math.PI / 2, Math.PI / 2);
      c.closePath();
    };

    c.save();
    c.translate(pivot.x + 2, pivot.y + 3);
    c.rotate(flipper.angle);
    outline();
    c.fillStyle = "rgba(0, 0, 0, 0.4)";
    c.fill();
    c.restore();

    c.save();
    c.translate(pivot.x, pivot.y);
    c.rotate(flipper.angle);
    outline();
    const body = c.createLinearGradient(0, -fat, 0, fat);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.5, "#e4e8ee");
    body.addColorStop(1, "#9aa6b6");
    c.fillStyle = body;
    c.fill();
    c.lineWidth = 2.2;
    c.strokeStyle = C.tomato;
    c.stroke();
    screw(c, 0, 0, 2.6);
    c.restore();
  });
}

const SPECKS = [
  [0.45, 0.2, 1.4],
  [-0.35, 0.45, 1.1],
  [0.1, -0.5, 1.2],
  [-0.5, -0.15, 0.9],
] as const;

/** A meatball. It has dreams. */
function drawBall(c: CanvasRenderingContext2D, x: number, y: number, spin: number) {
  const r = BALL_RADIUS;
  c.save();
  c.translate(x, y);

  c.fillStyle = "rgba(0, 0, 0, 0.4)";
  c.beginPath();
  c.ellipse(2.5, 3.5, r, r * 0.9, 0, 0, Math.PI * 2);
  c.fill();

  const meat = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  meat.addColorStop(0, "#d48650");
  meat.addColorStop(0.6, "#8a4422");
  meat.addColorStop(1, "#4f2510");
  c.fillStyle = meat;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();

  // Bits of herb, turning with it.
  c.save();
  c.rotate(spin);
  c.fillStyle = "#3f6b2a";
  for (const [sx, sy, size] of SPECKS) {
    c.beginPath();
    c.arc(sx * r, sy * r, size, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();

  c.fillStyle = "rgba(255, 255, 255, 0.6)";
  c.beginPath();
  c.ellipse(-r * 0.35, -r * 0.4, r * 0.32, r * 0.2, -0.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
