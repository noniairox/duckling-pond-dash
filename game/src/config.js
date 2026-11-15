// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const LIVES = 3;
/** Points that win the game: the duckling becomes Pond Champion. */
export const WIN_SCORE = 300;
/** Points per level; speeds and spawn rates stop growing at the last level. */
export const LEVEL_POINTS = 50;
export const LEVEL_MAX = 8;

/** One hop: how long it takes and how far the duckling can jump. */
export const HOP = { duration: 0.32, range: 300 };

export const CRUMB = { points: 10, max: 5, interval: 1.6 };

/** The lily pads: a 4x6 grid, jittered at reset, each with its own sink cycle. */
export const PAD = {
  rows: [170, 310, 450, 590],
  cols: [120, 320, 520, 720, 920, 1120],
  radius: 56,
  jitter: 26,
  healthyMin: 14,
  healthyMax: 26,
  /** Seconds a pad warns (wobbles) before it sinks. */
  wobble: 2.2,
  /** Seconds a sunk pad stays under water. */
  gone: 3.0,
  /** Seconds a pad takes to sprout back. */
  regrow: 1.2,
};

/** The nest pad at the bottom centre: the duckling starts and respawns here, and it never sinks. */
export const HOME_PAD = { x: 640, y: 662, radius: 60 };

export const HERON = {
  perch: { x: 640, y: 52 },
  hover: 0.55,
  swoop: 0.45,
  stand: 1.3,
  perchWait: 1.0,
  fly: 0.9,
  /** Chance a swoop hunts the duckling's own pad instead of a random one. */
  huntChance: 0.6,
};

export const CAT = {
  minLevel: 3,
  interval: 9,
  crouch: 1.0,
  leap: 0.5,
  land: 0.8,
  bankY: 48,
};

export const PALETTE = {
  backdrop: '#0e2a24',
  sky: '#ffe9a8',
  skyTop: '#ffd98a',
  bank: '#5da24a',
  bankDark: '#4a8a3c',
  water: '#2e8b8b',
  waterDeep: '#1f6a6e',
  ripple: '#bfe8e0',
  pad: '#3f9e4d',
  padDark: '#2f7d3a',
  padWobble: '#a8873c',
  flower: '#ff8fb3',
  crumb: '#8a5a2b',
  crumbLight: '#c98d4b',
  duck: '#ffd93b',
  duckDark: '#eab616',
  beak: '#ff8c42',
  heron: '#8fa3b8',
  heronDark: '#6b7f96',
  cat: '#e8955a',
  catDark: '#c47a3e',
  panel: '#fff8e6',
  panelEdge: '#e8d9b0',
  text: '#23402a',
  muted: '#5a7358',
  danger: '#d94f3d',
  gold: '#e9a13b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'duckling-pond-dash.best';
