/**
 * Upgrade catalog: the meta-progression that makes a launcher game tick.
 * Levels are persisted in the save; the cost curve and effect scaling live
 * in CONFIG (config.ts) so tuning stays in one place.
 *
 * ADAPT: the four tracks below are EXAMPLE content. Rename them, change
 * what they do (the `effects` helpers are where levels touch physics), add
 * tracks (extend UpgradeLevels in state/store.ts + defaults in
 * state/save.ts), or delete the system (this file, ui/Shop.tsx, the
 * upgrades fields in save/store, the SHOP button).
 */
import { CONFIG } from './config.ts';
import type { UpgradeLevels } from '../state/store.ts';

export type UpgradeTrack = keyof UpgradeLevels;

export interface UpgradeDef {
    track: UpgradeTrack;
    name: string;
    /** What the next level does, in player words (shown in the shop). */
    description: string;
    /** Shop badge color (CSS). */
    color: string;
}

export const UPGRADES: UpgradeDef[] = [
    {
        track: 'launch',
        name: 'Launch Power',
        description: 'Fling harder off the pad',
        color: '#fb923c',
    },
    {
        track: 'bounce',
        name: 'Bounciness',
        description: 'Keep more speed on every ground bounce',
        color: '#2dd4bf',
    },
    {
        track: 'fuel',
        name: 'Rocket Fuel',
        description: 'One more mid-air smash per fling',
        color: '#f87171',
    },
    {
        track: 'jelly',
        name: 'Jelly Punch',
        description: 'Jellies pop you higher and faster',
        color: '#ef5da8',
    },
];

/** Coin cost of buying the NEXT level (level is the current level, 0-based). */
export function upgradeCost(level: number): number | null {
    if (level >= CONFIG.upgrades.maxLevel) return null; // maxed
    return CONFIG.upgrades.costs[level];
}

/** Effect helpers, so scene code reads as prose. */
export const effects = {
    maxLaunchPower: (levels: UpgradeLevels) =>
        CONFIG.launch.maxPower + CONFIG.launch.powerPerLevel * levels.launch,
    restitution: (levels: UpgradeLevels) =>
        CONFIG.physics.restitution + CONFIG.physics.restitutionPerLevel * levels.bounce,
    fuelMax: (levels: UpgradeLevels) =>
        CONFIG.rocket.capacity + levels.fuel,
    jellyPopVy: (levels: UpgradeLevels, incomingVy: number) =>
        CONFIG.jelly.popVy + CONFIG.jelly.popVyPerLevel * levels.jelly
        + Math.abs(incomingVy) * CONFIG.jelly.vyCarry,
    jellyPopVx: (levels: UpgradeLevels) =>
        CONFIG.jelly.popVx + CONFIG.jelly.popVxPerLevel * levels.jelly,
};
