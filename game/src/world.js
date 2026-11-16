// Quartz Quest — world: physics, entities, scoring and the autopilot planner.
// SPDX-License-Identifier: MIT
// Pure logic: no DOM, no audio, no canvas — main.js wires it to the browser, and
// shots.js drives it with the autopilot. Safe to import from Node for testing.
import { TILE, COLS, ROWS, FIELD, PLAYER, SLIME, LIVES, POINTS } from './config.js';
import { LEVELS, parseLevel } from './levels.js';

export const EVENT_NONE = 0;
export const EVENT_CRYSTAL = 1;
export const EVENT_STOMP = 2;
export const EVENT_HURT = 4;
export const EVENT_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_PAD = 64;

const BOUNCE_VY = 980;

function solidAt(parsed, tx, ty) {
  if (tx < 0 || tx >= COLS) return true;
  if (ty < 0) return true;
  if (ty >= ROWS) return false;
  return parsed.solids.has(`${tx},${ty}`);
}

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function createWorld() {
  const state = {
    levelIndex: 0,
    level: null,
    parsed: null,
    player: null,
    slimes: [],
    score: 0,
    lives: 3,
    levelTime: 0,
    totalTime: 0,
    levelBonus: 0,
    crystalsGot: 0,
    crystalsTotal: 0,
    levelClear: false,
    won: false,
    over: false,
    hint: '',
    hintTimer: 0,
    particles: [],
    floats: [],
    shake: 0,
    time: 0,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    const parsed = parseLevel(level);
    state.levelIndex = index;
    state.level = level;
    state.parsed = parsed;
    state.levelTime = 0;
    state.levelClear = false;
    state.crystalsGot = 0;
    state.crystalsTotal = parsed.crystals.length;
    // Lives are per level: a fresh set of three for every level, so one
    // mistimed jump does not end a whole run.
    state.lives = LIVES;
    state.particles.length = 0;
    state.floats.length = 0;
    state.hint = '';
    state.hintTimer = 0;
    const spawn = parsed.player;
    state.player = {
      x: spawn.x * TILE + 7,
      y: spawn.y * TILE + 6,
      vx: 0,
      vy: 0,
      w: PLAYER.width,
      h: PLAYER.height,
      face: 1,
      onGround: false,
      coyote: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      invuln: 0,
    };
    state.slimes = parsed.slimes.map((s) => ({
      x: s.x * TILE + 3,
      y: s.y * TILE + (TILE - SLIME.height),
      w: SLIME.width,
      h: SLIME.height,
      dir: -1,
      alive: true,
      squash: 0,
    }));
  }

  function reset() {
    state.score = 0;
    state.lives = 3;
    state.totalTime = 0;
    state.won = false;
    state.over = false;
    state.time = 0;
    loadLevel(0);
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 60,
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function addFloat(x, y, text, color) {
    state.floats.push({ x, y, text, color: color ?? '#ffd94d', life: 1 });
  }

  function respawn() {
    const spawn = state.parsed.player;
    const p = state.player;
    p.x = spawn.x * TILE + 7;
    p.y = spawn.y * TILE + 6;
    p.vx = 0;
    p.vy = 0;
    p.invuln = PLAYER.invulnerable;
  }

  function hurt() {
    const p = state.player;
    if (p.invuln > 0 || state.levelClear || state.over || state.won) return EVENT_NONE;
    state.lives -= 1;
    state.shake = 0.35;
    burst(p.x + p.w / 2, p.y + p.h / 2, '#ff5d7a', 14, 220);
    if (state.lives <= 0) {
      state.over = true;
      return EVENT_HURT | EVENT_OVER;
    }
    respawn();
    return EVENT_HURT;
  }

  function collideAxis(p, axis) {
    const parsed = state.parsed;
    if (axis === 'x') {
      const top = Math.floor(p.y / TILE);
      const bottom = Math.floor((p.y + p.h - 1) / TILE);
      if (p.vx > 0) {
        const tx = Math.floor((p.x + p.w) / TILE);
        for (let ty = top; ty <= bottom; ty += 1) {
          if (solidAt(parsed, tx, ty)) { p.x = tx * TILE - p.w - 0.01; p.vx = 0; break; }
        }
      } else if (p.vx < 0) {
        const tx = Math.floor(p.x / TILE);
        for (let ty = top; ty <= bottom; ty += 1) {
          if (solidAt(parsed, tx, ty)) { p.x = (tx + 1) * TILE + 0.01; p.vx = 0; break; }
        }
      }
    } else {
      const left = Math.floor(p.x / TILE);
      const right = Math.floor((p.x + p.w - 1) / TILE);
      if (p.vy > 0) {
        const ty = Math.floor((p.y + p.h) / TILE);
        for (let tx = left; tx <= right; tx += 1) {
          if (solidAt(parsed, tx, ty)) {
            p.y = ty * TILE - p.h;
            p.vy = 0;
            p.onGround = true;
            break;
          }
        }
      } else if (p.vy < 0) {
        const ty = Math.floor(p.y / TILE);
        for (let tx = left; tx <= right; tx += 1) {
          if (solidAt(parsed, tx, ty)) { p.y = (ty + 1) * TILE + 0.01; p.vy = 0; break; }
        }
      }
    }
  }

  function step(dt, input) {
    const p = state.player;
    const parsed = state.parsed;
    let events = EVENT_NONE;
    state.time += dt;
    if (!state.levelClear && !state.over && !state.won) {
      state.levelTime += dt;
      state.totalTime += dt;
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (state.hintTimer > 0) state.hintTimer -= dt;
    if (state.shake > 0) state.shake -= dt;

    // --- horizontal movement
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const accel = p.onGround ? PLAYER.accelGround : PLAYER.accelAir;
    if (dir !== 0) {
      p.vx += dir * accel * dt;
      p.vx = Math.max(-PLAYER.runSpeed, Math.min(PLAYER.runSpeed, p.vx));
      p.face = dir;
    } else if (p.onGround) {
      const s = Math.sign(p.vx);
      p.vx -= s * Math.min(Math.abs(p.vx), PLAYER.friction * dt);
    }
    p.x += p.vx * dt;
    collideAxis(p, 'x');
    p.x = Math.max(0, Math.min(FIELD.width - p.w, p.x));

    // --- jumping (coyote time + input buffering + jump cut)
    if (input.jump) p.jumpBuffer = PLAYER.jumpBuffer;
    else p.jumpBuffer -= dt;
    const wasGround = p.onGround;
    if (wasGround) p.coyote = PLAYER.coyote;
    else p.coyote -= dt;
    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -PLAYER.jumpVel;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
    }
    if (!input.jumpHeld && p.vy < -200) p.vy = -200;
    p.jumpHeld = input.jumpHeld;

    // --- gravity and vertical movement
    p.vy = Math.min(PLAYER.maxFall, p.vy + PLAYER.gravity * dt);
    p.onGround = false;
    p.y += p.vy * dt;
    collideAxis(p, 'y');

    // --- bounce pads
    for (const pad of parsed.pads) {
      const px = pad.x * TILE;
      const py = pad.y * TILE;
      if (p.vy >= 0 && overlap(p.x, p.y, p.w, p.h, px + 2, py + 2, TILE - 4, TILE - 2)) {
        p.vy = -BOUNCE_VY;
        // A trampoline launch is mostly vertical: shed half the run-up speed
        // so the player arcs onto the platform above, not past it.
        p.vx *= 0.5;
        p.onGround = false;
        events |= EVENT_PAD;
        burst(px + TILE / 2, py, '#7df9ff', 8, 140);
      }
    }

    // --- slimes: patrol, turn at walls and ledges
    for (const s of state.slimes) {
      if (!s.alive) continue;
      if (s.squash > 0) s.squash -= dt;
      const frontX = s.dir > 0 ? s.x + s.w + 2 : s.x - 2;
      const ftx = Math.floor(frontX / TILE);
      const feetTy = Math.floor((s.y + s.h) / TILE);
      const bodyTy = Math.floor((s.y + s.h / 2) / TILE);
      const wallAhead = solidAt(parsed, ftx, bodyTy);
      const groundAhead = solidAt(parsed, ftx, feetTy);
      if (wallAhead || !groundAhead) s.dir *= -1;
      s.x += s.dir * SLIME.speed * dt;
      const stx = Math.floor((s.x + s.w / 2) / TILE);
      if (s.x < 0 || stx < 0 || stx >= COLS) s.dir *= -1;
    }

    // --- crystals
    for (const c of parsed.crystals) {
      if (c.taken) continue;
      const cx = c.x * TILE + TILE / 2;
      const cy = c.y * TILE + TILE / 2;
      if (overlap(p.x, p.y, p.w, p.h, cx - 13, cy - 13, 26, 26)) {
        c.taken = true;
        state.crystalsGot += 1;
        state.score += POINTS.crystal;
        events |= EVENT_CRYSTAL;
        burst(cx, cy, '#7df9ff', 16, 200);
        burst(cx, cy, '#ff9de2', 8, 140);
        addFloat(cx, cy - 18, `+${POINTS.crystal}`, '#7df9ff');
      }
    }

    // --- slime contact: stomp or hurt
    for (const s of state.slimes) {
      if (!s.alive) continue;
      if (overlap(p.x, p.y, p.w, p.h, s.x, s.y, s.w, s.h)) {
        const stomp = p.vy > 0 && (p.y + p.h) - s.y < 16;
        if (stomp) {
          s.alive = false;
          s.squash = 0.2;
          p.vy = -420;
          p.onGround = false;
          state.score += POINTS.stomp;
          events |= EVENT_STOMP;
          burst(s.x + s.w / 2, s.y + s.h / 2, '#7ed957', 14, 200);
          addFloat(s.x + s.w / 2, s.y - 10, `+${POINTS.stomp}`, '#7ed957');
        } else {
          events |= hurt();
          if (state.over) break;
        }
      }
    }

    // --- spikes
    if (!state.over) {
      for (const sp of parsed.spikes) {
        const sx = sp.x * TILE + 8;
        const sy = sp.y * TILE + 22;
        if (overlap(p.x, p.y, p.w, p.h, sx, sy, TILE - 16, TILE - 22)) {
          events |= hurt();
          break;
        }
      }
    }

    // --- fell out of the world
    if (!state.over && p.y > FIELD.height + 60) {
      events |= hurt();
    }

    // --- portal
    if (!state.levelClear && !state.over && !state.won) {
      const portal = parsed.portal;
      const px = portal.x * TILE;
      const py = portal.y * TILE;
      if (overlap(p.x, p.y, p.w, p.h, px + 2, py - TILE, TILE - 4, TILE * 2)) {
        if (state.crystalsGot >= state.crystalsTotal) {
          state.levelClear = true;
          state.levelBonus = Math.max(0, Math.round(state.level.par - state.levelTime)) * POINTS.levelBonusPerSecond;
          state.score += state.levelBonus;
          burst(px + TILE / 2, py, '#39d0ff', 26, 260);
          events |= EVENT_CLEAR;
          if (state.levelIndex >= LEVELS.length - 1) {
            state.won = true;
            events |= EVENT_WIN;
          }
        } else if (state.hintTimer <= 0) {
          state.hint = `Portal locked — ${state.crystalsTotal - state.crystalsGot} crystal${state.crystalsTotal - state.crystalsGot === 1 ? '' : 's'} left!`;
          state.hintTimer = 2.5;
        }
      }
    }

    // --- particles and floats
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 500 * dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floats.length - 1; i >= 0; i -= 1) {
      const f = state.floats[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) state.floats.splice(i, 1);
    }
    return events;
  }

  function nextLevel() {
    if (state.levelIndex + 1 < LEVELS.length) loadLevel(state.levelIndex + 1);
  }

  loadLevel(0);
  return { state, reset, loadLevel, nextLevel, step };
}

