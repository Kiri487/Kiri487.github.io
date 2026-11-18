import type { Statue } from "./map";

/*
 * The stone cat: a low-poly mesh built offline from Kiri's drawing, drawn the way an old console would. Vertices
 * snap to whole pixels (the wobble), textures are mapped without perspective correction (the swim), and each face
 * gets one brightness. The leaf on its chest glows a little in the dark.
 */

export interface StatueModel {
  /**
   * 16 numbers per triangle: three corners of (x, y, z, u, v), then flags. x runs across the statue, y up, z out of
   * its front; u, v are atlas pixels. Flag 1: transparent where the atlas is; flag 2: drawn from both sides.
   */
  tris: readonly number[];
  /** Atlas size in pixels. */
  atlasWidth: number;
  atlasHeight: number;
  /** Colour for the parts the atlas leaves blank. */
  stone: readonly [number, number, number];
}

/** The atlas pixels, RGBA. Alpha 128–254 marks the glowing leaf; 64–127, a part lit by itself, like a screen. */
export interface StatueSkin {
  data: Uint8ClampedArray;
}

/** A statue's triangles turned and moved to where it stands, ready to draw. */
export interface StatueMesh {
  x: number;
  y: number;
  count: number;
  /** World x, y, z and atlas u, v for each corner: 15 numbers per triangle. */
  corners: Float32Array;
  normals: Float32Array;
  centres: Float32Array;
  flags: Uint8Array;
}

/** One thing to draw this frame: a mesh, and the atlas it is painted from. */
export interface Prop {
  mesh: StatueMesh;
  model: StatueModel;
  skin: StatueSkin;
  /** Cut off below the floor and above the ceiling, for things stuck through them. */
  clip?: boolean;
}

/** How close the player can come to a statue's middle. */
export const STATUE_RADIUS = 0.36;

export function placeStatue(model: StatueModel, statue: Statue): StatueMesh {
  const src = model.tris;
  const count = src.length / 16;
  const fx = Math.cos(statue.facing);
  const fy = Math.sin(statue.facing);
  // The statue's own x axis, in the world: a quarter turn from where it faces.
  const rx = fy;
  const ry = -fx;
  const corners = new Float32Array(count * 15);
  const normals = new Float32Array(count * 3);
  const centres = new Float32Array(count * 3);
  const flags = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 16;
    const q = i * 15;
    for (let k = 0; k < 3; k++) {
      const X = src[o + k * 5];
      const Y = src[o + k * 5 + 1];
      const Z = src[o + k * 5 + 2];
      corners[q + k * 5] = statue.x + X * rx + Z * fx;
      corners[q + k * 5 + 1] = statue.y + X * ry + Z * fy;
      corners[q + k * 5 + 2] = Y;
      corners[q + k * 5 + 3] = src[o + k * 5 + 3];
      corners[q + k * 5 + 4] = src[o + k * 5 + 4];
    }
    const ax = src[o + 5] - src[o];
    const ay = src[o + 6] - src[o + 1];
    const az = src[o + 7] - src[o + 2];
    const bx = src[o + 10] - src[o];
    const by = src[o + 11] - src[o + 1];
    const bz = src[o + 12] - src[o + 2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    normals[i * 3] = nx * rx + nz * fx;
    normals[i * 3 + 1] = nx * ry + nz * fy;
    normals[i * 3 + 2] = ny;
    centres[i * 3] = (corners[q] + corners[q + 5] + corners[q + 10]) / 3;
    centres[i * 3 + 1] = (corners[q + 1] + corners[q + 6] + corners[q + 11]) / 3;
    centres[i * 3 + 2] = (corners[q + 2] + corners[q + 7] + corners[q + 12]) / 3;
    flags[i] = src[o + 15];
  }
  return { x: statue.x, y: statue.y, count, corners, normals, centres, flags };
}

/** What drawStatue needs to know about the frame. */
export interface StatueFrame {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  /** Wall distance per screen column: the statue hides behind nearer walls. */
  wallDepth: Float32Array;
  /** Statue depth per pixel, so its own faces cover each other properly. Cleared once per frame by the caller. */
  depth: Float32Array;
  camX: number;
  camY: number;
  eye: number;
  dirX: number;
  dirY: number;
  focal: number;
  horizon: number;
  fogK: number;
  fog: readonly [number, number, number];
}

const screen = new Float32Array(9);

