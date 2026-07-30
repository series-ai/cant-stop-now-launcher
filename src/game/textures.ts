/**
 * Every texture the game uses comes from here, resolved in two steps:
 *
 *   1. REAL ART — if the alias is listed in src/assets/manifest.ts (and so
 *      was loaded at boot), that image is used.
 *   2. PROCEDURAL FALLBACK — otherwise the placeholder is drawn at runtime,
 *      so the game always runs, even with zero bundled images.
 *
 * To swap in your art: drop a PNG in public/images/, add it to the manifest
 * under the alias named on the make*() function below, done — no code
 * changes. The art spec (expected size/aspect/tiling per alias) is in
 * CLAUDE.md.
 *
 * Procedural textures are drawn at 2x their design-unit display size and
 * scaled down by the sprites that use them, so edges stay crisp at high
 * DPR. Author real art at 2x too (see CLAUDE.md).
 */
import { Assets, Graphics, Rectangle, Texture, type Renderer } from 'pixi.js';
import { CONFIG } from './config.ts';

const C = CONFIG.colors;

/** Generate at 2x and let sprites scale down — crisper on 2x-DPR screens. */
const SS = 2;

/** Procedurally generated textures, so freeTexture never destroys real art. */
const generated = new WeakSet<Texture>();

/** Manifest-listed art wins; the drawn placeholder is the fallback. */
function art(alias: string, fallback: () => Texture): Texture {
    if (Assets.cache.has(alias)) return Assets.get<Texture>(alias);
    return fallback();
}

function gen(renderer: Renderer, draw: (g: Graphics) => void): Texture {
    const g = new Graphics();
    draw(g);
    const tex = renderer.generateTexture({ target: g, resolution: 1 });
    g.destroy();
    generated.add(tex);
    return tex;
}

/**
 * Scene teardown MUST use this instead of texture.destroy(): generated
 * placeholders are per-scene and freed; manifest-loaded art is shared in
 * the Assets cache and must survive scene remounts.
 */
export function freeTexture(tex: Texture): void {
    if (generated.has(tex)) tex.destroy(true);
}

/** The hero: a round daredevil with goggles, facing right. Alias: 'player'. */
export function makePlayerTexture(renderer: Renderer): Texture {
    return art('player', () => {
        const r = CONFIG.player.radius * SS;
        const s = r * 2;
        return gen(renderer, (g) => {
            g.circle(r, r, r).fill(C.player);
            // belly shine
            g.circle(r * 0.78, r * 1.2, r * 0.5).fill({ color: 0xffffff, alpha: 0.15 });
            // goggle band
            g.rect(0, r * 0.5, s, r * 0.5).fill(C.playerDark);
            // goggles — set forward
            g.circle(r * 1.05, r * 0.75, r * 0.34).fill(C.eyeWhite);
            g.circle(r * 1.62, r * 0.75, r * 0.34).fill(C.eyeWhite);
            g.circle(r * 1.15, r * 0.78, r * 0.16).fill(C.eyePupil);
            g.circle(r * 1.72, r * 0.78, r * 0.16).fill(C.eyePupil);
        });
    });
}

/** Bouncy jelly blob — the thing you WANT to hit. Alias: 'jelly'. */
export function makeJellyTexture(renderer: Renderer): Texture {
    return art('jelly', () => {
        const r = CONFIG.jelly.radius * SS;
        const s = r * 2;
        return gen(renderer, (g) => {
            g.roundRect(0, s * 0.12, s, s * 0.88, r * 0.9).fill(C.jelly);
            g.roundRect(s * 0.14, s * 0.26, s * 0.72, s * 0.3, r * 0.5).fill({ color: 0xffffff, alpha: 0.25 });
            // little face
            g.circle(s * 0.36, s * 0.55, r * 0.13).fill(C.jellyDark);
            g.circle(s * 0.64, s * 0.55, r * 0.13).fill(C.jellyDark);
            g.roundRect(s * 0.4, s * 0.72, s * 0.2, r * 0.14, r * 0.07).fill(C.jellyDark);
        });
    });
}

/** Balloon with a string. Alias: 'balloon'. */
export function makeBalloonTexture(renderer: Renderer): Texture {
    return art('balloon', () => {
        const r = CONFIG.balloon.radius * SS;
        const h = r * 2.9;
        return gen(renderer, (g) => {
            g.ellipse(r, r * 1.05, r * 0.95, r * 1.05).fill(C.balloon);
            g.ellipse(r * 0.7, r * 0.75, r * 0.28, r * 0.36).fill({ color: 0xffffff, alpha: 0.35 });
            g.poly([r - r * 0.14, r * 2.05, r + r * 0.14, r * 2.05, r, r * 2.3]).fill(C.balloonDark);
            g.moveTo(r, r * 2.3).lineTo(r * 0.9, h).stroke({ width: SS * 2, color: C.balloonDark });
        });
    });
}

