// Quartz Quest — drawing only: the world's state and the current screen in,
// pixels out. The 1280x720 playfield is scaled to fit the window and
// centred. All art is drawn with canvas shapes — no image assets.
// SPDX-License-Identifier: MIT
import { FIELD, TILE, FONT, PALETTE, LEVELS_COUNT } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  let dust = [];
  for (let i = 0; i < 46; i += 1) {
    dust.push({
      x: Math.random() * FIELD.width,
      y: Math.random() * FIELD.height,
      r: 1 + Math.random() * 2.2,
      s: 6 + Math.random() * 14,
      a: 0.12 + Math.random() * 0.25,
    });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  function text(value, x, y, size, color, align = 'left', bold = false) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawBackground(time) {
    const g = context.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Parallax crystal hills.
    for (const [color, amp, base, speed] of [
      [PALETTE.hillFar, 46, 560, 0.11],
      [PALETTE.hillNear, 70, 620, 0.23],
    ]) {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(0, FIELD.height);
      for (let x = 0; x <= FIELD.width; x += 16) {
        const y = base - Math.abs(Math.sin((x * 0.004 + time * speed) % Math.PI)) * amp
          - Math.abs(Math.sin((x * 0.011 + time * speed * 1.7) % Math.PI)) * amp * 0.4;
        context.lineTo(x, y);
      }
      context.lineTo(FIELD.width, FIELD.height);
      context.closePath();
      context.fill();
    }
    // Drifting dust motes.
    for (const d of dust) {
      const y = (d.y - time * d.s) % FIELD.height;
      context.globalAlpha = d.a;
      context.fillStyle = '#bfe9ff';
      context.beginPath();
      context.arc(d.x, y < 0 ? y + FIELD.height : y, d.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawRock(x, y, top, left, right) {
    const px = x * TILE;
    const py = y * TILE;
    context.fillStyle = PALETTE.rock;
    context.fillRect(px, py, TILE, TILE);
    if (top) {
      context.fillStyle = PALETTE.rockLight;
      context.fillRect(px, py, TILE, 7);
      context.fillStyle = 'rgba(255,255,255,0.10)';
      context.fillRect(px + 3, py + 7, TILE - 6, 3);
    }
    if (left) {
      context.fillStyle = PALETTE.rockDark;
      context.fillRect(px, py, 4, TILE);
    }
    if (right) {
      context.fillStyle = PALETTE.rockDark;
      context.fillRect(px + TILE - 4, py, 4, TILE);
    }
    context.fillStyle = 'rgba(0,0,0,0.18)';
    context.fillRect(px + 9, py + 16, 7, 6);
    context.fillRect(px + 24, py + 26, 6, 5);
  }

  function drawSpike(x, y, time) {
    const px = x * TILE;
    const py = y * TILE;
    context.fillStyle = PALETTE.spikeDark;
    for (let i = 0; i < 3; i += 1) {
      const bx = px + 3 + i * 12;
      context.beginPath();
      context.moveTo(bx, py + TILE);
      context.lineTo(bx + 6, py + 16);
      context.lineTo(bx + 12, py + TILE);
      context.closePath();
      context.fill();
    }
    context.fillStyle = PALETTE.spike;
    for (let i = 0; i < 3; i += 1) {
      const bx = px + 5 + i * 12;
      context.beginPath();
      context.moveTo(bx, py + TILE);
      context.lineTo(bx + 4, py + 20);
      context.lineTo(bx + 8, py + TILE);
      context.closePath();
      context.fill();
    }
    void time;
  }

  function drawCrystal(cx, cy, time, big = false) {
    const pulse = 1 + Math.sin(time * 3 + cx * 0.05) * 0.08;
    const w = (big ? 15 : 11) * pulse;
    const h = (big ? 21 : 16) * pulse;
    const glow = context.createRadialGradient(cx, cy, 2, cx, cy, w * 2.4);
    glow.addColorStop(0, 'rgba(125,249,255,0.5)');
    glow.addColorStop(1, 'rgba(125,249,255,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy, w * 2.4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.crystal;
    context.beginPath();
    context.moveTo(cx, cy - h);
    context.lineTo(cx + w, cy);
    context.lineTo(cx, cy + h);
    context.lineTo(cx - w, cy);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.crystalCore;
    context.beginPath();
    context.moveTo(cx, cy - h * 0.62);
    context.lineTo(cx + w * 0.45, cy);
    context.lineTo(cx, cy + h * 0.62);
    context.lineTo(cx - w * 0.45, cy);
    context.closePath();
    context.fill();
  }

  function drawPad(x, y, time) {
    const px = x * TILE;
    const py = y * TILE;
    const bob = Math.sin(time * 5 + x) * 2;
    context.fillStyle = '#5a4632';
    context.fillRect(px + 3, py + 26, TILE - 6, 12);
    context.fillStyle = PALETTE.crystal;
    roundRect(px + 2, py + 18 + bob, TILE - 4, 10, 5);
    context.fill();
    context.fillStyle = PALETTE.crystalCore;
    roundRect(px + 6, py + 20 + bob, TILE - 12, 4, 2);
    context.fill();
  }

  function drawPortal(x, y, open, time) {
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + TILE / 2 - 8;
    const color = open ? PALETTE.portal : PALETTE.portalLocked;
    context.save();
    context.globalAlpha = open ? 0.9 : 0.55;
    const glow = context.createRadialGradient(cx, cy, 4, cx, cy, 56);
    glow.addColorStop(0, open ? 'rgba(57,208,255,0.55)' : 'rgba(120,120,150,0.3)');
    glow.addColorStop(1, 'rgba(57,208,255,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy, 56, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.strokeStyle = color;
    context.lineWidth = 5;
    context.beginPath();
    context.ellipse(cx, cy, 20, 30, 0, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(cx, cy, 13, 22, 0, time * (open ? 2 : 0.4), time * (open ? 2 : 0.4) + Math.PI * 1.5);
    context.stroke();
    if (!open) {
      context.fillStyle = 'rgba(20,16,40,0.85)';
      context.beginPath();
      context.arc(cx, cy, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#cfc8ee';
      context.fillRect(cx - 1.5, cy - 5, 3, 10);
      context.fillRect(cx - 5, cy - 1.5, 10, 3);
    } else {
      context.fillStyle = 'rgba(232,253,255,0.9)';
      context.beginPath();
      context.ellipse(cx, cy, 8, 15, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawSlime(s, time) {
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h;
    const wob = Math.sin(time * 6 + s.x * 0.1) * 2;
    context.fillStyle = PALETTE.slimeDark;
    context.beginPath();
    context.ellipse(cx, cy - 9 + wob * 0.4, s.w / 2 + 2, s.h / 2 + wob * 0.5, 0, Math.PI, 0);
    context.fill();
    context.fillStyle = PALETTE.slime;
    context.beginPath();
    context.ellipse(cx, cy - 10 + wob * 0.4, s.w / 2, s.h / 2 - 1 + wob * 0.5, 0, Math.PI, 0);
    context.fill();
    context.fillStyle = '#12330a';
    const look = s.dir * 3;
    context.beginPath();
    context.arc(cx - 7 + look, cy - 16 + wob * 0.3, 2.6, 0, Math.PI * 2);
    context.arc(cx + 7 + look, cy - 16 + wob * 0.3, 2.6, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#12330a';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(cx + look, cy - 8 + wob * 0.3, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();
  }

  function drawPlayer(p, time) {
    if (p.invuln > 0 && Math.floor(time * 12) % 2 === 0) return; // blink while invulnerable
    const cx = p.x + p.w / 2;
    const feet = p.y + p.h;
    const stretch = clamp(1 + Math.abs(p.vy) / 2400, 1, 1.18);
    const squash = p.onGround ? 1 + Math.min(0.12, Math.abs(p.vx) / 2600) : 1;
    const w = p.w * squash;
    const h = p.h * (2 - stretch) * (p.onGround ? 0.96 : 1);
    const x = cx - w / 2;
    const y = feet - h;
    // Lamp glow.
    const glow = context.createRadialGradient(cx + p.face * 12, y + 6, 2, cx + p.face * 12, y + 6, 46);
    glow.addColorStop(0, 'rgba(255,217,77,0.4)');
    glow.addColorStop(1, 'rgba(255,217,77,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx + p.face * 12, y + 6, 46, 0, Math.PI * 2);
    context.fill();
    // Body.
    context.fillStyle = PALETTE.player;
    roundRect(x, y + 8, w, h - 8, 7);
    context.fill();
    context.fillStyle = PALETTE.playerDark;
    context.fillRect(x + 3, y + h - 7, w - 6, 4);
    // Helmet.
    context.fillStyle = PALETTE.helmet;
    context.beginPath();
    context.arc(cx, y + 10, w / 2 + 1, Math.PI, 0);
    context.fill();
    context.fillRect(cx - w / 2 - 1, y + 8, w + 2, 4);
    // Lamp.
    context.fillStyle = '#fff6c9';
    context.beginPath();
    context.arc(cx + p.face * 5, y + 3, 3.4, 0, Math.PI * 2);
    context.fill();
    // Eyes.
    context.fillStyle = '#241a12';
    context.beginPath();
    context.arc(cx + p.face * 4 - 3, y + 16, 2, 0, Math.PI * 2);
    context.arc(cx + p.face * 4 + 4, y + 16, 2, 0, Math.PI * 2);
    context.fill();
    // Feet.
    context.fillStyle = '#7a4a21';
    context.fillRect(x + 2, feet - 4, 8, 4);
    context.fillRect(x + w - 10, feet - 4, 8, 4);
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      context.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      context.fillStyle = pt.color;
      context.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    context.globalAlpha = 1;
    for (const f of state.floats) {
      context.globalAlpha = clamp(f.life, 0, 1);
      text(f.text, f.x, f.y, 18, f.color, 'center', true);
    }
    context.globalAlpha = 1;
  }

  function drawField(state, time) {
    const parsed = state.parsed;
    const solids = parsed.solids;
    for (const key of solids) {
      const [x, y] = key.split(',').map(Number);
      drawRock(x, y, !solids.has(`${x},${y - 1}`), !solids.has(`${x - 1},${y}`), !solids.has(`${x + 1},${y}`));
    }
    for (const sp of parsed.spikes) drawSpike(sp.x, sp.y, time);
    for (const pad of parsed.pads) drawPad(pad.x, pad.y, time);
    for (const c of parsed.crystals) {
      if (c.taken) continue;
      drawCrystal(c.x * TILE + TILE / 2, c.y * TILE + TILE / 2, time);
    }
    drawPortal(parsed.portal.x, parsed.portal.y, state.crystalsGot >= state.crystalsTotal, time);
    for (const s of state.slimes) if (s.alive) drawSlime(s, time);
    drawPlayer(state.player, time);
    drawParticles(state);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function drawHud(state, best) {
    context.fillStyle = 'rgba(10,7,26,0.72)';
    roundRect(0, 0, FIELD.width, 52, 0);
    context.fill();
    text(`Level ${state.levelIndex + 1}/${LEVELS_COUNT} — ${state.level.name}`, 18, 33, 21, PALETTE.text, 'left', true);
    // Crystals.
    drawCrystal(430, 26, 0, false);
    text(`${state.crystalsGot}/${state.crystalsTotal}`, 448, 33, 21, PALETTE.crystal, 'left', true);
    // Hearts.
    for (let i = 0; i < 3; i += 1) {
      const hx = 560 + i * 30;
      context.fillStyle = i < state.lives ? PALETTE.heart : 'rgba(255,93,122,0.25)';
      context.beginPath();
      context.moveTo(hx, 32);
      context.bezierCurveTo(hx - 9, 22, hx - 14, 30, hx, 38);
      context.bezierCurveTo(hx + 14, 30, hx + 9, 22, hx, 32);
      context.fill();
    }
    text(`Score ${state.score}`, 700, 33, 21, PALETTE.gold, 'left', true);
    text(`Time ${formatTime(state.totalTime)}`, 900, 33, 21, PALETTE.text, 'left', true);
    text(`Best ${best}`, 1080, 33, 21, PALETTE.muted, 'left');
    if (state.hintTimer > 0 && state.hint) {
      context.fillStyle = 'rgba(10,7,26,0.8)';
      const w = context.measureText(state.hint).width + 36;
      roundRect((FIELD.width - w) / 2, 64, w, 36, 10);
      context.fill();
      text(state.hint, FIELD.width / 2, 89, 18, PALETTE.gold, 'center', true);
    }
  }

  function panel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(8,5,20,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(x, y, width, height, 16);
    context.stroke();
    text(title, FIELD.width / 2, y + 62, 40, accent ?? PALETTE.crystal, 'center', true);
    lines.forEach((line, i) => {
      // A leading '!' marks a gold, bold line; it is never drawn itself.
      const hot = line.startsWith('!');
      const shown = hot ? line.slice(1) : line;
      text(shown, FIELD.width / 2, y + 108 + i * 34, 20, hot ? PALETTE.gold : PALETTE.text, 'center', hot);
    });
    if (prompt) text(prompt, FIELD.width / 2, y + height - 26, 18, PALETTE.muted, 'center');
  }

  function drawTitle(state, best) {
    drawField(state, state.time);
    context.fillStyle = 'rgba(8,5,20,0.45)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    drawCrystal(FIELD.width / 2 - 320, 400, state.time, true);
    drawCrystal(FIELD.width / 2 + 320, 400, state.time + 1.2, true);
    text('QUARTZ QUEST', FIELD.width / 2, 168, 64, PALETTE.crystal, 'center', true);
    text('A crystal-hunting puzzle platformer', FIELD.width / 2, 206, 22, PALETTE.text, 'center');
    const lines = [
      'Collect every quartz crystal, then reach the portal.',
      'Dodge spikes and stomp slimes — 5 hand-built levels.',
      'Arrows / WASD to move · Space to jump · P to pause · M to mute',
    ];
    lines.forEach((line, i) => text(line, FIELD.width / 2, 268 + i * 32, 20, PALETTE.muted, 'center'));
    if (best > 0) text(`Best score: ${best}`, FIELD.width / 2, 380, 20, PALETTE.gold, 'center', true);
    const pulse = 0.65 + Math.sin(state.time * 3) * 0.35;
    context.globalAlpha = pulse;
    text('Press Space or tap to play', FIELD.width / 2, 440, 24, PALETTE.text, 'center', true);
    context.globalAlpha = 1;
    text('An original game — art, music and levels made for this entry.', FIELD.width / 2, 648, 14, PALETTE.muted, 'center');
  }

  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 22 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 22 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    const time = state.time;
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawBackground(time);
    drawField(state, time);
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      panel('Paused', ['Take a breath, crystal hunter.'], 'Press P or Space to keep playing', PALETTE.text);
    } else if (screen === SCREEN_CLEAR) {
      panel(`Level ${state.levelIndex + 1} Clear!`, [
        `!Time bonus +${state.levelBonus}`,
        `Crystals ${state.crystalsTotal}/${state.crystalsTotal} · Score ${state.score}`,
      ], 'Press Space to continue', PALETTE.gold);
    } else if (screen === SCREEN_OVER) {
      panel('Game Over', [
        `The cave keeps its quartz… this time.`,
        `Score ${state.score} · Best ${Math.max(best, state.score)}`,
      ], 'Press R to try again', PALETTE.heart);
    } else if (screen === SCREEN_WIN) {
      panel('You Found the Quartz Heart!', [
        `!All 5 levels clear — ${state.score} points in ${formatTime(state.totalTime)}`,
        `Best ${Math.max(best, state.score)}`,
        'Thanks for playing Quartz Quest.',
      ], 'Press R to play again', PALETTE.gold);
    }
  }

  return { draw, resize };
}
