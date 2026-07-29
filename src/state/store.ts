/**
 * Tiny external store bridging game code (Pixi ticker, SDK callbacks, plain
 * modules) and React — no state-library dependency. Game code calls
 * store.patch(); React components subscribe with useStore(selector).
 *
 * Keep this store for UI-FACING state only (phase, HUD numbers, popups).
 * Per-frame simulation state stays inside the Pixi scene — patching the
 * store every frame re-renders React every frame.
 */
import { useSyncExternalStore } from 'react';

/** The four upgrade tracks (see game/upgrades.ts for the catalog). */
export interface UpgradeLevels {
    launch: number;
    bounce: number;
    fuel: number;
    jelly: number;
}

/** The UI-facing app state. */
export interface AppState {
    /**
     * loading → menu ⇄ shop/settings/leaderboard, menu → playing → gameover
     * (gameover keeps the canvas mounted so the overlay sits on the final
     * frame).
     */
    phase: 'loading' | 'menu' | 'shop' | 'settings' | 'leaderboard' | 'playing' | 'gameover';
    /** 0..1 progress of the critical-asset warm during 'loading' */
    loadProgress: number;
    /** Set by the host's onPause/onResume lifecycle hooks */
    paused: boolean;
    /** Quit confirmation dialog is up (freezes the game like a pause) */
    quitConfirm: boolean;
    /** Bumped to force a fresh scene mount — "Retry" is a keyed remount */
    runId: number;
    /** Within a run: aiming on the pad, then flying (includes rolling out) */
    flight: 'aiming' | 'flying';
    /** Current fling: distance in meters (patched on whole-meter ticks) */
    distance: number;
    /** Current fling: coins collected mid-air */
    coins: number;
    /** Rocket boosts left this fling */
    fuel: number;
    /** Rocket boost capacity (rocket.capacity + fuel upgrade level) */
    fuelMax: number;
    /** Current fling: wallet payout (coins + distance bonus), set at run end */
    payout: number;
    /** Current fling: the distance-bonus part of the payout, set at run end */
    distanceBonus: number;
    /** All-time best distance in meters (from the save) */
    best: number;
    /** True right after a fling that beat the previous best */
    newBest: boolean;
    /** Spendable coin wallet (from the save; the shop deducts from it) */
    totalCoins: number;
    /** True once this fling's payout was doubled via the rewarded ad */
    coinsDoubled: boolean;
    /** Upgrade levels (from the save) */
    upgrades: UpgradeLevels;
    /** Music volume 0..1 (mirrored to the audio engine and the save) */
    musicVolume: number;
    /** Sound-effects volume 0..1 */
    sfxVolume: number;
    /** All-time leaderboard rank returned after this run's submit (host only) */
    lbRank: number | null;
}

const listeners = new Set<() => void>();

let state: AppState = {
    phase: 'loading',
    loadProgress: 0,
    paused: false,
    quitConfirm: false,
    runId: 0,
    flight: 'aiming',
    distance: 0,
    coins: 0,
    fuel: 0,
    fuelMax: 0,
    payout: 0,
    distanceBonus: 0,
    best: 0,
    newBest: false,
    totalCoins: 0,
    coinsDoubled: false,
    upgrades: { launch: 0, bounce: 0, fuel: 0, jelly: 0 },
    musicVolume: 0.6,
    sfxVolume: 0.8,
    lbRank: null,
};

export const store = {
    /** Read the current state (from game code; in React use useStore). */
    get: (): AppState => state,
    /** Shallow-merge a partial update and notify React subscribers. */
    patch(partial: Partial<AppState>): void {
        state = { ...state, ...partial };
        for (const l of listeners) l();
    },
    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

/** Reset per-run fields and (re)enter the playing phase with a fresh scene. */
export function startRun(): void {
    store.patch({
        phase: 'playing',
        runId: store.get().runId + 1,
        flight: 'aiming',
        distance: 0,
        coins: 0,
        payout: 0,
        distanceBonus: 0,
        newBest: false,
        coinsDoubled: false,
        quitConfirm: false,
        lbRank: null,
    });
}

/**
 * React hook. IMPORTANT: the selector must return a primitive or a stable
 * reference (e.g. s => s.phase). Returning a fresh object/array each call
 * makes React re-render forever.
 */
export function useStore<T = AppState>(
    selector: (s: AppState) => T = (s) => s as unknown as T
): T {
    return useSyncExternalStore(store.subscribe, () => selector(state));
}
