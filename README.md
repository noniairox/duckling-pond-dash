# duckling-pond-dash

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/noniairox/duckling-pond-dash/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/noniairox/duckling-pond-dash/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A duckling hops between lily pads on a sunny pond, eating breadcrumbs while a heron swoops at its pad — and from level 3, a cat leaps from the bank too. Crumbs eaten in a row build a combo worth up to x3 points, golden crumbs pay 50, star crumbs pay 100 and start FEVER (double points for 8 seconds), and a shield bubble absorbs one hit. A turtle surfaces from level 3 and blocks a pad — hop off before it bumps you. From level 4 some pads drift sideways, fish leap from the water, dragonflies flit overhead, and the pond turns to dusk, then night with a moon and fireflies. A pad that wobbles is about to sink, and the water costs a life. Three lives, 300 points wins the pond.

## How to play

- **Hop:** arrow keys / WASD to hop to a pad in that direction, or click a pad to hop to it.
- **Eat:** land on a pad with breadcrumbs for +10 points — in a row, the combo pays x2, then x3. A golden crumb is worth 50, a star crumb 100 and starts FEVER (double points for 8 seconds). Every 50 points raises the level: the heron swoops faster and the pads sink sooner.
- **Shield:** land on a shield bubble and the next hit (heron, cat, turtle or sinking pad) breaks it instead of costing a life.
- **Dodge:** when the heron hovers over a pad, hop away before it swoops. The cat crouches on the bank, then leaps at your pad. From level 3 a turtle surfaces on a pad and blocks it — land on it and it bumps you off. From level 4, some pads drift — ride them, don't be left behind.
- **Survive:** a pad that wobbles is sinking — hop off before it goes under, or you lose a life. 3 lives; 300 points is Pond Champion.
- **Pause:** P. **Mute:** M. **Start / restart:** Enter, R, or click.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

The game is plain static files (game/index.html and its ES modules, no library, no network request) and runs offline in a desktop browser. `?seed=N` fixes the pond's pattern; `?shot=start|play|gold|end&seed=1` stages a screenshot scene.

## Hand in

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

Entered on [make.fun](https://make.fun/?ref=pgd6qh00&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards

## Files

- `game/` — the playable game: index.html and its ES modules (world, render, input, shots, sound, particles).
- `screenshots/` — 4 renders of the real game: the action cover, title, play, and the golden/star showcase.
- `main.ts` — the entry program: copies game/ and screenshots/ to /output and writes dossier.json.
- `serve.ts` — a tiny local server for play-testing.
- `vendor/makefun-game.ts` — make.fun's dossier library (vendored, unchanged).
- `LICENSE` — MIT.
- `.makefun/owner.json` — the entry wallet claim.
