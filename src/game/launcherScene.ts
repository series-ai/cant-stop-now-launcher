/**
 * The launcher scene — drag-back slingshot aim, flight with ground bounces,
 * jelly/balloon boosts, spike mines, rocket boosts, coins, and the fling →
 * results flow. One scene instance per run: App.tsx remounts GameCanvas
 * (keyed by store.runId) to retry, so this module never needs a reset path.
 *
 * Coordinates: gameplay lives in a `world` container where y = 0 is the
 * ground line and up is negative. The hero's world x is FIXED at
 * CONFIG.player.x — horizontal flight scrolls the world past them — and a
 * vertical camera keeps them on screen at altitude (world.y shifts).
 *
 * Scene contract (from the base template): createLauncherScene(app, stage)
 * returns { destroy() } and cleans up everything it created.
 */
import { Container, Graphics, Sprite, type Application, type Ticker } from 'pixi.js';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import type { HapticFeedbackStyle } from '@series-inc/rundot-game-sdk';
import { store } from '../state/store.ts';
import { recordRun, getSave } from '../state/save.ts';
import { sdkReady } from '../sdk/runSdk.ts';
import { submitRunScore } from '../sdk/leaderboard.ts';
import type { Stage } from './stage.ts';
import { CONFIG } from './config.ts';
import { effects } from './upgrades.ts';
import { createBackground } from './background.ts';
import { createParticleSystem } from './particles.ts';
import { createEntities } from './entities.ts';
import { makePlayerTexture, makePadTexture, freeTexture } from './textures.ts';
import { sfx } from '../audio/audio.ts';

/** The scene contract: every createXxxScene(app, stage) returns one of these. */
export interface Scene {
    destroy(): void;
}

