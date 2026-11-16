// Quartz Quest — tuning numbers and palette in one place.
// SPDX-License-Identifier: MIT
// The playfield is a fixed 1280x720 logical area (32x18 tiles of 40px); the renderer scales it
// to the window, so no rule below depends on the screen size.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const FIELD = { width: COLS * TILE, height: ROWS * TILE };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  width: 26,
  height: 34,
  runSpeed: 300,
  accelGround: 2600,
  accelAir: 1800,
  friction: 2200,
  jumpVel: 640,
  gravity: 1900,
  maxFall: 820,
  coyote: 0.1,
  jumpBuffer: 0.12,
  invulnerable: 2,
};

export const SLIME = { width: 34, height: 24, speed: 55 };

export const LIVES = 3;

/** How many hand-built levels the game has. */
export const LEVELS_COUNT = 5;

export const POINTS = { crystal: 100, stomp: 50, levelBonusPerSecond: 10 };

export const PALETTE = {
  backdrop: '#0d0a1a',
  skyTop: '#1c1440',
  skyMid: '#2a1a55',
  skyBottom: '#3d2366',
  hillFar: '#241647',
  hillNear: '#1a1038',
  rock: '#4a3a6e',
  rockDark: '#382a56',
  rockLight: '#6a529a',
  crystal: '#7df9ff',
  crystalCore: '#e8fdff',
  crystalPink: '#ff9de2',
  spike: '#c9ced6',
  spikeDark: '#8f96a3',
  slime: '#7ed957',
  slimeDark: '#4da337',
  portal: '#39d0ff',
  portalLocked: '#5a5a72',
  player: '#ffb347',
  playerDark: '#e07b39',
  helmet: '#ffd94d',
  text: '#f2efff',
  muted: '#a99fd0',
  panel: '#1d1440',
  panelEdge: '#5b3fa8',
  heart: '#ff5d7a',
  gold: '#ffd94d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'quartz-quest.best';
