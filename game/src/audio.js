// Quartz Quest — all sound is synthesized with WebAudio: no audio files.
// SPDX-License-Identifier: MIT

export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = 0;
  let musicStep = 0;

  // A gentle cave-music loop: a minor pentatonic arpeggio, one soft note per
  // beat, scheduled from the game loop so it stays in sync with the tab.
  const MELODY = [220, 261.6, 293.7, 329.6, 392, 329.6, 293.7, 261.6, 220, 196, 261.6, 329.6];

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; return muted; },
    jump() { tone(280, 0.16, 'square', 0.05, 0, 540); },
    collect() { tone(880, 0.1, 'sine', 0.09); tone(1318, 0.16, 'sine', 0.09, 0.07); },
    stomp() { tone(220, 0.18, 'square', 0.08, 0, 70); },
    hurt() { tone(420, 0.3, 'sawtooth', 0.07, 0, 90); },
    pad() { tone(180, 0.22, 'sine', 0.09, 0, 920); },
    clear() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.16, 'triangle', 0.09, i * 0.09)); },
    win() { [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.09, i * 0.12)); },
    click() { tone(660, 0.06, 'square', 0.05); },
    deny() { tone(160, 0.14, 'square', 0.06, 0, 110); },
    /** Advance the music loop by `dt` seconds of game time. */
    music(dt) {
      if (muted) return;
      musicTimer -= dt;
      if (musicTimer <= 0) {
        musicTimer += 0.24;
        const f = MELODY[musicStep % MELODY.length];
        musicStep += 1;
        tone(f, 0.22, 'sine', 0.028);
        if (musicStep % 4 === 0) tone(f / 2, 0.4, 'sine', 0.02);
      }
    },
  };
}
