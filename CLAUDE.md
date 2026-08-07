# Launcher Template — build your own launcher game on this scaffolding

A complete, playable 2D launcher (portrait) for
RUN.game, meant to be turned into YOUR game — not reskinned. Built on
`run-template-2d-pixi-react` patterns (design-unit stage, store bridge, SDK
posture, boot order), which all hold. Coordinates: gameplay happens in a
`world` container where **y = 0 is the ground line and up is negative**;
the hero's world x is FIXED (the world scrolls past them) and a vertical
camera shifts `world.y` to follow altitude. Search `ADAPT:` for every
intended edit point.

## Structure (systems vs example content)

Systems (keep, tune, or delete whole):

- **src/game/config.ts** — every gameplay tunable (flight physics,
  slingshot, boosts, object responses, spawn mix, upgrade cost curve, ads,
  palette). Tune here first.
- **src/game/launcherScene.ts** — the fling orchestrator: drag-back aiming
  (trajectory preview whose dots heat white → red with pull strength),
  launch, flight integration (gravity, air drag, restitution bounces,
  roll-out ending), boosts, smooth vertical camera, scoring, results flow.
  One scene per run; retries are keyed remounts (`store.runId`) — no reset
  path to maintain.
- **src/game/entities.ts** — distance-based spawner + circle contacts for
  flight objects and coins; single-use objects, pop particles, descending-
  only rules where wanted (slimes).
- **src/game/background.ts** — TWO-AXIS parallax: horizontal factors per
  layer plus `setCamera(camY)` (ground rig slides away as the hero climbs,
  clouds lighter, sky stays). Includes the TilingSprite addressModeV clamp
  (prevents a hairline at the top of tiling layers).
- **src/game/particles.ts** — pooled particle bursts.
- **src/audio/audio.ts** — music/sfx buses, synthesized placeholders, and
  the documented real-file swap (header comment). Volumes persist in the
  save; Settings screen edits them.
- **src/state/save.ts** — persistence: RUN `appStorage` + localStorage
  write-through, loaded once at boot (main.tsx step 2), flushed on
  onSleep/onQuit. All mutations return new state for store patching.
- **src/systems/ads.ts + src/shared/serverTime.ts + src/sdk/ads.ts** —
  rewarded-ads core from the npm package `@series-inc/run-game-helpers`
  (copy-in library; get daily rewards, IAP shop, quests, tutorial and more
  from it the same way): shared daily cap on a trusted clock, subscriber
  instant-grant, RunBucks fallback, `grantReward()` chokepoint, dev
  fake-ads outside the host. To drop ads: remove those files, the
  `save.ads` slice, and the GameOver offer block.
- **src/sdk/leaderboard.ts + rundot/leaderboard.config.json +
  src/ui/Leaderboard.tsx** — all-time leaderboard (simple security; the
  board is auto-created on `rundot deploy` from the config). The scene
  submits at fling end fire-and-forget (server keeps each player's best;
  the returned rank shows on the results screen); the LEADERBOARD screen renders
  top 10 with medal rows plus the player's neighborhood in one
  `getPodiumScores` call. Real boards are host-only: in plain-browser dev
  the SDK self-mocks after init, so `sdkReady()` is TRUE, fetches succeed
  against an empty mock board, and the UI shows its EMPTY state (the
  offline state only appears if SDK init itself fails). ADAPT:
  what score means, the config bounds, and the "m" display suffix.
