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

/**
 * Rooms fitted out for a use (map.ts, junk.ts): a whole lattice room walled in, with a door or two, its furniture
 * where it belongs. Each kind keeps mostly to its zone; the yellow has a few of every kind. A workroom: one desk and
 * whoever sat at it, mostly in the office wing.
 */
export const WORKROOM_WEIGHTS: ZoneWeights = [0.25, 0.3, 2, 0.3, 0.2];
/** A camp, where one of the lost lived for a while: mostly in the old house, where it's most like home. */
export const CAMP_WEIGHTS: ZoneWeights = [0.25, 3, 0.2, 0.6, 0.2];
/** A pantry, a little kitchen: mostly by the tiles, now and then off the office wing. */
export const PANTRY_WEIGHTS: ZoneWeights = [0.25, 0.3, 0.6, 0.3, 3];
/** A storeroom: in the unfinished plasterboard most. */
export const STORAGE_WEIGHTS: ZoneWeights = [0.25, 0.3, 0.3, 3, 0.3];
/** A meeting room: the office wing's. */
export const MEETING_WEIGHTS: ZoneWeights = [0.25, 0.2, 2, 0.3, 0.2];

/**
 * What a big room (a block of lattice rooms knocked through) has in it (map.ts): a forest of pillars like a car park
 * with no cars, mostly in the yellow and the bare plasterboard; a floor of office cubicles, the office wing's; every
 * light out but one, anywhere. The rest are left empty, which is weighed the same everywhere.
 */
export const PILLAR_HALL_WEIGHTS: ZoneWeights = [1.3, 0.6, 0.8, 1.5, 0.8];
export const CUBICLE_HALL_WEIGHTS: ZoneWeights = [0.6, 0.2, 3, 0.8, 0.3];
export const LAMP_HALL_WEIGHTS: ZoneWeights = [1, 1.5, 0.7, 1, 1];

/**
 * The junk lying about (junk.ts), by kind. Boxes left by whoever never finished the plasterboard; mugs where people
 * worked and made their tea; empty tins where someone lived, in the old house.
 */
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
  box: [1, 0.5, 0.7, 3, 0.5],
  mug: [1, 0.4, 2.5, 0.5, 2],
  tin: [1, 2.5, 0.3, 1, 0.3],
} as const satisfies Record<string, ZoneWeights>;

/**
 * How many of the desks and chairs (lying about, or in a fitted room) are the office kind, steel and laminate and
 * fabric, not wood: a share, not a weight, mostly in the office wing.
 */
export const OFFICE_FURNITURE: ZoneWeights = [0.15, 0.05, 0.85, 0.3, 0.2];

/**
 * How many of the doors (lying about, or flat against a dead end's wall) are red fire doors, not wooden ones: a
 * share, not a weight. Hardly any in the old house; most where offices and kitchens were fitted out to code.
 */
export const FIRE_DOOR: ZoneWeights = [0.3, 0.05, 0.7, 0.5, 0.6];

/**
 * What's at a dead end (map.ts), against its usual chance: a door that goes nowhere anywhere; a chair facing the wall
 * most in the old house; a vending machine where people worked and took their breaks, hardly ever in the house.
 */
export const DEAD_END_WEIGHTS = {
  door: [1, 1.2, 1, 1, 1],
  chair: [1, 1.6, 0.8, 1, 0.8],
  vending: [1, 0.15, 2, 0.5, 1.5],
} as const satisfies Record<string, ZoneWeights>;

/**
 * The ceiling lights, against the usual: how many are out, how many whole stretches are mostly dark, how many of
 * those still on flicker. The office wing kept up best; the old house's wiring is going; the plasterboard was never
 * finished, its lights never all put in; the tiles' tubes flicker, as they do by toilets.
 */
export const LIGHTS_DEAD: ZoneWeights = [1, 1.3, 0.5, 1.3, 0.8];
export const DARK_STRETCHES: ZoneWeights = [1, 1, 0.5, 1.35, 0.8];
export const LIGHTS_FLICKER: ZoneWeights = [1, 1.5, 0.4, 1, 1.6];

/** Writing on the walls (graffiti.ts): most on bare plasterboard. The warnings outside pit rooms aren't weighed. */
export const GRAFFITI_WEIGHTS: ZoneWeights = [1, 0.5, 0.5, 2, 1];

/**
 * Posters put up anywhere (posters.ts), on the walls and the ceiling; none on the tiles, where nothing sticks. Those
 * put up near a statue, by its believers, aren't weighed: they go where the statue is.
 */
export const POSTER_WEIGHTS: ZoneWeights = [1, 0.5, 1.5, 0.5, 0];