const P = CONFIG.physics;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function createLauncherScene(app: Application, stage: Stage): Scene {
    const levels = getSave().upgrades;
    const background = createBackground(app.renderer, stage);

    const world = new Container();
    world.y = background.groundTopY();
    stage.root.addChild(world);
    const offResize = stage.onResize(() => { world.y = background.groundTopY() + camY; });

    const particles = createParticleSystem(app.renderer, world);
    const entities = createEntities(app.renderer, world, stage.width + 160, particles);

    // Launch pad + hero, resting on the pad.
    const PAD_W = 110;
    const PAD_H = 45;
    const R = CONFIG.player.radius;
    const padTex = makePadTexture(app.renderer);
    const pad = new Sprite(padTex);
    pad.anchor.set(0.5, 1);
    pad.width = PAD_W * 2 * 0.5;
    pad.height = PAD_H * 2 * 0.5;
    pad.position.set(CONFIG.player.x, 0);
    world.addChild(pad);

    const playerTex = makePlayerTexture(app.renderer);
    const hero = new Sprite(playerTex);
    hero.anchor.set(0.5);
    hero.width = R * 2;
    hero.height = R * 2;
    world.addChild(hero);

    const aimG = new Graphics();
    world.addChild(aimG);

    // --- Run state ---------------------------------------------------------
    let state: 'aiming' | 'flying' | 'rolling' | 'done' = 'aiming';
    /** Hero center in world coords; y=0 is the ground line, up negative. */
    let heroY = -PAD_H - R;
    let vx = 0;
    let vy = 0;
    let worldX = 0; // units travelled
    let shownMeters = 0;
    let coins = 0;
    let fuel = effects.fuelMax(levels);
    let camY = 0;
    let elapsed = 0;
    let squash = 1; // vertical squash factor, eased back to 1
    let hitFlash = 0;
    let ended = false;

    hero.position.set(CONFIG.player.x, heroY);
    store.patch({ fuel, fuelMax: fuel });

    // --- Aiming ------------------------------------------------------------
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let aim: { angle: number; power01: number } | null = null;

    const maxPower = effects.maxLaunchPower(levels);

    /** Linear blend between two 0xRRGGBB colors. */
    const lerpColor = (a: number, b: number, t: number): number => {
        const ar = a >> 16, ag = (a >> 8) & 0xff, ab = a & 0xff;
        const br = b >> 16, bg = (b >> 8) & 0xff, bb = b & 0xff;
        return (Math.round(ar + (br - ar) * t) << 16)
            | (Math.round(ag + (bg - ag) * t) << 8)
            | Math.round(ab + (bb - ab) * t);
    };

    /** Power readout color: white → yellow → orange → red at full pull. */
    const powerColor = (power01: number): number => {
        const stops = [0xffffff, 0xfde047, 0xfb923c, 0xef4444];
        const seg = Math.min(2.999, power01 * 3);
        const i = Math.floor(seg);
        return lerpColor(stops[i], stops[i + 1], seg - i);
    };

    const drawAim = () => {
        aimG.clear();
        if (state !== 'aiming' || !aim) return;
        const { angle, power01 } = aim;
        const cx = CONFIG.player.x;
        const cy = heroY;
        const v = maxPower * power01;
        const dirX = Math.cos(angle);
        const dirY = -Math.sin(angle);
        // Trajectory preview (no drag/objects, gravity only). Dot color
        // tracks pull strength so the player can read how close to max
        // power they are: white → yellow → orange → red (maxed).
        const dotColor = powerColor(power01);
        for (let i = 1; i <= CONFIG.launch.previewDots; i++) {
            const t = i * CONFIG.launch.previewStepS;
            const px = cx + v * dirX * t;
            const py = cy + v * dirY * t + 0.5 * P.gravity * t * t;
            aimG.circle(px, py, 9 - i * 0.5).fill({ color: dotColor, alpha: 0.75 - i * 0.05 });
        }
        // Arrow shaft + head, length proportional to power.
        const len = 90 + power01 * 130;
        const tipX = cx + dirX * len;
        const tipY = cy + dirY * len;
        aimG.moveTo(cx, cy).lineTo(tipX, tipY)
            .stroke({ width: 10, color: CONFIG.colors.aim, alpha: 0.9 });
        const perpX = -dirY;
        const perpY = dirX;
        aimG.poly([
            tipX + dirX * 26, tipY + dirY * 26,
            tipX + perpX * 14, tipY + perpY * 14,
            tipX - perpX * 14, tipY - perpY * 14,
        ]).fill({ color: CONFIG.colors.aim, alpha: 0.9 });
    };

    const computeAim = (px: number, py: number) => {
        // Slingshot: launch opposite the drag (pull down-left, fling up-right).
        const s = stage.scale();
        const dx = (px - dragStart.x) / s;
        const dy = (py - dragStart.y) / s;
        const len = Math.hypot(dx, dy);
        if (len < 18) { aim = null; return; }
        // Launch opposite the drag: screen launch vector is (-dx, -dy), and
        // the angle above horizontal (y-up) is atan2(dy, -dx) — dragging
        // down-left aims up-right.
        const angle = Math.atan2(dy, -dx);
        const clamped = Math.min(rad(CONFIG.launch.maxAngleDeg),
            Math.max(rad(CONFIG.launch.minAngleDeg), angle));
        aim = {
            angle: clamped,
            power01: Math.min(1, len / CONFIG.launch.dragForFullPower),
        };
    };

    const launch = (angle: number, power01: number) => {
        if (state !== 'aiming') return;
        state = 'flying';
        const v = maxPower * power01;
        vx = Math.cos(angle) * v;
        vy = -Math.sin(angle) * v;
        aim = null;
        aimG.clear();
        squash = 1.25;
        sfx.launch();
        store.patch({ flight: 'flying' });
        particles.burst(CONFIG.player.x, heroY + R, {
            color: CONFIG.colors.dust, count: 12, speed: 340, life: 0.45,
            gravity: 900, size: 16, angle: Math.PI * 0.75, spread: Math.PI / 2,
        });
        haptic('medium');
        if (sdkReady()) {
            try { RundotGameAPI.analytics.recordCustomEvent('fling_start').catch(() => {}); } catch { /* non-fatal */ }
        }
    };

    const boost = () => {
        if (state !== 'flying' || fuel <= 0) return;
        fuel--;
        vx += CONFIG.rocket.boostVx;
        vy -= CONFIG.rocket.boostVy;
        sfx.boost();
        store.patch({ fuel });
        particles.burst(CONFIG.player.x - R, heroY + R * 0.4, {
            color: CONFIG.colors.boostFlame, count: 12, speed: 420, life: 0.4,
            gravity: -200, size: 15, angle: Math.PI, spread: Math.PI / 3,
        });
        haptic('light');
    };

    const haptic = (style: 'light' | 'medium' | 'error') => {
        if (!sdkReady()) return;
        try {
            RundotGameAPI.triggerHapticAsync(style as HapticFeedbackStyle).catch(() => {});
        } catch { /* non-fatal */ }
    };

    // --- Input -------------------------------------------------------------
    const toLocal = (e: PointerEvent) => {
        const rect = app.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onPointerDown = (e: PointerEvent) => {
        if (state === 'aiming') {
            dragging = true;
            dragStart = toLocal(e);
        } else {
            boost();
        }
    };
    const onPointerMove = (e: PointerEvent) => {
        if (!dragging || state !== 'aiming') return;
        const p = toLocal(e);
        computeAim(p.x, p.y);
        drawAim();
    };
    const onPointerUp = () => {
        if (!dragging || state !== 'aiming') { dragging = false; return; }
        dragging = false;
        if (aim) launch(aim.angle, aim.power01);
        else { aimG.clear(); }
    };
    const onKeyDown = (e: KeyboardEvent) => {
        if (e.repeat || e.code !== 'Space') return;
        e.preventDefault();
        if (state === 'aiming') launch(rad(CONFIG.launch.keyboardAngleDeg), 1);
        else boost();
    };
    app.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);

    // --- Run end -----------------------------------------------------------
    const endRun = () => {
        if (ended) return;
        ended = true;
        state = 'done';
        const meters = Math.floor(worldX / CONFIG.score.unitsPerMeter);
        const result = recordRun(meters, coins);
        store.patch({
            phase: 'gameover',
            distance: meters,
            coins,
            payout: result.payout,
            distanceBonus: result.distanceBonus,
            best: result.best,
            newBest: result.newBest,
            totalCoins: result.totalCoins,
        });
        // Fire-and-forget: the server keeps the best score; a returned rank
        // shows up on the results screen when it lands.
        void submitRunScore(meters, Math.round(elapsed)).then((rank) => {
            if (rank !== null) store.patch({ lbRank: rank });
        });
        if (sdkReady()) {
            try {
                RundotGameAPI.analytics.recordCustomEvent('fling_end', {
                    meters, coins, payout: result.payout, seconds: Math.round(elapsed),
                }).catch(() => {});
            } catch { /* non-fatal */ }
        }
    };

    // --- Main loop ---------------------------------------------------------
    const tick = (ticker: Ticker) => {
        // Clamp: after a tab-switch hiccup, never step more than 50ms at once.
        const dt = Math.min(ticker.deltaMS / 1000, 0.05);
        particles.update(dt);

        if (state === 'aiming') {
            // Idle bob on the pad.
            elapsed += dt;
            hero.position.set(CONFIG.player.x, heroY + Math.sin(elapsed * 3) * 4);
            return;
        }
        if (state === 'done') return;

        elapsed += dt;

        // Physics.
        vy = Math.min(vy + P.gravity * dt, 3000);
        vx *= Math.exp(-P.airDrag * dt);
        const dx = Math.max(0, vx * dt);
        worldX += dx;
        heroY += vy * dt;

        if (state === 'rolling') {
            heroY = -R;
            vx = Math.max(0, vx - P.rollFriction * dt);
            hero.rotation += (vx / R) * dt;
            if (vx <= P.stopSpeed) endRun();
        } else {
            // Airborne spin, faster with speed.
            hero.rotation += (2 + vx * 0.004) * dt;
            // Ground contact → bounce or start rolling.
            if (heroY >= -R && vy > 0) {
                const rest = effects.restitution(levels);
                const bounceVy = -vy * rest;
                heroY = -R;
                vx *= P.bounceFriction;
                squash = 0.6;
                sfx.bounce(Math.min(1, vy / 2000));
                particles.burst(CONFIG.player.x, 0, {
                    color: CONFIG.colors.dust, count: 10, speed: 300, life: 0.4,
                    gravity: 1100, size: 16, angle: -Math.PI / 2, spread: Math.PI / 2,
                });
                haptic('light');
                if (Math.abs(bounceVy) < P.rollThreshold) {
                    state = 'rolling';
                    vy = 0;
                } else {
                    vy = bounceVy;
                }
            }
        }

        // World scroll + spawns + contacts.
        const meters = Math.floor(worldX / CONFIG.score.unitsPerMeter);
        background.scroll(dx, dt);
        entities.update(dx, dt, meters);
        const hit = entities.resolve(
            CONFIG.player.x, heroY, R * 0.9,
            vy > 0 || state === 'rolling'
        );
        if (hit.slime) {
            // A little trampoline: some height, a tiny push, keeps a roll alive.
            vy = -Math.max(CONFIG.slime.bounceVy, Math.abs(vy) * CONFIG.slime.vyCarry);
            vx += CONFIG.slime.pushVx;
            if (state === 'rolling') state = 'flying';
            squash = 1.25;
            sfx.slime();
            haptic('light');
        }
        if (hit.jelly) {
            vy = -effects.jellyPopVy(levels, vy);
            vx += effects.jellyPopVx(levels);
            if (state === 'rolling') state = 'flying';
            squash = 1.35;
            sfx.jelly();
            haptic('medium');
        }
        if (hit.balloon) {
            vy -= CONFIG.balloon.liftVy;
            vx += CONFIG.balloon.pushVx;
            if (state === 'rolling') state = 'flying';
            sfx.balloon();
        }
        if (hit.spike) {
            vx *= CONFIG.spike.vxMultiplier;
            vy = Math.max(vy, CONFIG.spike.knockdownVy);
            hitFlash = 0.25;
            sfx.spike();
            haptic('error');
        }
        if (hit.coins > 0) {
            coins += hit.coins;
            store.patch({ coins });
            sfx.coin();
        }

        // Pad scrolls away with the world.
        if (!pad.destroyed) {
            pad.x -= dx;
            if (pad.x < -200) pad.destroy();
        }

        // Camera follows altitude; background layers ride along.
        const camTarget = Math.max(0, CONFIG.camera.topMargin - (background.groundTopY() + heroY - R));
        camY += (camTarget - camY) * Math.min(1, 10 * dt);
        world.y = background.groundTopY() + camY;
        background.setCamera(camY);

        // Visuals: squash recovery + spike hit flash. Squash conserves
        // volume-ish: wider when flatter.
        squash += (1 - squash) * Math.min(1, 10 * dt);
        hero.width = R * 2 * (2 - squash);
        hero.height = R * 2 * squash;
        hitFlash = Math.max(0, hitFlash - dt);
        hero.tint = hitFlash > 0 ? 0xff8080 : 0xffffff;
        hero.position.set(CONFIG.player.x, heroY);

        // Discrete store patches only: meter ticks (coins patched on pickup).
        if (meters !== shownMeters) {
            shownMeters = meters;
            store.patch({ distance: meters });
        }
    };
    app.ticker.add(tick);

    return {
        destroy() {
            app.ticker.remove(tick);
            app.canvas.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('keydown', onKeyDown);
            offResize();
            entities.destroy();
            particles.destroy();
            background.destroy();
            aimG.destroy();
            hero.destroy();
            freeTexture(playerTex);
            if (!pad.destroyed) pad.destroy();
            freeTexture(padTex);
            world.destroy({ children: true });
        },
    };
}
