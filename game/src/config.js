// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. World units are metres: the ground is y = 0, the plane
// flies forward along +z, and x is lateral (positive to the pilot's right).

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Where the two runways sit. The mail run starts on runway one and must end on runway two. */
export const RUNWAY_START = { x: 0, zMin: -120, zMax: 520, halfWidth: 15 };
export const RUNWAY_END = { x: 0, zMin: 3900, zMax: 4400, halfWidth: 15 };

/** How many rings make the course, and how far apart they sit along the valley. */
export const RING_COUNT = 10;
export const RING_FIRST_Z = 620;
export const RING_SPACING = 330;
export const RING_RADIUS = 28;
export const RING_PERFECT_RADIUS = 10;

export const PLANE = {
  /** Speed in m/s at full and at idle throttle; below stall speed the plane sinks. */
  minSpeed: 25,
  maxSpeed: 118,
  stallSpeed: 32,
  /** Degrees of pitch the stick commands, nose up positive. */
  maxPitchUp: 22,
  maxPitchDown: 18,
  /** Degrees of bank the stick commands. */
  maxBank: 55,
  /** How fast pitch and bank chase the stick, in radians per second. */
  pitchRate: 1.5,
  bankRate: 2.1,
  /** Turn rate from bank: radians per second at tan(bank) = 1. */
  turnFactor: 0.22,
  /** Seconds of invulnerability after a ring graze is not a thing: n/a. */
};

export const FUEL = {
  start: 100,
  /** Units burned per second at idle, plus per unit of throttle. */
  idleBurn: 0.2,
  throttleBurn: 0.75,
  lowWarning: 25,
};

export const SCORE = {
  ring: 100,
  ringPerfect: 50,
  landing: 500,
  /** Time bonus: up to this many points, shrinking with elapsed seconds. */
  timeBonusMax: 300,
  timeBonusSeconds: 150,
  /** Fuel bonus: this many points per unit of fuel left at landing. */
  fuelPerUnit: 2,
};

export const PALETTE = {
  backdrop: '#0e1420',
  skyTop: '#2b6cb0',
  skyMid: '#7fb2dd',
  skyHorizon: '#cfe6f2',
  sun: '#fff3c4',
  cloud: '#ffffff',
  mountainFar: '#8fa8c8',
  mountainNear: '#5d7396',
  fieldGreen: '#5d8a3c',
  fieldLight: '#7ba24a',
  fieldWheat: '#c2a95c',
  fieldForest: '#2f5d2a',
  fieldDry: '#9aa05a',
  road: '#5a5f66',
  river: '#3f7fb8',
  town: '#b09a7a',
  townRoof: '#8a5f4d',
  runway: '#3c4148',
  runwayLine: '#e8e4d2',
  ring: '#ffb400',
  ringGlow: '#ffdf6b',
  ringDone: '#37c978',
  planeBody: '#e8ecf2',
  planeTrim: '#d84a35',
  planeGlass: '#1c2f45',
  panel: '#141a26',
  panelEdge: '#2c3648',
  gaugeFace: '#10151f',
  gaugeTick: '#c8d2de',
  gaugeNeedle: '#ff5a3c',
  gaugeGreen: '#37c978',
  gaugeAmber: '#ffb400',
  gaugeRed: '#ff4a3c',
  text: '#eef1f5',
  muted: '#9aa7b8',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sky-courier.best';

/** The mission's name, shown on the title screen and the end screen. */
export const GAME_TITLE = 'SKY COURIER';
export const GAME_SUBTITLE = 'Ridge Run — fly the rings, land the mail';
