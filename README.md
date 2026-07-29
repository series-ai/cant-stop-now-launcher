# Launcher Game Template for RUN.game

Build your own 2D launcher game (fling far, bounce, upgrade, fling farther), fast. This template is a complete, playable launcher — drag-back slingshot aiming with a trajectory preview, flight physics with ground bounces, bounce-off objects that keep flights alive, hazards, rocket boosts, coins with a distance bonus, a four-track upgrade shop, rewarded ads, music and sound, settings, and persistence — all wired to the RUN.game platform (Pixi.js v8 + React 19 + Tailwind v4 + the RundotGameAPI SDK).

Everything you see is a placeholder for YOUR game: the art and audio are generated procedurally at runtime (zero assets), so the template runs immediately, and every sprite and sound has a documented swap point for your own content. The `example-games/launcher` folder in this repo shows one finished game built from exactly this starting point.

## What You Get

- **A launch loop that feels right out of the box**: drag-to-aim with power-colored trajectory dots, air drag, upgradeable restitution bounces, roll-out endings, a vertical camera that follows big arcs
- **Flight objects as a pattern**: bouncy jellies, lifting balloons, momentum-killing spike mines, ground-running tintable critters, coin patterns — all one spawner you can reshape
- **Meta loop**: payout = coins collected + distance bonus → four upgrade tracks (example content) that visibly change the next fling
- **Platform integration, done**: per-player saves (with local fallback for dev), an all-time leaderboard with a dedicated leaderboard screen (auto-created on deploy), rewarded-ad payout doubling under a tamper-proof 15/day cap, analytics events, haptics, host lifecycle handling, quit confirmation
- **Audio**: synthesized music loop + SFX on music/sound buses with a settings screen; swap in real files without touching call sites
- **Art pipeline**: drop a PNG in `public/images/`, list it in the manifest under a known alias, and it replaces the placeholder — one sprite at a time

## Quick Start

```bash
npm install
npm run dev            # http://localhost:5173 — playable immediately
```

## Make It Yours (the intended path)

1. **Feel**: tune `src/game/config.ts` — gravity, launch power, drag, restitution, spawn mix, upgrade costs. Everything is data.
2. **World + character**: change the palette in `config.ts` colors and `src/styles/app.css`, redraw placeholders in `src/game/textures.ts`, or swap in real art via `src/assets/manifest.ts` (art spec in CLAUDE.md).
3. **Content**: reshape the flight objects (`entities.ts` + their responses in `launcherScene.ts`) and replace the example upgrade tracks (`src/game/upgrades.ts`) with your own progression.
4. **Identity**: title in `index.html`, `src/ui/MainMenu.tsx`, `src/ui/LoadingScreen.tsx`; save key in `src/state/save.ts`; package name.
5. **Audio**: retune the synth song data in `src/audio/audio.ts` or swap in real files (notes at the top of that file).
6. **More systems**: daily rewards, IAP shop, quests, tutorial and more are available as copy-in modules from the [`@series-inc/run-game-helpers`](https://www.npmjs.com/package/@series-inc/run-game-helpers) npm package — the ads system here came from it.

Search the source for `ADAPT:` for every intended edit point. UI copy rules (why text sizes and punctuation look the way they do) are in CLAUDE.md.

## Deploy to RUN.game

Needs the [RUN.game CLI](https://github.com/series-ai/rundot-cli-releases).

```bash
rundot login
rundot init --name <your-game> --description "<desc>" --build-path dist --orientation Portrait
npm run build
rundot deploy
```

`rundot init` runs ONCE per game (it registers the game and writes the config into `rundot/`); after that, iterating is just `npm run build && rundot deploy`. Deploys are **private by default** — playable by you via your profile / `rundot list-games`, but not listed on the Explore page until you deploy with `--public`.

Before your first deploy, replace `public/thumbnail.jpg` with your game's tile art — **exactly 512×512, JPG**.

## Where Things Live

```
src/game/config.ts         // every gameplay tunable (start here)
src/game/launcherScene.ts  // the fling: aiming, flight, bounces, camera, run flow
src/game/entities.ts       // flight objects + coin patterns (example content)
src/game/upgrades.ts       // upgrade tracks + effect helpers (example content)
src/game/background.ts     // two-axis parallax (scroll + vertical camera)
src/game/textures.ts       // art slots: real art via manifest, procedural fallback
src/audio/audio.ts         // music + sfx buses (synth now, files later)
src/state/                 // store (UI state), save (persistence)
src/sdk/leaderboard.ts     // all-time board (submit + podium fetch)
src/systems/, src/shared/  // copy-in platform systems (ads, trusted clock)
src/ui/                    // menu, upgrade shop, settings, HUD, results
```