// ---------------------------------------------------------------------------
// Autopilot: a BFS over "stands" (solid tiles you can stand on) that steers the
// player to the nearest crystal, then the portal. Used by ?shot= staging and
// by the title-screen attract mode. It plays the real rules — no teleporting.
// ---------------------------------------------------------------------------

export function buildZones(parsed) {
  const zones = [];
  const byRow = new Map();
  for (const key of parsed.solids) {
    const [x, y] = key.split(',').map(Number);
    if (parsed.solids.has(`${x},${y - 1}`)) continue;
    if (parsed.spikes.some((s) => s.x === x && s.y === y - 1)) continue;
    if (!byRow.has(y)) byRow.set(y, []);
    byRow.get(y).push(x);
  }
  for (const [y, xs] of byRow) {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    let prev = xs[0];
    for (let i = 1; i <= xs.length; i += 1) {
      if (xs[i] === prev + 1) { prev = xs[i]; continue; }
      zones.push({ x0: start, x1: prev, y, top: y * TILE, pad: false });
      start = xs[i];
      prev = xs[i];
    }
  }
  for (const pad of parsed.pads) {
    zones.push({ x0: pad.x, x1: pad.x, y: pad.y, top: pad.y * TILE, pad: true });
  }
  return zones;
}

export function zoneBelow(parsed, zones, tx, ty) {
  // The zone a target tile (crystal/portal) sits on: the highest zone at or
  // below it, overlapping its column (within 1 tile).
  let best = null;
  for (const z of zones) {
    if (tx < z.x0 - 1 || tx > z.x1 + 1) continue;
    if (z.top > (ty + 1) * TILE) continue;
    if (!best || z.top > best.top) best = z;
  }
  return best;
}

