/**
 * Air objects: jellies (big bounce), balloons (small lift), spike mines
 * (momentum killers), and coin patterns. Everything lives in the world
 * container (y = 0 is the ground line, up is negative) and scrolls left
 * past the fixed-x hero as they fly.
 *
 * Spawning is distance-based: every minGap..maxGap units of travel, one
 * object (or coin pattern) appears ahead at a random altitude. Spikes stay
 * out of the early meters (CONFIG.spawn.spikeMinMeters).
 */
import { Container, Sprite, type Renderer } from 'pixi.js';
import { CONFIG, type AirKind } from './config.ts';
import {
    makeJellyTexture, makeBalloonTexture, makeSpikeTexture, makeCoinTextures,
    makeSlimeTexture, freeTexture,
} from './textures.ts';
import type { ParticleSystem } from './particles.ts';

interface AirObject {
    kind: AirKind;
    sprite: Sprite;
    baseY: number;
    radius: number;
    /** Spawn scale (fits the art to the object's size); squish animates around it. */
    baseScale: number;
    age: number;
    /** Set once consumed (jelly popped, balloon burst) — no double hits. */
    used: boolean;
}

interface Coin {
    sprite: Sprite;
    baseY: number;
    age: number;
}

/** A little critter running along the ground in the flight direction. */
interface Slime {
    sprite: Sprite;
    /** Ground-run speed, units/s (world-relative, moving right). */
    speed: number;
    /** Spawned sprite scale (size variety) — wobble recomputes from this. */
    baseScale: number;
    age: number;
}

/** What the hero ran into this frame (scene applies the physics). */
export interface ContactEvents {
    jelly: boolean;
    balloon: boolean;
    spike: boolean;
    /** True when the hero came down on a ground slime (bounce off it). */
    slime: boolean;
    coins: number;
}

