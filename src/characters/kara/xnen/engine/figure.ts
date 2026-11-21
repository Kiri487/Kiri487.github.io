import type { StatueMesh, StatueModel } from "./statue";

/*
 * A model with a skeleton: its vertices follow bones, so it can be posed. It is drawn exactly like the stone cat
 * (drawStatue), from a mesh worked out again each time the pose changes.
 *
 * A figure's own space: x across it (the viewer's right when it faces you), y up, z out of its front, feet on the
 * floor, in the same units as the map.
 */

/**
 * Where a figure stands and which way it's turned, in the world: its feet at (x, y, z), its own up along `up` and its
 * front along `front`, both unit vectors at right angles. Up needn't be the world's: a figure can stand on a ceiling
 * or a wall.
 */
export interface Placement {
  x: number;
  y: number;
  z: number;
  up: readonly [number, number, number];
  front: readonly [number, number, number];
}

export interface FigureBone {
  name: string;
  /** Index of the bone this one hangs from; -1 for the root. Parents always come first. */
  parent: number;
  /** Where its joint sits when the figure is at rest. */
  x: number;
  y: number;
  z: number;
}

export interface FigureModel {
  verts: number;
  faces: number;
  /** x, y, z per vertex, at rest. */
  positions: Float32Array;
  /** Atlas pixels, u, v per vertex. */
  uvs: Float32Array;
  /** Four bones per vertex and how much each pulls, out of 255. */
  joints: Uint8Array;
  weights: Uint8Array;
  /** Three vertices per face. */
  indices: Uint16Array;
  bones: FigureBone[];
  atlasWidth: number;
  atlasHeight: number;
}

interface FigureHeader {
  verts: number;
  tris: number;
  atlas: [number, number];
  scale: number;
  bones: { name: string; parent: number; at: [number, number, number] }[];
}

/** Reads the file written by the prototype's export_game.py, where the layout is described. */
export function parseFigure(buffer: ArrayBuffer): FigureModel {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "XNM1") throw new Error("Not a figure file");
  const headerLength = view.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerLength))) as FigureHeader;
  const { verts, tris: faces } = header;
  let at = 8 + headerLength;
  const take = (bytes: number) => {
    const start = at;
    at += Math.ceil(bytes / 4) * 4;
    return start;
  };
  const rawPositions = new Int16Array(buffer, take(verts * 6), verts * 3);
  const rawUvs = new Uint16Array(buffer, take(verts * 4), verts * 2);
  const joints = new Uint8Array(buffer, take(verts * 4), verts * 4);
  const weights = new Uint8Array(buffer, take(verts * 4), verts * 4);
  const indices = new Uint16Array(buffer, take(faces * 6), faces * 3);
  const positions = new Float32Array(verts * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = rawPositions[i] * header.scale;
  const uvs = new Float32Array(verts * 2);
  for (let i = 0; i < verts; i++) {
    uvs[i * 2] = (rawUvs[i * 2] / 65535) * header.atlas[0];
    uvs[i * 2 + 1] = (rawUvs[i * 2 + 1] / 65535) * header.atlas[1];
  }
  return {
    verts,
    faces,
    positions,
    uvs,
    joints,
    weights,
    indices,
    bones: header.bones.map((b) => ({ name: b.name, parent: b.parent, x: b.at[0], y: b.at[1], z: b.at[2] })),
    atlasWidth: header.atlas[0],
    atlasHeight: header.atlas[1],
  };
}

/** One figure standing somewhere: pose its bones with `turn`, then `place` it to get the mesh to draw. */
export class Figure {
  readonly model: FigureModel;
  /** What drawStatue wants to know about the atlas. */
  readonly look: StatueModel;
  private readonly names = new Map<string, number>();
  /** Each bone's turn about its own joint, a 3×3 matrix by rows. */
  private readonly turns: Float32Array;
  /** Each bone's whole movement: a 3×3 matrix by rows, then what it adds. */
  private readonly moves: Float32Array;
  private readonly posed: Float32Array;
  private readonly mesh: StatueMesh;
  /** Moves the whole figure within its own space, for poses that lower it (a crouch). */
  private readonly offset = [0, 0, 0];
  /** From its feet to the top of its head. */
  readonly height: number;