/** Spike mine — the thing you DON'T want to hit. Alias: 'spike'. */
export function makeSpikeTexture(renderer: Renderer): Texture {
    return art('spike', () => {
        const r = CONFIG.spike.radius * SS;
        const c = r * 1.4; // canvas half-size (spikes poke past the body)
        return gen(renderer, (g) => {
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const tip = { x: c + Math.cos(a) * r * 1.35, y: c + Math.sin(a) * r * 1.35 };
                const b1 = { x: c + Math.cos(a + 0.3) * r * 0.8, y: c + Math.sin(a + 0.3) * r * 0.8 };
                const b2 = { x: c + Math.cos(a - 0.3) * r * 0.8, y: c + Math.sin(a - 0.3) * r * 0.8 };
                g.poly([tip.x, tip.y, b1.x, b1.y, b2.x, b2.y]).fill(C.spikeDark);
            }
            g.circle(c, c, r * 0.85).fill(C.spike);
            g.circle(c * 0.85, c * 0.85, r * 0.28).fill({ color: 0xffffff, alpha: 0.2 });
        });
    });
}

/**
 * Ground critter, drawn WHITE so sprites can tint it any color
 * (CONFIG.slime.tints). Alias: 'slime' — real art must also be
 * white/grayscale for the tinting to work; ship colored art instead by
 * clearing the tint logic in entities.ts.
 */
export function makeSlimeTexture(renderer: Renderer): Texture {
    return art('slime', () => {
        const r = CONFIG.slime.radius * SS;
        const w = r * 2;
        const h = r * 1.6;
        return gen(renderer, (g) => {
            // dome with a flat-ish bottom
            g.ellipse(r, h * 0.62, r, h * 0.38).fill(0xffffff);
            g.ellipse(r, h * 0.45, r * 0.82, h * 0.42).fill(0xffffff);
            g.rect(0, h * 0.72, w, h * 0.28).fill(0xffffff);
            g.ellipse(r, h * 0.94, r, h * 0.06).fill(0xffffff);
            // glossy highlight
            g.ellipse(r * 0.62, h * 0.32, r * 0.26, h * 0.14).fill({ color: 0xffffff, alpha: 0.5 });
            // eyes — dark, unaffected enough by tinting to stay readable
            g.circle(r * 1.18, h * 0.5, r * 0.13).fill(C.eyePupil);
            g.circle(r * 1.62, h * 0.5, r * 0.13).fill(C.eyePupil);
        });
    });
}

/** Gold coin. Alias: 'coin'. */
export function makeCoinTexture(renderer: Renderer): Texture {
    return art('coin', () => {
        const s = CONFIG.coins.size * SS;
        const r = s / 2;
        return gen(renderer, (g) => {
            g.circle(r, r, r).fill(C.coinDark);
            g.circle(r, r, r * 0.82).fill(C.coin);
            g.circle(r - r * 0.28, r - r * 0.28, r * 0.24).fill(C.coinShine);
        });
    });
}

/** The launch pad the hero starts on. Alias: 'pad'. */
export function makePadTexture(renderer: Renderer): Texture {
    return art('pad', () => {
        const w = 220 * SS;
        const h = 90 * SS;
        return gen(renderer, (g) => {
            g.roundRect(0, 0, w, h * 0.45, h * 0.16).fill(C.pad);
            g.roundRect(w * 0.12, h * 0.4, w * 0.14, h * 0.6, h * 0.08).fill(C.padDark);
            g.roundRect(w * 0.74, h * 0.4, w * 0.14, h * 0.6, h * 0.08).fill(C.padDark);
        });
    });
}

/**
 * Frame origins of the 10-frame coin spin, in sheet pixels — copied from
 * resources/coin.json (256px cells, coin01..coin10). Baked in because Pixi
 * force-parses any Assets-loaded .json with a 'frames' key as a spritesheet,
 * so the json file itself must never go through the loader.
 */
const COIN_SHEET_FRAMES: [number, number][] = [
    [0, 0], [256, 0], [512, 0], [768, 0],
    [0, 256], [256, 256], [512, 256], [768, 256],
    [0, 512], [256, 512],
];

/**
 * Animated coin: slices the spin sheet loaded under 'coin-sheet' into one
 * texture per frame. Falls back to the single static coin ('coin' alias or
 * the procedural placeholder) when the sheet isn't loaded.
 */
