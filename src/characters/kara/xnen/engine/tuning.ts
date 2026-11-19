/** The numbers that set how the place looks and plays. Kiri tunes them in the dev panel; visitors get the defaults. */
export interface Tuning {
  /** Short side of the picture, in pixels, before it's stretched to the screen. */
  res: number;
  /** 0–100. */
  fog: number;
  /** Colour saturation, in percent: under 100 washes the yellow out, over 100 deepens it. */
  yellow: number;
  /** Overall light, in percent. */
  bright: number;
  /** Share of ceiling lights that are dead, in percent. */
  dead: number;
  /** Field of view, in degrees. */
  fov: number;
  /** The camera bobs while walking. Never with reduced motion. */
  bob: boolean;
  hum: boolean;
  /** One statue per square region this many cells wide. */
  region: number;
  /** The nearest statue is this many cells from the spawn point in a straight line, at least and at most. */
  spawnMin: number;
  spawnMax: number;
  /** Stretches the distances at which the timecode gains digits, in percent. */
  compass: number;
  /** How near a statue's middle, and XN's, the visitor has to be for [ E ], in hundredths of a cell. */
  statueReach: number;
  xnReach: number;
  /** How many of the cult's posters there are, in percent: everywhere, and the extra near statues. */
  posters: number;
  posterNear: number;
  /** How much of XN's graffiti there is, in percent. */
  graffiti: number;
}

export const DEFAULT_TUNING: Tuning = {
  res: 360,
  fog: 35,
  yellow: 100,
  bright: 100,
  dead: 22,
  fov: 78,
  bob: true,
  hum: true,
  region: 100,
  spawnMin: 70,
  spawnMax: 110,
  compass: 100,
  statueReach: 90,
  xnReach: 80,
  posters: 100,
  posterNear: 100,
  graffiti: 100,
};