  constructor(model: FigureModel) {
    this.model = model;
    this.look = { tris: [], atlasWidth: model.atlasWidth, atlasHeight: model.atlasHeight, stone: [0, 0, 0] };
    model.bones.forEach((bone, i) => this.names.set(bone.name, i));
    let top = 0;
    for (let i = 1; i < model.positions.length; i += 3) top = Math.max(top, model.positions[i]);
    this.height = top;
    this.turns = new Float32Array(model.bones.length * 9);
    this.moves = new Float32Array(model.bones.length * 12);
    this.posed = new Float32Array(model.verts * 3);
    this.mesh = {
      x: 0,
      y: 0,
      count: model.faces,
      corners: new Float32Array(model.faces * 15),
      normals: new Float32Array(model.faces * 3),
      centres: new Float32Array(model.faces * 3),
      // Its hair is single sheets in places: every face shows from both sides.
      flags: new Uint8Array(model.faces).fill(2),
    };
    this.rest();
  }

  /** A bone's index, for `turn`. Throws on a name the model doesn't have, so a typo can't pass quietly. */
  bone(name: string): number {
    const index = this.names.get(name);
    if (index === undefined) throw new Error(`No bone called ${name}`);
    return index;
  }

  /** Every bone back where the model was made. */
  rest() {
    this.offset.fill(0);
    this.turns.fill(0);
    for (let i = 0; i < this.model.bones.length; i++) {
      this.turns[i * 9] = 1;
      this.turns[i * 9 + 4] = 1;
      this.turns[i * 9 + 8] = 1;
    }
  }