export function makeCoinTextures(renderer: Renderer): Texture[] {
    if (Assets.cache.has('coin-sheet')) {
        const sheet = Assets.get<Texture>('coin-sheet');
        // Inset each 256px cell to the 160px box around the coin — the sheet
        // leaves wide transparent margins that would render the coin tiny.
        // Measured union of all 10 frames' content: x 55-201, y 42-202.
        const INSET_X = 48;
        const INSET_Y = 42;
        const BOX = 160;
        return COIN_SHEET_FRAMES.map(([x, y]) => new Texture({
            source: sheet.source,
            frame: new Rectangle(x + INSET_X, y + INSET_Y, BOX, BOX),
        }));
    }
    return [makeCoinTexture(renderer)];
}

/** Soft cloud blob. Alias: 'cloud'. */
export function makeCloudTexture(renderer: Renderer): Texture {
    return art('cloud', () => {
        const w = 260 * SS;
        const h = 110 * SS;
        return gen(renderer, (g) => {
            g.ellipse(w * 0.3, h * 0.62, w * 0.28, h * 0.34).fill(C.cloud);
            g.ellipse(w * 0.55, h * 0.42, w * 0.3, h * 0.4).fill(C.cloud);
            g.ellipse(w * 0.76, h * 0.64, w * 0.22, h * 0.3).fill(C.cloud);
        });
    });
}

/** Far parallax silhouette — MUST tile horizontally. Alias: 'city'. */
export function makeCityTexture(renderer: Renderer): Texture {
    return art('city', () => {
        const w = 720 * SS;
        const h = 220 * SS;
        // Deterministic skyline (no Math.random — same skyline every boot).
        const buildings = [
            [0.0, 0.55], [0.09, 0.8], [0.17, 0.45], [0.24, 0.95], [0.33, 0.6],
            [0.41, 0.75], [0.5, 0.5], [0.57, 1.0], [0.66, 0.65], [0.74, 0.85],
            [0.83, 0.55], [0.9, 0.7],
        ];
        return gen(renderer, (g) => {
            for (let i = 0; i < buildings.length; i++) {
                const [x, bh] = buildings[i];
                const next = i + 1 < buildings.length ? buildings[i + 1][0] : 1.0;
                g.rect(x * w, h - bh * h, (next - x) * w + 2, bh * h).fill(C.cityFar);
            }
        });
    });
}

/** Mid parallax hills — MUST tile horizontally. Alias: 'hills'. */
export function makeHillsTexture(renderer: Renderer): Texture {
    return art('hills', () => {
        const w = 720 * SS;
        const h = 160 * SS;
        return gen(renderer, (g) => {
            // Two overlapping half-ellipse hills; both edges of the tile are at
            // y = h*0.55 so the texture tiles seamlessly.
            g.rect(0, h * 0.55, w, h * 0.45).fill(C.hills);
            g.ellipse(w * 0.28, h * 0.62, w * 0.34, h * 0.5).fill(C.hills);
            g.ellipse(w * 0.78, h * 0.68, w * 0.3, h * 0.42).fill(C.hillsShade);
        });
    });
}

/** Ground strip — MUST tile horizontally. Alias: 'ground'. */
export function makeGroundTexture(renderer: Renderer): Texture {
    return art('ground', () => {
        const w = 360 * SS;
        const h = CONFIG.ground.height * SS;
        const grassH = h * 0.24;
        return gen(renderer, (g) => {
            g.rect(0, 0, w, h).fill(C.dirt);
            // dirt speckles (deterministic)
            const specks = [
                [0.1, 0.45], [0.32, 0.7], [0.5, 0.4], [0.68, 0.8], [0.86, 0.55], [0.22, 0.88],
            ];
            for (const [x, y] of specks) {
                g.roundRect(x * w, y * h, w * 0.06, h * 0.05, 6).fill(C.dirtDark);
            }
            g.rect(0, 0, w, grassH).fill(C.grass);
            for (let i = 0; i < 6; i++) {
                g.rect((i / 6) * w + w * 0.04, grassH * 0.55, w * 0.05, grassH * 0.45).fill(C.grassDark);
            }
        });
    });
}

/** Vertical sky gradient (canvas2d). Alias: 'sky' (a tall soft image works). */
export function makeSkyTexture(): Texture {
    if (Assets.cache.has('sky')) return Assets.get<Texture>('sky');
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    grad.addColorStop(0, hex(C.skyTop));
    grad.addColorStop(1, hex(C.skyBottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tex = Texture.from(canvas);
    generated.add(tex);
    return tex;
}
