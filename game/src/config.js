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
  /** Each pad's radius varies by this share, so the grid never looks stamped out. */
  radiusVar: 0.12,
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

/** Combo: crumbs eaten in a row without losing a life. A crumb scores 10 x the combo (capped). */
export const COMBO = { maxMult: 3 };

/** The golden crumb: worth 50, appears from level 2, at most one on the pond at a time. */
export const GOLDEN = { points: 50, minLevel: 2, chance: 0.16 };

/** The shield bubble: absorbs one hit, appears from level 2, at most one on the pond. */
export const SHIELD = { minLevel: 2, chance: 0.1 };

/** Pads that drift sideways, from level 4: a share of pads, each with its own amplitude. */
export const DRIFT = { minLevel: 4, chance: 0.3, minAmp: 16, maxAmp: 30, speed: 0.5 };

/** Fish that leap out of the water (visual only, they never hurt), from level 2. */
export const FISH = { minLevel: 2, intervalMin: 3.5, intervalMax: 7, leap: 0.9 };

/** The star crumb: worth 100 and starts FEVER — double points for a few seconds. */
export const STAR = { points: 100, minLevel: 2, chance: 0.08 };
export const FEVER = { duration: 8, mult: 2 };

/** The turtle: from level 3 it surfaces on a pad and blocks it; landing on it bumps you. */
export const TURTLE = { minLevel: 3, interval: 12, warn: 0.8, sit: 5 };

/** Dragonflies that flit over the pond (visual only, they never hurt). */
export const DRAGONFLY = { count: 3, speed: 0.35 };

/** The duckling is drawn this much bigger than v2, so the hero reads at a glance. */
export const DUCK_SCALE = 1.25;

/** What each level is called in the HUD. */
export const LEVEL_NAMES = {
  1: 'Sunny Pond',
  2: 'Busy Pond',
  3: 'Dusk Pond',
  4: 'Night Pond',
  5: 'Night Pond',
  6: 'Night Pond',
  7: 'Night Pond',
  8: 'Night Pond',
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
  padWobble: '#d8a93b',
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
  goldBright: '#ffd94d',
  shield: '#7fd4ff',
  fish: '#ff9e5e',
  firefly: '#d8f79a',
  star: '#fff3c4',
  turtle: '#4a7a52',
  turtleDark: '#355c3c',
  dragonfly: '#9fd8ff',
};

/** Dusk (level 3): warm orange sky, amber water. */
export const PALETTE_DUSK = {
  sky: '#ffb37a',
  skyTop: '#ff9d5c',
  bank: '#6a9a4a',
  bankDark: '#527a38',
  water: '#3a7a8c',
  waterDeep: '#24506a',
  pad: '#4a9e4d',
  padDark: '#357a3a',
};

/** Night (level 4+): deep indigo water, moonlit sky, fireflies everywhere. */
export const PALETTE_NIGHT = {
  sky: '#2a3a6e',
  skyTop: '#1a2447',
  bank: '#2f5a3c',
  bankDark: '#24452e',
  water: '#26597f',
  waterDeep: '#16395e',
  pad: '#2f7d4a',
  padDark: '#245c36',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'duckling-pond-dash.best';