/**
 * Simulate the fall from zone `from` toward zone `to` (a jump when the zones
 * are separated by a gap, a walk-off when they overlap) and report whether
 * the arc touches no spike and lands on `to`.
 */
function fallIsSafe(parsed, from, to, gap) {
  const dir = ((to.x0 + to.x1 + 1) / 2) * TILE > ((from.x0 + from.x1 + 1) / 2) * TILE ? 1 : -1;
  let x = dir > 0 ? (from.x1 + 1) * TILE - PLAYER.width : from.x0 * TILE;
  let feet = from.top;
  let vy = gap > 0 ? -PLAYER.jumpVel : 0;
  const dt = 1 / 60;
  for (let step = 0; step < 180; step += 1) {
    vy = Math.min(PLAYER.maxFall, vy + PLAYER.gravity * dt);
    x += dir * PLAYER.runSpeed * dt;
    feet += vy * dt;
    const px = x;
    const py = feet - PLAYER.height;
    for (const sp of parsed.spikes) {
      const sx = sp.x * TILE + 8;
      const sy = sp.y * TILE + 22;
      if (px < sx + TILE - 16 && px + PLAYER.width > sx && py < sy + TILE - 22 && py + PLAYER.height > sy) return false;
    }
    if (feet >= to.top) {
      const zoneLeft = to.x0 * TILE;
      const zoneRight = (to.x1 + 1) * TILE;
      return x + PLAYER.width > zoneLeft && x < zoneRight;
    }
  }
  return false;
}

