# Quartz Quest

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Tenguu0/quartz-quest/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Tenguu0/quartz-quest/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A crystal-hunting puzzle platformer, built for the [make.fun best-game-01](https://make.fun/bounty/best-game-01) bounty. An original game — all art, music, sound and levels were made for this entry.

## The game

You are a little miner with a helmet lamp, deep in a quartz cave. In each of
5 hand-built levels, collect **every quartz crystal**, then reach the **portal**
to move on. The portal stays locked until the last crystal is taken.

- **Hazards:** spike beds, patrolling slimes (stomp them for +50), and pits.
  Touching a spike or a slime costs a life — 3 lives per level.
- **Bounce pads** launch you to high ledges.
- **Scoring:** +100 per crystal, +50 per stomped slime, and a time bonus on
  every level clear (the faster you finish, the more it pays).
- **Win:** clear all 5 levels and find the Quartz Heart. Your best score is
  kept in the browser.

## Controls

| Input | Action |
| --- | --- |
| Arrow keys / WASD | Move |
| Space / Up / W | Jump (hold for a higher jump) |
| P / Esc | Pause |
| M | Mute |
| R | Restart |
| Touch buttons | On-screen ◀ ▶ and jump buttons on touch devices |

## Play it

The game is plain static files under `game/` — no build step, no network
request. Serve it and open `game/index.html`:

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Or open `game/index.html` directly from any static file server.

## Levels

1. **First Light** — learn the ropes: platforms, one spike bed, one slime.
2. **Spike Garden** — spike beds and a pit to jump.
3. **The Climb** — a staircase of quartz ledges, step by step.
4. **Slime Hollow** — bounce pads and three slimes.
5. **Quartz Heart** — everything at once. No mercy.

## How it was tested

The game ships with a built-in autopilot (a BFS planner over the level's
"stands" that plays the real physics) used by the title-screen attract mode
and by the `?shot=` screenshot scenes. In headless testing it genuinely
clears all 5 levels (score 4920 in 43.4s), and the game was also play-tested
live in Chromium: title, movement, jumping, crystal collection, pause,
game over, and the victory screen were all exercised and screenshotted
(see `screenshots/`).

## Files

- `game/` — the playable game (`index.html` + ES modules under `src/`).
- `game/src/world.js` — physics, entities, scoring, and the autopilot planner.
- `game/src/levels.js` — the five hand-built levels.
- `game/src/render.js` — all canvas art (no image assets).
- `game/src/audio.js` — WebAudio sound effects and music (no audio files).
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`.
- `screenshots/` — 4 real renders of the game's own code in a browser.

## License

MIT — see [LICENSE](LICENSE).
