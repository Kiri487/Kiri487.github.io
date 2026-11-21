/*
 * The zones the backrooms are done up in (map.ts works out which is where), and how much more or less of each thing
 * turns up in each. Still Level 0 everywhere, just built at different times by different nobodies, for different
 * uses: an office wing has its desks, the tiles by the toilets their wet floor signs. Weights, not rules, so now and
 * then something turns up where it has no business being.
 */

/** Yellow wallpaper, the damp carpet: most of it, and a little of everything, thinly. */
export const ZONE_YELLOW = 0;
/** Faded striped wallpaper over wood panelling, an old dark red carpet: like an old house. */
export const ZONE_HOUSE = 1;
/** Off-white paint, a black rubber skirting, grey-blue carpet tiles: a colder office. */
export const ZONE_OFFICE = 2;
/** Plasterboard never painted, its seams taped and its screws showing; bare concrete. */
export const ZONE_DRYWALL = 3;
/** White tiles all the way up, a checked lino floor: by the toilets and kitchens. */
export const ZONE_TILES = 4;

/**
 * How often something turns up in each zone, against its usual chance, in zone order: yellow, house, office, drywall,
 * tiles. 1 is the usual, 2 twice as often, 0 never.
 */
export type ZoneWeights = readonly [number, number, number, number, number];

/** The most any zone has: a die past the usual chance times this is out everywhere, without asking where it is. */
export const heaviest = (weights: ZoneWeights) => Math.max(...weights);

/**
 * How an area is laid out. Long corridors like an old block of flats; cells most of all in the office (cubicles), by
 * the tiles (toilet stalls) and in the drywall (partitions put up and never finished).
 */
export const CORRIDOR_WEIGHTS: ZoneWeights = [1, 2, 1, 1, 1];
export const CELLS_WEIGHTS: ZoneWeights = [1, 0.5, 2.5, 1.5, 2];

/**
 * Special rooms. Pit rooms are only ever in the yellow; heavier there so there are as many as before zones had a say
 * (yellow is a little under 6 in 10 of the zones). A burger room can be anywhere, papered like its zone.
 */
export const PIT_ROOM_WEIGHTS: ZoneWeights = [1.7, 0, 0, 0, 0];
export const BURGER_ROOM_WEIGHTS: ZoneWeights = [1, 1, 1, 1, 1];

/** The junk lying about (junk.ts), by kind. */
export const JUNK_WEIGHTS = {
  monitor: [1, 0.3, 2, 0.5, 0.2],
  chair: [1, 1, 1, 1, 1],
  sign: [1, 0.5, 0.5, 2, 1],
  door: [1, 2, 0.5, 1, 0.5],
  exit: [1, 1, 1, 1, 1],
  wet: [1, 0.3, 0.5, 0.5, 3],
  cabinet: [1, 0.3, 2, 0.5, 0.2],
  desk: [1, 0.3, 2, 0.5, 0.2],
  socket: [1, 1, 1, 1, 1],
  burger: [1, 1, 1, 1, 1],
} as const satisfies Record<string, ZoneWeights>;

/** Writing on the walls (graffiti.ts): most on bare plasterboard. The warnings outside pit rooms aren't weighed. */
export const GRAFFITI_WEIGHTS: ZoneWeights = [1, 0.5, 0.5, 2, 1];

/**
 * Posters put up anywhere (posters.ts), on the walls and the ceiling; none on the tiles, where nothing sticks. Those
 * put up near a statue, by its believers, aren't weighed: they go where the statue is.
 */
export const POSTER_WEIGHTS: ZoneWeights = [1, 0.5, 1.5, 0.5, 0];