export function createAutopilot(world) {
  let plan = null; // array of zones, first = current zone
  let planTarget = null;
  let replanIn = 0;
  let lastGround = null; // zone the player last stood on (see computePlan)

  /**
   * True when a hop from here would not bonk: no solid wall within ~55px
   * ahead at the body's height (the jump needs that much run to rise clear
   * of it) and no solid directly overhead within two rows.
   */
  function jumpIsClear() {
    const { parsed, player } = world.state;
    const dir = player.face;
    const top = Math.floor(player.y / TILE);
    const bottom = Math.floor((player.y + player.h - 1) / TILE);
    const leadX = dir > 0 ? player.x + player.w : player.x;
    let nearest = Infinity;
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        if (!parsed.solids.has(`${tx},${ty}`)) continue;
        const d = dir > 0 ? tx * TILE - leadX : leadX - (tx + 1) * TILE;
        if (d >= 0 && d < nearest) nearest = d;
      }
    }
    const pcx = Math.floor((player.x + player.w / 2) / TILE);
    for (let dy = 1; dy <= 2; dy += 1) {
      if (parsed.solids.has(`${pcx},${top - dy}`)) return false;
    }
    return nearest >= 55;
  }

  function targetStand() {
    const { parsed, crystalsGot, crystalsTotal } = world.state;
    let target = null;
    let bestDist = Infinity;
    const p = world.state.player;
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    if (crystalsGot < crystalsTotal) {
      for (const c of parsed.crystals) {
        if (c.taken) continue;
        const cx = c.x * TILE + TILE / 2;
        const cy = c.y * TILE + TILE / 2;
        const d = Math.abs(cx - px) + Math.abs(cy - py) * 1.5;
        if (d < bestDist) { bestDist = d; target = { x: c.x, y: c.y, kind: 'crystal' }; }
      }
    } else {
      target = { x: parsed.portal.x, y: parsed.portal.y, kind: 'portal' };
    }
    return target;
  }

  function computePlan() {
    const { parsed, player } = world.state;
    const zones = buildZones(parsed);
    const target = targetStand();
    if (!target) return null;
    const goal = zoneBelow(parsed, zones, target.x, target.y);
    if (!goal) return null;
    // Current zone: the zone the player last stood on. Never guess from an
    // airborne position — mid-jump the highest zone under the feet can be a
    // platform the player is passing under, which would make the plan a
    // trivial one-node path and the pilot jump in place forever.
    // (Zones are rebuilt each plan, so match the remembered zone by key.)
    const zoneKey = (z) => `${z.x0},${z.x1},${z.y},${z.pad ? 1 : 0}`;
    let start = lastGround ? zones.find((z) => zoneKey(z) === zoneKey(lastGround)) ?? null : null;
    if (!start) {
      const feet = player.y + player.h;
      const pcx = player.x + player.w / 2;
      for (const z of zones) {
        if (pcx < z.x0 * TILE - 2 * TILE || pcx > (z.x1 + 1) * TILE + 2 * TILE) continue;
        if (z.top > feet + 6) continue;
        if (!start || z.top > start.top) start = z;
      }
    }
    if (!start) return null;
    // BFS over zones. Gaps are edge-to-edge; the reach numbers come from the
    // jump physics (108px up, ~200px across flat, further when dropping).
    const key = (n) => `${n.x0},${n.x1},${n.y},${n.pad ? 1 : 0}`;
    const prev = new Map();
    const seen = new Set([key(start)]);
    const queue = [start];
    prev.set(key(start), null);
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === goal) break;
      for (const n of zones) {
        if (seen.has(key(n))) continue;
        let gap;
        if (n.x0 > cur.x1) gap = n.x0 * TILE - (cur.x1 + 1) * TILE;
        else if (cur.x0 > n.x1) gap = cur.x0 * TILE - (n.x1 + 1) * TILE;
        else gap = 0;
        const rise = cur.top - n.top; // positive = n is higher
        let ok = false;
        if (cur.pad) {
          // A bounce pad launches up to 6 rows high, ~150px across.
          ok = rise <= 6 * TILE && rise >= -TILE && gap <= 150;
        } else if (rise <= 0) {
          ok = gap <= 200 + Math.max(0, -rise) * 0.35;
        } else if (rise <= TILE) {
          ok = gap <= 180;
        } else if (rise <= 2 * TILE) {
          ok = gap <= 130; // two rows up: ~152px of reach while rising
        }
        if (!ok) continue;
        // A drop is only a real edge if the fall itself is survivable: walk
        // (gap 0) or jump (gap > 0) off this zone's edge toward the next one
        // and check the arc never touches a spike and lands on the next zone.
        if (rise <= 0 && !fallIsSafe(parsed, cur, n, gap)) continue;
        // The hop must not cross a solid wall at the takeoff height.
        let blocked = false;
        if (rise > 0) {
          const lo = Math.min(cur.x0, n.x0);
          const hi = Math.max(cur.x1, n.x1);
          for (let x = lo; x <= hi; x += 1) {
            if (parsed.solids.has(`${x},${cur.y - 1}`)) { blocked = true; break; }
          }
        }
        if (blocked) continue;
        seen.add(key(n));
        prev.set(key(n), cur);
        queue.push(n);
      }
    }
    if (!prev.has(key(goal))) return null;
    const path = [];
    let cur = goal;
    while (cur) { path.unshift(cur); cur = prev.get(key(cur)); }
    return { path, target: `${target.kind}:${target.x},${target.y}` };
  }

  function input() {
    const { player, levelClear, over, won } = world.state;
    if (levelClear || over || won) return { left: false, right: false, jump: false, jumpHeld: false };
    // Remember the zone under the player's feet while standing on it.
    if (player.onGround) {
      const zones = buildZones(world.state.parsed);
      const feet = player.y + player.h;
      const pcx = player.x + player.w / 2;
      for (const z of zones) {
        if (Math.abs(z.top - feet) <= 4 && pcx >= z.x0 * TILE - 10 && pcx <= (z.x1 + 1) * TILE + 10) {
          lastGround = z;
          break;
        }
      }
    }
    replanIn -= 1;
    const target = targetStand();
    const targetKey = target ? `${target.kind}:${target.x},${target.y}` : '';
    if (!plan || planTarget !== targetKey || replanIn <= 0) {
      plan = computePlan();
      planTarget = targetKey;
      replanIn = 20;
    }
    // Advance the plan past zones the player is already standing on: a plan
    // computed from the ground still says "go to C" after the player has
    // landed on C, which would make it back off C and loop forever.
    if (plan && lastGround) {
      const zoneKey = (z) => `${z.x0},${z.x1},${z.y},${z.pad ? 1 : 0}`;
      const idx = plan.path.findIndex((z) => zoneKey(z) === zoneKey(lastGround));
      if (idx > 0) plan.path.splice(0, idx);
    }
    // A bounce pad is "reached" the moment the player is airborne above it:
    // steering back toward the pad mid-bounce would pull the player away
    // from the platform the pad is meant to launch it onto.
    if (plan && plan.path.length >= 2) {
      const next = plan.path[1];
      if (next.pad && !player.onGround && player.y + player.h < next.top) {
        plan.path.splice(0, 1);
      }
    }
    // Slime about to be walked into: hop over it — but only when the hop
    // itself is clear (no wall right ahead to bonk on, nothing overhead).
    let dodgeJump = false;
    for (const s of world.state.slimes) {
      if (!s.alive) continue;
      const dx = (s.x + s.w / 2) - (player.x + player.w / 2);
      const dy = Math.abs((s.y + s.h / 2) - (player.y + player.h / 2));
      if (dy < 50 && Math.abs(dx) < 78) { dodgeJump = true; break; }
    }
    if (dodgeJump && !jumpIsClear()) dodgeJump = false;
    if (!plan || plan.path.length < 2) {
      // No route (or already there): walk straight at the target and hop
      // only from a run-up — never jump in place under a high target.
      if (!target) return { left: false, right: false, jump: false, jumpHeld: false };
      const tx = target.x * TILE + TILE / 2;
      const dx = tx - (player.x + player.w / 2);
      const above = target.y * TILE < player.y - 40;
      let left = dx < -8;
      let right = dx > 8;
      let jump = dodgeJump;
      if (above) {
        if (Math.abs(dx) >= 40 && Math.abs(dx) <= 150) jump = true;
        else if (Math.abs(dx) < 40) { left = dx > 0; right = dx < 0; }
      }
      return {
        left,
        right,
        jump,
        jumpHeld: jump || player.vy < 0,
      };
    }
    const next = plan.path[1];
    const cur = plan.path[0];
    // On the last hop, steer at the target itself (a crystal, the portal),
    // not the goal zone's middle — the crystal may sit at the zone's far end.
    let nx;
    if (plan.path.length === 2) {
      const t = targetStand();
      nx = t ? t.x * TILE + TILE / 2 : ((next.x0 + next.x1 + 1) / 2) * TILE;
    } else {
      nx = ((next.x0 + next.x1 + 1) / 2) * TILE;
    }
    const px = player.x + player.w / 2;
    const dx = nx - px;
    const rise = cur.top - next.top;
    // The landing zone is the whole run of stands at the next zone's height
    // (a 3-wide platform, not one tile): take off while the zone's near edge
    // is 20-150px ahead. Never jump from directly underneath a platform —
    // that bonks on its underside — so back off first if we are under it.
    let moveLeft = dx < -10;
    let moveRight = dx > 10;
    let wantJump = dodgeJump;
    if (rise > 0 && !next.pad) {
      // (A pad is walked onto, never jumped at — contact alone bounces.)
      // Take off so the feet cross the landing height near the zone's middle:
      // the jump stays above that height for travelMin..travelMax px, and the
      // ideal takeoff puts the landing at the zone centre. Never jump while
      // still moving the wrong way, or from directly under a platform (that
      // bonks on its underside) — back off first if we are under it.
      const zoneLeft = next.x0 * TILE;
      const zoneRight = (next.x1 + 1) * TILE;
      const zoneCentre = (zoneLeft + zoneRight) / 2;
      const zoneW = zoneRight - zoneLeft;
      // The jump's reach depends on the speed at takeoff, so time the window
      // with the player's current speed — and only jump once it is running
      // near full speed, or a slow hop lands short of the platform.
      const v = Math.min(300, Math.max(240, Math.abs(player.vx)));
      const disc = Math.sqrt(Math.max(0, 640 * 640 - 4 * 950 * rise));
      const travelMin = v * ((640 - disc) / 1900);
      const travelMax = v * ((640 + disc) / 1900);
      const ideal = travelMax - zoneW / 2 - 13;
      const tol = Math.min(50, Math.max(12, (zoneW - 26) / 2 + 12));
      const lo = ideal >= 20 ? Math.max(travelMin, ideal - tol) : travelMin;
      const hi = ideal >= 20 ? Math.min(travelMax, ideal + tol) : travelMax;
      const toward = (px < zoneCentre && player.vx > 240) || (px > zoneCentre && player.vx < -240);
      let edgeDist;
      if (px < zoneCentre) edgeDist = zoneLeft - (player.x + player.w);
      else edgeDist = player.x - zoneRight;
      // Only time the takeoff (or back off) while standing on the ground:
      // mid-jump the pilot must keep flying toward the zone, never reverse
      // into a back-off and land short of it.
      if (player.onGround) {
        if (edgeDist >= lo && edgeDist <= hi && toward) {
          wantJump = true;
        } else if (edgeDist < lo) {
          // Under (or past) the platform: back off through the NEAREST edge,
          // so we never hover under its middle flipping direction.
          moveLeft = (px - zoneLeft) < (zoneRight - px);
          moveRight = !moveLeft;
        }
      }
    } else {
      // Directly above a much lower target: walk off the nearest edge of
      // this zone and drop to it, instead of standing still above it.
      if (rise < -TILE && Math.abs(dx) < 40 && player.onGround) {
        const curLeft = cur.x0 * TILE;
        const curRight = (cur.x1 + 1) * TILE;
        moveLeft = (px - curLeft) < (curRight - px);
        moveRight = !moveLeft;
      }
      // Dropping to a lower zone across a gap (another platform, or a pit):
      // jump from the edge of this zone, or we land on the floor below it.
      const gap = next.x0 > cur.x1
        ? next.x0 * TILE - (cur.x1 + 1) * TILE
        : cur.x0 > next.x1
          ? cur.x0 * TILE - (next.x1 + 1) * TILE
          : 0;
      if (gap > 0 && player.onGround) {
        const distToEdge = dx > 0
          ? (cur.x1 + 1) * TILE - (player.x + player.w)
          : player.x - cur.x0 * TILE;
        if (distToEdge >= -5 && distToEdge <= 40 && Math.abs(player.vx) > 120) wantJump = true;
      }
      if (Math.abs(player.vx) < 12 && Math.abs(dx) > 24) {
        // Pushing against a wall: hop — if the hop itself is clear.
        wantJump = jumpIsClear();
      }
    }
    // If the next stand is much lower, just walk off the edge.
    return {
      left: moveLeft,
      right: moveRight,
      jump: wantJump,
      // Hold the jump while rising, or the jump-cut in the world step would
      // clip the hop the moment the trigger condition stops holding.
      jumpHeld: wantJump || player.vy < 0,
    };
  }

  return {
    input,
    debug() {
      return {
        plan: plan ? plan.path.map((z) => `[${z.x0}-${z.x1}]@${z.top}${z.pad ? ' pad' : ''}`) : null,
        planTarget,
        lastGround: lastGround ? `[${lastGround.x0}-${lastGround.x1}]@${lastGround.top}` : null,
      };
    },
  };
}