- **src/ui/** — screens: `MainMenu`, `Shop` (upgrades), `Settings`,
  `Leaderboard`, `Hud`
  (pointer-events-none overlay, BOOSTS pips, contextual hints, quit
  confirmation that freezes the game), `GameOver` (payout receipt; canvas
  stays mounted underneath).
- **game.config.prod.json** — Ships pre-baked with `kitId: "cant-stop-now-launcher"` so
  `rundot init` can attribute the game to this kit for the jam leaderboard;
  do not remove or blank out `kitId`. `rundot init` fills in the rest
  (`gameId`, `keywords`) in place.

Example content (REPLACE with your game's):

- Flight objects: jellies, balloons, spike mines, tintable ground slimes,
  coin patterns — their art, spawn weights (`config.ts`), and physics
  responses (`launcherScene.ts` contact handlers).
- **src/game/upgrades.ts** — four example upgrade tracks; the `effects`
  helpers are where levels touch physics. Rename, rework, extend, or
  delete the system.
- The synth song data and SFX voices in `audio/audio.ts`.
- Titles/copy in `index.html`, `MainMenu`, `LoadingScreen`; palette in
  `app.css` + `config.ts`.

## Art: real images over procedural fallbacks

Every texture resolves REAL ART FIRST (alias listed in
`src/assets/manifest.ts` → loaded at boot), then falls back to the drawn
placeholder — replace art one sprite at a time and the game always runs.
Scene teardown calls `freeTexture()` (textures.ts), which frees
placeholders but never manifest art. Author at 2x the design-unit display
size; sprites size themselves, so aspect matters more than exact pixels.

| Alias | Display (design units) | Author (px) | Notes |
|---|---|---|---|
| `player` | 92 diameter | 184 × 184 | Round-ish hero; spins in flight, squashes on bounces |
| `jelly` | ~112 | 224 × 224 | The bounce-on object |
| `balloon` | 88 wide × 128 tall | 176 × 255 | Balloon + string below |
| `spike` | ~118 incl. spikes | 236 × 236 | Hazard |
| `slime` | 80 × 64 | 160 × 128 | MUST be white/grayscale (engine tints per instance) |
| `coin` | 52 × 52 | 104 × 104 | |
| `pad` | 110 × 45 | 440 × 180 | Launch pad |
| `cloud` | ~130 × 55 | 520 × 220 | |
| `city` | 720 wide × 220 tall | 1440 × 440 | MUST tile horizontally seamlessly |
| `hills` | 720 wide × 160 tall | 1440 × 320 | MUST tile horizontally seamlessly |
| `ground` | 360 wide × 150 tall | 720 × 300 | MUST tile horizontally; top edge is the ground line |
| `sky` | full screen | e.g. 16 × 512 | Stretched to fit; a soft vertical gradient |

Tiling layers assume 2x-authored art (TilingSprite tileScale is 0.5).

## UI Copy Style

- Never use em dashes (—) in player-facing text. Use commas, parentheses,
  or separate lines instead. (Code comments are exempt.)
- Keep instructions short and imperative, one idea per line.
- Minimum text size: 1.1rem (~17.6px). Never render player-facing text
  smaller unless explicitly asked, it is too small to read on most mobile
  devices. Tailwind's text-xs/text-sm are both below this floor; use
  text-[1.1rem] or larger instead.

## Invariants to Preserve

- Store patches on discrete events only (meter ticks, pickups, fuel
  changes, phase changes) — never per-frame.
- Textures freed via `freeTexture()` on scene teardown, never
  `texture.destroy()` directly.
- `dt` clamped to 50ms in the scene tick (tab-switch spikes must not
  teleport the hero).
- SDK calls (analytics, haptics, storage, ads) are try/catch'd AND
  promise-caught; the game must run SDK-less in a plain browser.
- Aim input starts on `app.canvas` (HUD buttons never leak into it) but
  the drag tracks on `window` so leaving the canvas mid-drag doesn't drop
  it.
- The ads system mutates `save.ads` IN PLACE — keep that reference stable.
- Scrollable DOM lists need `touch-pan-y` (body locks touch-action for
  game input).

## AI Agent Recipes (complete checklists for common requests)

After ANY recipe, run `npx tsc --noEmit` — the compiler catches leftovers
(`noUnusedLocals` is on, so dead imports fail the build).

**"Remove the upgrade shop"**
- Delete `src/game/upgrades.ts` and `src/ui/Shop.tsx`.
- `src/ui/App.tsx`: remove the Shop import and the `phase === 'shop'` route.
- `src/ui/MainMenu.tsx`: remove the SHOP button.
- `src/state/store.ts`: remove `UpgradeLevels` and the `upgrades` field
  (interface and initial state); remove `'shop'` from the phase union.
- `src/state/save.ts`: remove `upgrades` from SaveData, DEFAULTS, and
  parse(); delete `buyUpgrade` and `clampLevel`; remove the `upgradeCost`
  and `UpgradeLevels` imports.
- `src/main.tsx`: remove `upgrades` from the boot patch.
- `src/game/launcherScene.ts`: remove the `effects`/`getSave` upgrade reads
  — replace `effects.maxLaunchPower(levels)` with `CONFIG.launch.maxPower`,
  `effects.restitution(levels)` with `CONFIG.physics.restitution`,
  `effects.fuelMax(levels)` with `CONFIG.rocket.capacity`, and the jelly
  helpers with `CONFIG.jelly.popVy + |vy| * CONFIG.jelly.vyCarry` /
  `CONFIG.jelly.popVx`.
- `src/game/config.ts`: remove the `upgrades` section (the `perLevel`
  fields can stay or go).

**"Remove rewarded ads"**
- Delete `src/systems/ads.ts` and `src/sdk/ads.ts`; also
  `src/shared/serverTime.ts` if nothing else uses the trusted clock.
- `src/state/save.ts`: remove the `ads` slice (SaveData, DEFAULTS, parse)
  and the `AdsState` import.
- `src/ui/GameOver.tsx`: remove the double-payout offer block and dialog,
  the `adsSystem`/`formatCountdown` imports, and the `adFlow`/`adReady`/
  `failNote` state.
- `src/main.tsx`: remove the `refreshServerTime` import and calls (if
  serverTime was deleted).
- `src/game/config.ts`: remove the `ads` section.

**"Remove audio"**
- Delete `src/audio/audio.ts` and `src/ui/Settings.tsx`.
- `src/ui/App.tsx`: remove the Settings import/route; `src/ui/MainMenu.tsx`:
  remove the gear button; `src/state/store.ts`: remove `musicVolume`/
  `sfxVolume` and `'settings'` from the phase union.
- Remove all `sfx.*` calls and audio imports in:
  `src/game/launcherScene.ts`, `src/ui/Shop.tsx`, `src/ui/GameOver.tsx`,
  `src/ui/MainMenu.tsx`.
- `src/state/save.ts`: remove `settings` (SaveData, DEFAULTS, parse) and
  `setSettings`; `src/main.tsx`: remove `initAudio`/`suspendAudio`/
  `resumeAudio`, the volume boot patch, and the visibilitychange listener.

**"Remove the leaderboard"**
- Delete `src/sdk/leaderboard.ts`, `src/ui/Leaderboard.tsx`, and
  `rundot/leaderboard.config.json`.
- `src/ui/App.tsx`: remove the Leaderboard import and the
  `phase === 'leaderboard'` route.
- `src/ui/MainMenu.tsx`: remove the LEADERBOARD button.
- `src/state/store.ts`: remove `lbRank` (interface, initial state, and the
  `startRun` reset); remove `'leaderboard'` from the phase union.
- `src/game/launcherScene.ts`: remove the `submitRunScore` import and the
  submit block in `endRun`.
- `src/ui/GameOver.tsx`: remove the `lbRank` selector and the
  "#N all time" line.

**"Add a flight object kind"**
- `src/game/config.ts`: add a section for it + a weight in
  `spawn.weights`; extend the `AirKind` union.
- `src/game/textures.ts`: a make* function + manifest alias.
- `src/game/entities.ts`: spawn case, per-frame animation, contact event
  in `ContactEvents` + `resolve()`.
- `src/game/launcherScene.ts`: the physics response in the contact block.

**"Remove the ground slimes"**
- `src/game/config.ts`: remove the `slime` section.
- `src/game/textures.ts`: remove `makeSlimeTexture`.
- `src/game/entities.ts`: remove the `Slime` interface, `slimes` array,
  `spawnSlime`, `distToNextSlime`, the slime update/resolve blocks, the
  `slime` field of `ContactEvents`, and the `descending` parameter if
  nothing else needs it.
- `src/game/launcherScene.ts`: remove the `hit.slime` block; `src/audio/
  audio.ts`: remove `sfx.slime`.

**"Use my art / my audio"** — see the art table above (manifest aliases)
and the ADAPT header in `src/audio/audio.ts`.

**"Rename the game"** — `<title>` in index.html, headings in
`MainMenu.tsx` + `LoadingScreen.tsx`, `name` in package.json, SAVE_KEY in
`src/state/save.ts`.

## Verification

- `npm run build` (type-checks then bundles) passes; `npm run dev` boots
  to the menu with no console errors.
- Play: drag shows arrow + power-colored preview dots; release launches;
  bounces lose speed; jellies/slimes/balloons boost; spikes slam; a tap
  smash-dives (even from a roll) and its landing bounces back big, spending
  a pip; roll-out → results → RETRY restarts cleanly (no WebGL
  context warnings); upgrades visibly change the next fling; best, wallet,
  and volume sliders survive a reload; ad doubling works (fake ad in dev)
  and respects the daily cap.
- Resize the device toolbar mid-flight: ground stays bottom-anchored,
  camera math holds.
- Before first deploy: real 512×512 `public/thumbnail.jpg`, `rundot init`
  has been run.