export function drawStatue(
  f: StatueFrame,
  mesh: StatueMesh,
  model: StatueModel,
  skin: StatueSkin,
  light: number,
  clip = false,
) {
  const ahead = (mesh.x - f.camX) * f.dirX + (mesh.y - f.camY) * f.dirY;
  if (ahead < -0.6 || ahead > 27) return;
  const { pixels: d, width: W, height: H, wallDepth, depth, focal, horizon, dirX: dx, dirY: dy, camX, camY, eye } = f;
  const { corners: v, normals: nr, centres: ct, flags } = mesh;
  const tex = skin.data;
  const AW = model.atlasWidth;
  const AH = model.atlasHeight;
  const [SR, SG, SB] = model.stone;
  const [FR, FG, FB] = f.fog;
  let vx = camX - mesh.x;
  let vy = camY - mesh.y;
  const vl = Math.hypot(vx, vy) || 1;
  vx /= vl;
  vy /= vl;
  for (let i = 0; i < mesh.count; i++) {
    const flag = flags[i];
    const nx = nr[i * 3];
    const ny = nr[i * 3 + 1];
    const nz = nr[i * 3 + 2];
    const facing = nx * (camX - ct[i * 3]) + ny * (camY - ct[i * 3 + 1]) + nz * (eye - ct[i * 3 + 2]);
    if (facing <= 0 && !(flag & 2)) continue;
    const q = i * 15;
    let tooNear = false;
    for (let j = 0; j < 3; j++) {
      const rx = v[q + j * 5] - camX;
      const ry = v[q + j * 5 + 1] - camY;
      const dep = rx * dx + ry * dy;
      if (dep < 0.05) {
        tooNear = true;
        break;
      }
      // Corners snap to whole pixels, which is where the wobble comes from.
      screen[j * 3] = Math.round(W / 2 + ((-rx * dy + ry * dx) / dep) * focal);
      screen[j * 3 + 1] = Math.round(horizon - ((v[q + j * 5 + 2] - eye) * focal) / dep);
      screen[j * 3 + 2] = dep;
    }
    if (tooNear) continue;
    const x0 = screen[0], y0 = screen[1], d0 = screen[2];
    const x1 = screen[3], y1 = screen[4], d1 = screen[5];
    const x2 = screen[6], y2 = screen[7], d2 = screen[8];
    const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (den > -0.5 && den < 0.5) continue;
    const id = 1 / den;
    let bx0 = Math.min(x0, x1, x2);
    let bx1 = Math.max(x0, x1, x2);
    let by0 = Math.min(y0, y1, y2);
    let by1 = Math.max(y0, y1, y2);
    if (bx0 < 0) bx0 = 0;
    if (by0 < 0) by0 = 0;
    if (bx1 > W - 1) bx1 = W - 1;
    if (by1 > H - 1) by1 = H - 1;
    if (bx0 > bx1 || by0 > by1) continue;
    const side = facing > 0 ? 1 : -1;
    const shade = (0.5 + 0.3 * Math.max(0, nz) + 0.3 * Math.max(0, (nx * vx + ny * vy) * side)) * light;
    const avg = (d0 + d1 + d2) / 3;
    let fog = 1 - Math.exp(-avg * f.fogK);
    const far = (avg - 20) / 8;
    if (far > fog) fog = far;
    if (fog > 1) fog = 1;
    const sh = shade * (1 - fog);
    const ar = FR * fog, ag = FG * fog, ab = FB * fog;
    const glow = 0.55 * (1 - fog * 0.5);
    const u0 = v[q + 3], v0 = v[q + 4], u1 = v[q + 8], v1 = v[q + 9], u2 = v[q + 13], v2 = v[q + 14];
    for (let y = by0; y <= by1; y++) {
      const yc = y + 0.5;
      for (let x = bx0; x <= bx1; x++) {
        const xc = x + 0.5;
        const l0 = ((y1 - y2) * (xc - x2) + (x2 - x1) * (yc - y2)) * id;
        const l1 = ((y2 - y0) * (xc - x2) + (x0 - x2) * (yc - y2)) * id;
        const l2 = 1 - l0 - l1;
        if (l0 < 0 || l1 < 0 || l2 < 0) continue;
        const z = l0 * d0 + l1 * d1 + l2 * d2;
        if (z >= wallDepth[x]) continue;
        // Its height in the room at this pixel: the floor and ceiling hide what's through them.
        if (clip) {
          const height = eye - ((yc - horizon) * z) / focal;
          if (height < 0 || height > 1) continue;
        }
        const zi = y * W + x;
        if (z >= depth[zi]) continue;
        // Affine texture mapping on purpose: no perspective correction.
        let tu = Math.floor(l0 * u0 + l1 * u1 + l2 * u2);
        let tv = Math.floor(l0 * v0 + l1 * v1 + l2 * v2);
        if (tu < 0) tu = 0;
        if (tu > AW - 1) tu = AW - 1;
        if (tv < 0) tv = 0;
        if (tv > AH - 1) tv = AH - 1;
        const ti = (tv * AW + tu) * 4;
        const a = tex[ti + 3];
        let r: number, g: number, b: number;
        if (a === 0) {
          if (flag & 1) continue;
          r = SR;
          g = SG;
          b = SB;
        } else {
          r = tex[ti];
          g = tex[ti + 1];
          b = tex[ti + 2];
        }
        depth[zi] = z;
        const o = zi * 4;
        if (a >= 64 && a < 128) {
          // Lit by itself, whatever the light: dimmed only by the fog.
          r = r * (1 - fog) + ar;
          g = g * (1 - fog) + ag;
          b = b * (1 - fog) + ab;
        } else {
          r = r * sh + ar;
          g = g * sh + ag;
          b = b * sh + ab;
        }
        if (a >= 128 && a < 255) {
          const e = ((a - 128) / 126) * glow;
          r += 26 * e;
          g += 150 * e;
          b += 70 * e;
        }
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = b;
      }
    }
  }
}
