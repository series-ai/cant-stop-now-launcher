/**
 * Persistence: best distance, coin wallet, and upgrade levels, saved to
 * RUN's per-player appStorage when the host is present, mirrored to
 * localStorage always (so plain-browser dev keeps progress too, and reads
 * never wait on the host).
 *
 * Posture: loads happen once at boot (main.tsx step 2) into memory; writes
 * are write-through and fire-and-forget. Nothing here ever throws.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { sdkReady } from '../sdk/runSdk.ts';
import { CONFIG } from '../game/config.ts';
import { upgradeCost } from '../game/upgrades.ts';
import type { UpgradeLevels } from './store.ts';
import type { AdsState } from '../systems/ads.ts';

// ADAPT: your game's save key — bump the suffix if the shape ever changes.
const SAVE_KEY = 'launcher:save:v1';

export interface SaveData {
    best: number;
    /** Spendable coin balance (earned by flinging, spent on upgrades). */
    totalCoins: number;
    runs: number;
    upgrades: UpgradeLevels;
    /** Audio settings, 0..1 per bus. */
    settings: { music: number; sfx: number };
    /**
     * Daily rewarded-ad cap state (systems/ads.ts). The ads system mutates
     * this object IN PLACE and calls flushSave() — keep the reference stable
     * when evolving the save shape.
     */
    ads: AdsState;
}

const DEFAULTS: SaveData = {
    best: 0,
    totalCoins: 0,
    runs: 0,
    upgrades: { launch: 0, bounce: 0, fuel: 0, jelly: 0 },
    settings: { music: 0.6, sfx: 0.8 },
    ads: { watchedToday: 0, lastResetDay: null },
};

let data: SaveData = structuredClone(DEFAULTS);

const clampLevel = (v: unknown): number =>
    Math.min(CONFIG.upgrades.maxLevel, Math.max(0, Math.floor(Number(v) || 0)));

function parse(raw: string | null): SaveData | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        const up = (parsed.upgrades ?? {}) as Partial<UpgradeLevels>;
        const vol = (v: unknown, fallback: number): number => {
            const n = Number(v);
            return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
        };
        const settings = parsed.settings && typeof parsed.settings === 'object'
            ? { music: vol(parsed.settings.music, 0.6), sfx: vol(parsed.settings.sfx, 0.8) }
            : { music: 0.6, sfx: 0.8 };
        const ads = parsed.ads && typeof parsed.ads === 'object'
            ? {
                watchedToday: Math.max(0, Math.floor(Number(parsed.ads.watchedToday) || 0)),
                lastResetDay: typeof parsed.ads.lastResetDay === 'string' ? parsed.ads.lastResetDay : null,
            }
            : { watchedToday: 0, lastResetDay: null };
        return {
            best: Math.max(0, Math.floor(Number(parsed.best) || 0)),
            totalCoins: Math.max(0, Math.floor(Number(parsed.totalCoins) || 0)),
            runs: Math.max(0, Math.floor(Number(parsed.runs) || 0)),
            upgrades: {
                launch: clampLevel(up.launch),
                bounce: clampLevel(up.bounce),
                fuel: clampLevel(up.fuel),
                jelly: clampLevel(up.jelly),
            },
            settings,
            ads,
        };
    } catch {
        return null;
    }
}

/** Load the save into memory. Call once at boot, after initSdk(). */
export async function loadSave(): Promise<SaveData> {
    let loaded: SaveData | null = null;
    if (sdkReady()) {
        try {
            loaded = parse(await RundotGameAPI.appStorage.getItem(SAVE_KEY));
        } catch {
            /* host storage unavailable — fall through to localStorage */
        }
    }
    if (!loaded) {
        try { loaded = parse(localStorage.getItem(SAVE_KEY)); } catch { /* blocked storage */ }
    }
    data = loaded ?? structuredClone(DEFAULTS);
    return data;
}

export function getSave(): SaveData {
    return data;
}

/** Write-through persist of the in-memory save. Fire-and-forget, never throws. */
export function flushSave(): void {
    const raw = JSON.stringify(data);
    try { localStorage.setItem(SAVE_KEY, raw); } catch { /* blocked storage */ }
    if (sdkReady()) {
        try {
            RundotGameAPI.appStorage.setItem(SAVE_KEY, raw).catch(() => { /* offline */ });
        } catch { /* non-fatal */ }
    }
}

/**
 * Fold a finished fling into the save: the wallet earns the coins collected
 * plus a distance bonus (1 per CONFIG.score.metersPerCoin meters).
 */
export function recordRun(meters: number, coins: number): {
    best: number;
    newBest: boolean;
    totalCoins: number;
    payout: number;
    distanceBonus: number;
} {
    const distanceBonus = Math.floor(meters / CONFIG.score.metersPerCoin);
    const payout = coins + distanceBonus;
    const newBest = meters > data.best;
    data = {
        ...data,
        best: Math.max(data.best, meters),
        totalCoins: data.totalCoins + payout,
        runs: data.runs + 1,
    };
    flushSave();
    return { best: data.best, newBest, totalCoins: data.totalCoins, payout, distanceBonus };
}

let settingsFlushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Update audio settings. Slider drags fire this continuously, so the
 * persist is debounced (the in-memory value is current immediately).
 */
export function setSettings(partial: Partial<SaveData['settings']>): void {
    data = { ...data, settings: { ...data.settings, ...partial } };
    if (settingsFlushTimer) clearTimeout(settingsFlushTimer);
    settingsFlushTimer = setTimeout(() => {
        settingsFlushTimer = null;
        flushSave();
    }, 400);
}

/** Grant bonus coins (rewarded-ad doubling). Returns the new balance. */
export function addBonusCoins(amount: number): number {
    data = { ...data, totalCoins: data.totalCoins + Math.max(0, Math.floor(amount)) };
    flushSave();
    return data.totalCoins;
}

/**
 * Buy the next level of an upgrade track. Returns the new save state, or
 * null if the track is maxed or the wallet can't cover it.
 */
export function buyUpgrade(track: keyof UpgradeLevels): SaveData | null {
    const cost = upgradeCost(data.upgrades[track]);
    if (cost === null || data.totalCoins < cost) return null;
    data = {
        ...data,
        totalCoins: data.totalCoins - cost,
        upgrades: { ...data.upgrades, [track]: data.upgrades[track] + 1 },
    };
    flushSave();
    return data;
}