  /**
   * Turns a bone about its joint, in radians, measured along the figure's own axes whatever way the bone lies:
   * yaw about its height (positive swings its front toward its +x), pitch about its width (positive tips its top
   * forward), roll about its depth (positive tips its top toward its −x). Everything hanging from the bone follows.
   */
  turn(bone: number, yaw: number, pitch = 0, roll = 0) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    // yaw · pitch · roll
    const t = this.turns;
    const o = bone * 9;
    t[o] = cy * cr + sy * sp * sr;
    t[o + 1] = -cy * sr + sy * sp * cr;
    t[o + 2] = sy * cp;
    t[o + 3] = cp * sr;
    t[o + 4] = cp * cr;
    t[o + 5] = -sp;
    t[o + 6] = -sy * cr + cy * sp * sr;
    t[o + 7] = sy * sr + cy * sp * cr;
    t[o + 8] = cy * cp;
  }

  /** Moves the whole figure within its own space (y is up its height), on top of the bones' turns. */
  shift(x: number, y: number, z: number) {
    this.offset[0] = x;
    this.offset[1] = y;
    this.offset[2] = z;
  }

  /**
   * The posed figure, put where `at` says. The mesh is reused. Its `x` and `y` are the middle of the figure's
   * height, which is where its light is read and where it can be bumped into.
   */
  place(at: Placement): StatueMesh {
    this.solve();
    this.skin();
    const { indices, uvs } = this.model;
    const p = this.posed;
    const { corners, normals, centres } = this.mesh;
    const [ux, uy, uz] = at.up;
    const [fx, fy, fz] = at.front;
    // The figure's own x axis in the world, front × up, which keeps its faces wound the same way whatever way it's
    // turned. On the floor it's a quarter turn clockwise from where it faces.
    const rx = fy * uz - fz * uy;
    const ry = fz * ux - fx * uz;
    const rz = fx * uy - fy * ux;
    for (let i = 0; i < this.model.faces; i++) {
      const q = i * 15;
      for (let k = 0; k < 3; k++) {
        const vi = indices[i * 3 + k];
        const X = p[vi * 3];
        const Y = p[vi * 3 + 1];
        const Z = p[vi * 3 + 2];
        corners[q + k * 5] = at.x + X * rx + Y * ux + Z * fx;
        corners[q + k * 5 + 1] = at.y + X * ry + Y * uy + Z * fy;
        corners[q + k * 5 + 2] = at.z + X * rz + Y * uz + Z * fz;
        corners[q + k * 5 + 3] = uvs[vi * 2];
        corners[q + k * 5 + 4] = uvs[vi * 2 + 1];
      }
      const ax = corners[q + 5] - corners[q];
      const ay = corners[q + 6] - corners[q + 1];
      const az = corners[q + 7] - corners[q + 2];
      const bx = corners[q + 10] - corners[q];
      const by = corners[q + 11] - corners[q + 1];
      const bz = corners[q + 12] - corners[q + 2];
      // The model's faces wind the other way from the world's handedness here, hence b × a.
      const nx = by * az - bz * ay;
      const ny = bz * ax - bx * az;
      const nz = bx * ay - by * ax;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;
      centres[i * 3] = (corners[q] + corners[q + 5] + corners[q + 10]) / 3;
      centres[i * 3 + 1] = (corners[q + 1] + corners[q + 6] + corners[q + 11]) / 3;
      centres[i * 3 + 2] = (corners[q + 2] + corners[q + 7] + corners[q + 12]) / 3;
    }
    const half = this.height / 2;
    this.mesh.x = at.x + ux * half;
    this.mesh.y = at.y + uy * half;
    return this.mesh;
  }

  /**
   * Where a point of the model at rest, carried by `bone`, is in the figure's own space as it was last placed (its
   * bones' movements as worked out then).
   */
  carried(bone: number, x: number, y: number, z: number): [number, number, number] {
    const m = this.moves;
    const d = bone * 12;
    return [
      m[d] * x + m[d + 1] * y + m[d + 2] * z + m[d + 9],
      m[d + 3] * x + m[d + 4] * y + m[d + 5] * z + m[d + 10],
      m[d + 6] * x + m[d + 7] * y + m[d + 8] * z + m[d + 11],
    ];
  }

  /** Works each bone's whole movement out from its own turn and its parent's movement. */
  private solve() {
    const { bones } = this.model;
    const t = this.turns;
    const m = this.moves;
    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i];
      const o = i * 9;
      // Turning about the joint: x -> E x + (p − E p).
      const ox = bone.x - (t[o] * bone.x + t[o + 1] * bone.y + t[o + 2] * bone.z);
      const oy = bone.y - (t[o + 3] * bone.x + t[o + 4] * bone.y + t[o + 5] * bone.z);
      const oz = bone.z - (t[o + 6] * bone.x + t[o + 7] * bone.y + t[o + 8] * bone.z);
      const d = i * 12;
      if (bone.parent < 0) {
        for (let k = 0; k < 9; k++) m[d + k] = t[o + k];
        m[d + 9] = ox + this.offset[0];
        m[d + 10] = oy + this.offset[1];
        m[d + 11] = oz + this.offset[2];
        continue;
      }
      const s = bone.parent * 12;
      for (let r = 0; r < 3; r++) {
        const a = m[s + r * 3], b = m[s + r * 3 + 1], c = m[s + r * 3 + 2];
        m[d + r * 3] = a * t[o] + b * t[o + 3] + c * t[o + 6];
        m[d + r * 3 + 1] = a * t[o + 1] + b * t[o + 4] + c * t[o + 7];
        m[d + r * 3 + 2] = a * t[o + 2] + b * t[o + 5] + c * t[o + 8];
        m[d + 9 + r] = a * ox + b * oy + c * oz + m[s + 9 + r];
      }
    }
  }

  /** Moves every vertex with the bones that pull it. */
  private skin() {
    const { positions, joints, weights, verts } = this.model;
    const m = this.moves;
    const out = this.posed;
    for (let i = 0; i < verts; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      let sx = 0, sy = 0, sz = 0;
      for (let k = 0; k < 4; k++) {
        const w = weights[i * 4 + k];
        if (!w) continue;
        const d = joints[i * 4 + k] * 12;
        sx += w * (m[d] * x + m[d + 1] * y + m[d + 2] * z + m[d + 9]);
        sy += w * (m[d + 3] * x + m[d + 4] * y + m[d + 5] * z + m[d + 10]);
        sz += w * (m[d + 6] * x + m[d + 7] * y + m[d + 8] * z + m[d + 11]);
      }
      out[i * 3] = sx / 255;
      out[i * 3 + 1] = sy / 255;
      out[i * 3 + 2] = sz / 255;
    }
  }
}
