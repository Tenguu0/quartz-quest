// Quartz Quest — the scenes behind ?shot=start|play|mid|end. Each one plays
// the real rules forward from a fresh world, steered by the same autopilot
// that drives the title-screen attract mode, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
// SPDX-License-Identifier: MIT
import { STEP } from './config.js';
import { createAutopilot, EVENT_CLEAR, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 3;
const PLAY_SECONDS = 9;
const MID_SECONDS = 7;
const END_LIMIT_SECONDS = 300;

/** Run the autopilot for up to `seconds` of game time; returns the events seen. */
function runFor(world, pilot, seconds) {
  const steps = Math.floor(seconds / STEP);
  let events = 0;
  for (let i = 0; i < steps; i += 1) {
    events |= world.step(STEP, pilot.input());
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Names: start (title), play (level 1 mid-game),
 * mid (level 4, bounce pads), end (the victory screen after a full run).
 */
export function stageShot(name, world) {
  const pilot = createAutopilot(world);
  if (name === 'play') {
    world.reset();
    runFor(world, pilot, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mid') {
    world.reset();
    world.loadLevel(3);
    runFor(world, pilot, MID_SECONDS);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    world.reset();
    let events = 0;
    for (let level = 0; level < 5; level += 1) {
      events = runFor(world, pilot, END_LIMIT_SECONDS);
      if (events & EVENT_WIN) break;
      if (events & EVENT_OVER) break;
      if (events & EVENT_CLEAR) world.nextLevel();
      else break;
    }
    if (world.state.won) return { screen: SCREEN_WIN, best: world.state.score };
    if (world.state.over) return { screen: SCREEN_OVER, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // start (default): attract mode — the autopilot plays level 1 behind the
  // title panel.
  world.reset();
  runFor(world, pilot, START_SECONDS);
  return { screen: SCREEN_TITLE, best: 0 };
}