export interface Entities {
    /** Advance by dx units of world travel; spawn/recycle as needed. */
    update(dx: number, dt: number, meters: number): void;
    /**
     * Circle-vs-circle contact for the hero at (x, y) with radius r.
     * Slimes only count while the hero is descending (or rolling), so
     * skimming past one on the way up doesn't waste it.
     */
    resolve(x: number, y: number, r: number, descending: boolean): ContactEvents;
    destroy(): void;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function createEntities(
    renderer: Renderer,
    world: Container,
    spawnX: number,
    particles: ParticleSystem
): Entities {
    const jellyTex = makeJellyTexture(renderer);
    const balloonTex = makeBalloonTexture(renderer);
    const spikeTex = makeSpikeTexture(renderer);
    const coinFrames = makeCoinTextures(renderer);
    const slimeTex = makeSlimeTexture(renderer);

    const objects: AirObject[] = [];
    const coins: Coin[] = [];
    const slimes: Slime[] = [];

    let distToNext: number = CONFIG.spawn.safeStartUnits;
    let distToNextSlime = rand(200, CONFIG.slime.minGap);

    const spawnCoins = (x: number, y: number) => {
        const count = Math.floor(rand(CONFIG.coins.patternMin, CONFIG.coins.patternMax + 1));
        const arc = Math.random() < 0.5;
        for (let i = 0; i < count; i++) {
            const t = count > 1 ? i / (count - 1) - 0.5 : 0;
            const s = new Sprite(coinFrames[0]);
            s.anchor.set(0.5);
            s.width = CONFIG.coins.size;
            s.height = CONFIG.coins.size;
            const cy = arc ? y + (1 - (2 * t) * (2 * t)) * -90 : y;
            s.position.set(x + t * (count - 1) * 95, cy);
            world.addChild(s);
            coins.push({ sprite: s, baseY: cy, age: Math.random() * Math.PI * 2 });
        }
    };

    const spawnObject = (kind: AirKind, x: number, y: number) => {
        const tex = kind === 'jelly' ? jellyTex : kind === 'balloon' ? balloonTex : spikeTex;
        const radius = CONFIG[kind].radius;
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        // Fit art of any resolution, keeping the natural aspect (balloons are
        // tall): width maps to the object's visual diameter — spike tips poke
        // 1.4x past the body radius. Procedural 2x textures resolve to 0.5.
        const displayW = kind === 'spike' ? radius * 2.8 : radius * 2;
        const baseScale = displayW / tex.width;
        sprite.scale.set(baseScale);
        sprite.position.set(x, y);
        world.addChild(sprite);
        objects.push({ kind, sprite, baseY: y, radius, baseScale, age: Math.random() * Math.PI * 2, used: false });
    };

    const spawnSlime = () => {
        const sprite = new Sprite(slimeTex);
        sprite.anchor.set(0.5, 1); // feet on the ground line
        const baseScale = 0.5 * rand(0.85, 1.15); // small size variety
        sprite.scale.set(baseScale);
        sprite.tint = CONFIG.slime.tints[Math.floor(Math.random() * CONFIG.slime.tints.length)];
        sprite.position.set(spawnX, 0);
        world.addChild(sprite);
        slimes.push({
            sprite,
            speed: rand(CONFIG.slime.speedMin, CONFIG.slime.speedMax),
            baseScale,
            age: Math.random() * Math.PI * 2,
        });
        distToNextSlime = rand(CONFIG.slime.minGap, CONFIG.slime.maxGap);
    };

    const spawnSomething = (meters: number) => {
        const w = CONFIG.spawn.weights;
        const spikeW = meters >= CONFIG.spawn.spikeMinMeters ? w.spike : 0;
        const total = w.jelly + w.balloon + w.coins + spikeW;
        let roll = Math.random() * total;
        const x = spawnX;
        const y = -rand(CONFIG.spawn.minAlt, CONFIG.spawn.maxAlt);
        if ((roll -= w.jelly) <= 0) spawnObject('jelly', x, y);
        else if ((roll -= w.balloon) <= 0) spawnObject('balloon', x, y);
        else if ((roll -= w.coins) <= 0) spawnCoins(x, y);
        else spawnObject('spike', x, y);
        distToNext = rand(CONFIG.spawn.minGap, CONFIG.spawn.maxGap);
    };

    return {
        update(dx, dt, meters) {
            distToNext -= dx;
            if (distToNext <= 0) spawnSomething(meters);
            distToNextSlime -= dx;
            if (distToNextSlime <= 0) spawnSlime();

            for (let i = slimes.length - 1; i >= 0; i--) {
                const s = slimes[i];
                // World scrolls left; the slime runs right at its own pace.
                s.sprite.x += s.speed * dt - dx;
                s.age += dt;
                // Scampering wobble: quick squish cycle + tiny hops, always
                // recomputed from the spawned base scale.
                const squish = 1 + Math.sin(s.age * 11) * 0.1;
                s.sprite.scale.set(s.baseScale * (2 - squish), s.baseScale * squish);
                s.sprite.y = -Math.abs(Math.sin(s.age * 11)) * 6;
                if (s.sprite.x < -160) {
                    s.sprite.destroy();
                    slimes.splice(i, 1);
                }
            }

            for (let i = objects.length - 1; i >= 0; i--) {
                const o = objects[i];
                o.sprite.x -= dx;
                o.age += dt;
                if (o.kind === 'jelly') {
                    // idle squish, relative to the spawn scale
                    const squish = 1 + Math.sin(o.age * 5) * 0.06;
                    o.sprite.scale.set(
                        o.baseScale * ((2 - squish) * 0.5 + 0.5),
                        o.baseScale * squish,
                    );
                } else if (o.kind === 'balloon') {
                    o.sprite.y = o.baseY + Math.sin(o.age * 2.2) * 14;
                    o.sprite.rotation = Math.sin(o.age * 1.7) * 0.08;
                } else {
                    o.sprite.rotation += dt * 0.8;
                }
                if (o.sprite.x < -160) {
                    o.sprite.destroy();
                    objects.splice(i, 1);
                }
            }
            for (let i = coins.length - 1; i >= 0; i--) {
                const c = coins[i];
                c.sprite.x -= dx;
                c.age += dt;
                c.sprite.y = c.baseY + Math.sin(c.age * 4) * 8;
                if (coinFrames.length > 1) {
                    // spritesheet spin (random age offset desyncs the coins)
                    c.sprite.texture = coinFrames[Math.floor(c.age * 12) % coinFrames.length];
                } else {
                    c.sprite.scale.x = Math.abs(Math.cos(c.age * 3)) * c.sprite.scale.y; // fake spin
                }
                if (c.sprite.x < -100) {
                    c.sprite.destroy();
                    coins.splice(i, 1);
                }
            }
        },
        resolve(x, y, r, descending) {
            const events: ContactEvents = { jelly: false, balloon: false, spike: false, slime: false, coins: 0 };
            if (descending) {
                for (let i = slimes.length - 1; i >= 0; i--) {
                    const s = slimes[i];
                    const cx = s.sprite.x;
                    const cy = -CONFIG.slime.radius * 0.8; // roughly body center
                    const dxs = cx - x;
                    const dys = cy - y;
                    const reach = CONFIG.slime.radius + r;
                    if (dxs * dxs + dys * dys > reach * reach) continue;
                    events.slime = true;
                    particles.burst(cx, cy, {
                        color: s.sprite.tint as number, count: 10,
                        speed: 320, life: 0.4, gravity: 800, size: 14,
                    });
                    s.sprite.destroy();
                    slimes.splice(i, 1);
                }
            }
            for (let i = objects.length - 1; i >= 0; i--) {
                const o = objects[i];
                if (o.used) continue;
                const dxo = o.sprite.x - x;
                const dyo = o.sprite.y - y;
                const reach = o.radius + r;
                if (dxo * dxo + dyo * dyo > reach * reach) continue;
                o.used = true;
                events[o.kind] = true;
                const color = o.kind === 'jelly' ? CONFIG.colors.jelly
                    : o.kind === 'balloon' ? CONFIG.colors.balloon : CONFIG.colors.spikeDark;
                particles.burst(o.sprite.x, o.sprite.y, {
                    color, count: o.kind === 'spike' ? 14 : 10,
                    speed: 380, life: 0.45, gravity: 700, size: 16,
                });
                o.sprite.destroy();
                objects.splice(i, 1);
            }
            for (let i = coins.length - 1; i >= 0; i--) {
                const c = coins[i];
                const dxc = c.sprite.x - x;
                const dyc = c.sprite.y - y;
                const reach = CONFIG.coins.size / 2 + r;
                if (dxc * dxc + dyc * dyc > reach * reach) continue;
                events.coins++;
                particles.burst(c.sprite.x, c.sprite.y, {
                    color: CONFIG.colors.coin, count: 7, speed: 300,
                    life: 0.35, gravity: 500, size: 12,
                });
                c.sprite.destroy();
                coins.splice(i, 1);
            }
            return events;
        },
        destroy() {
            for (const o of objects) o.sprite.destroy();
            for (const c of coins) c.sprite.destroy();
            for (const s of slimes) s.sprite.destroy();
            objects.length = 0;
            coins.length = 0;
            slimes.length = 0;
            freeTexture(jellyTex);
            freeTexture(balloonTex);
            freeTexture(spikeTex);
            for (const t of coinFrames) freeTexture(t);
            freeTexture(slimeTex);
        },
    };
}
