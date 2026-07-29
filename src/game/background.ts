/**
 * Parallax backdrop for a launcher: sky gradient, drifting clouds, city
 * silhouette, rolling hills, and the ground strip. Two axes of parallax:
 *   - Horizontal: layers scroll at their own factor of the world speed.
 *   - Vertical: the camera rises with the hero, so ground-locked layers
 *     slide DOWN off-screen (setCamera), clouds at a lighter factor, and
 *     the sky stays put.
 *
 * Layout is bottom-anchored off the ground line: groundTopY() = screen
 * height minus the ground strip; re-anchoring on resize is handled here.
 */
import { Container, Sprite, TilingSprite, type Renderer, type Texture } from 'pixi.js';
import type { Stage } from './stage.ts';
import { CONFIG } from './config.ts';
import {
    makeSkyTexture, makeCloudTexture, makeCityTexture, makeHillsTexture, makeGroundTexture,
    freeTexture,
} from './textures.ts';

/** Horizontal scroll factor per layer (× world speed). */
const FACTORS = {
    clouds: 0.06,
    city: 0.15,
    hills: 0.35,
    ground: 1.0,
};

export interface Background {
    /** y (design units) of the top of the ground — the gameplay ground line. */
    groundTopY(): number;
    /** Advance all layers by a world-scroll delta of dx units. */
    scroll(dx: number, dt: number): void;
    /** Vertical camera offset in design units (0 = grounded view). */
    setCamera(camY: number): void;
    destroy(): void;
}

/**
 * These layers tile horizontally only, but Pixi's TilingSprite forces the
 * sampler to wrap on BOTH axes — so the tile's top edge bilinearly blends
 * with its (solid) bottom row and draws a faint full-width line above the
 * layer. Clamp V; set U explicitly so the pipe's `addressMode !== 'repeat'`
 * check (which reads the U getter) doesn't stomp the V override.
 */
function tileHorizontallyOnly(texture: Texture): Texture {
    const style = texture.source.style;
    style.addressModeU = 'repeat';
    style.addressModeV = 'clamp-to-edge';
    style.update();
    return texture;
}

export function createBackground(renderer: Renderer, stage: Stage): Background {
    const root = new Container();
    stage.root.addChild(root);

    const sky = new Sprite(makeSkyTexture());
    root.addChild(sky);

    // Clouds and the ground rig ride the camera at different factors.
    const cloudLayer = new Container();
    root.addChild(cloudLayer);
    const groundRig = new Container();
    root.addChild(groundRig);

    const cloudTex = makeCloudTexture(renderer);
    const clouds: Sprite[] = [];
    // Fixed seeds so layout is stable; x respawns randomize during play.
    const cloudSeeds = [
        { x: 80, y: 150, s: 0.55, drift: 14 },
        { x: 420, y: 320, s: 0.75, drift: 10 },
        { x: 620, y: 90, s: 0.45, drift: 18 },
        { x: 250, y: 520, s: 0.6, drift: 12 },
    ];
    for (const seed of cloudSeeds) {
        const c = new Sprite(cloudTex);
        c.anchor.set(0.5);
        c.scale.set(seed.s / 2); // textures are drawn at 2x
        c.alpha = 0.9;
        c.position.set(seed.x, seed.y);
        cloudLayer.addChild(c);
        clouds.push(c);
    }

    const city = new TilingSprite({ texture: tileHorizontallyOnly(makeCityTexture(renderer)), width: stage.width, height: 220 });
    city.tileScale.set(0.5);
    city.alpha = 0.75;
    groundRig.addChild(city);

    const hills = new TilingSprite({ texture: tileHorizontallyOnly(makeHillsTexture(renderer)), width: stage.width, height: 160 });
    hills.tileScale.set(0.5);
    groundRig.addChild(hills);

    const ground = new TilingSprite({
        texture: tileHorizontallyOnly(makeGroundTexture(renderer)),
        width: stage.width,
        height: CONFIG.ground.height,
    });
    ground.tileScale.set(0.5);
    groundRig.addChild(ground);

    let groundTop = 0;

    const layout = () => {
        const h = stage.designHeight();
        groundTop = h - CONFIG.ground.height;
        sky.width = stage.width;
        sky.height = h; // full-screen: the sky is all that's left at altitude
        city.y = groundTop - 220;
        hills.y = groundTop - 160;
        ground.y = groundTop;
    };
    layout();
    const offResize = stage.onResize(layout);

    return {
        groundTopY: () => groundTop,
        scroll(dx, dt) {
            city.tilePosition.x -= dx * FACTORS.city;
            hills.tilePosition.x -= dx * FACTORS.hills;
            ground.tilePosition.x -= dx * FACTORS.ground;
            for (let i = 0; i < clouds.length; i++) {
                const c = clouds[i];
                c.x -= dx * FACTORS.clouds + cloudSeeds[i].drift * dt;
                if (c.x < -c.width) {
                    c.x = stage.width + c.width + Math.random() * 200;
                    c.y = 60 + Math.random() * 500;
                }
            }
        },
        setCamera(camY) {
            groundRig.y = camY; // ground-locked layers slide down and away
            cloudLayer.y = camY * CONFIG.camera.cloudFactor;
        },
        destroy() {
            offResize();
            const textures = [sky.texture, cloudTex, city.texture, hills.texture, ground.texture];
            root.destroy({ children: true });
            for (const t of textures) freeTexture(t); // frees placeholders, never manifest art
        },
    };
}
