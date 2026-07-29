/**
 * All gameplay tuning lives here — one file to skim to understand (and
 * change) how the game feels. Values are in DESIGN UNITS (see stage.ts):
 * the screen is always 720 units wide, so "400 units/s" means the same
 * fraction-of-screen speed on every device.
 *
 * Upgrade scaling: most "feel" numbers have a `perLevel` companion — the
 * effective value is base + perLevel × upgradeLevel (see state/save.ts for
 * the upgrade tracks).
 */

export const CONFIG = {
    /** The flung hero. */
    player: {
        /** Fixed screen x while flying (the camera chases them). */
        x: 240,
        radius: 46,
    },

    /** Flight physics. Down is positive (gameplay y=0 is the ground line). */
    physics: {
        /** Gravity, units/s². Lower than a platformer — long floaty arcs. */
        gravity: 1900,
        /** Air drag: vx decays by e^(-drag·t). */
        airDrag: 0.05,
        /** Ground bounce keeps this fraction of vy (plus Bounciness upgrade). */
        restitution: 0.42,
        restitutionPerLevel: 0.055,
        /** vx multiplier applied at each ground bounce. */
        bounceFriction: 0.88,
        /** Below this |vy| after a bounce, the hero starts rolling. */
        rollThreshold: 130,
        /** Rolling deceleration, units/s². */
        rollFriction: 380,
        /** The run ends when rolling speed drops below this. */
        stopSpeed: 30,
    },

    /** Slingshot launch. */
    launch: {
        /** Max launch speed at full drag, before the Launch Power upgrade. */
        maxPower: 1750,
        powerPerLevel: 160,
        /** Drag distance (units) that maps to full power. */
        dragForFullPower: 420,
        minAngleDeg: 15,
        maxAngleDeg: 80,
        /** Desktop convenience: Space launches at this angle & power. */
        keyboardAngleDeg: 55,
        /** Trajectory preview dots. */
        previewDots: 9,
        previewStepS: 0.12,
    },

    /**
     * Tap-to-smash rocket. A boost is an immediate DOWNWARD velocity snap
     * (a slam), not an upward push: vertical speed jumps straight to
     * smashVy even mid-rise (a faster existing fall is kept). Use it to
     * dive onto slimes and jellies and convert height into a bounce.
     */
    rocket: {
        /** Boosts per run = capacity + Rocket Fuel upgrade level. */
        capacity: 2,
        /** Downward speed (units/s) the smash snaps to. */
        smashVy: 1400,
        /**
         * Fraction of impact speed returned by the surface a smash lands on
         * (ground or slime). Tuned so a smash from typical flight heights
         * bounces back to about 65% of the height it dove from (return
         * height = smashBounce^2 * (drop + smashVy^2 / (2 * gravity))).
         */
        smashBounce: 0.67,
    },

    /** Bouncy jelly response (the gummy-bear moment). */
    jelly: {
        radius: 56,
        /** Upward pop: -(base + perLevel·lvl + |vy|·carry). */
        popVy: 700,
        popVyPerLevel: 90,
        vyCarry: 0.25,
        popVx: 160,
        popVxPerLevel: 35,
    },

    /** Balloon: a small mid-air lift. */
    balloon: {
        radius: 44,
        liftVy: 430,
        pushVx: 70,
    },

    /** Spike mine: momentum killer. */
    spike: {
        radius: 42,
        vxMultiplier: 0.5,
        knockdownVy: 220,
    },

    /**
     * Ground slimes: little critters running along the ground in the flight
     * direction at various speeds. Landing on one gives a small bounce and a
     * tiny forward push, stretching the fling a bit further.
     */
    slime: {
        radius: 40,
        /** Ground-run speed range, units/s. */
        speedMin: 60,
        speedMax: 230,
        /** Spawn spacing along the ground, units of travel. */
        minGap: 480,
        maxGap: 1050,
        /** Bounce: vy becomes -max(bounceVy, |vy| * vyCarry). */
        bounceVy: 620,
        vyCarry: 0.5,
        /** Tiny forward push per bounce, units/s. */
        pushVx: 60,
        /** Body tints (the texture is drawn white for tinting). */
        tints: [0x86efac, 0x6ee7b7, 0x93c5fd, 0xfda4af, 0xfcd34d, 0xc4b5fd],
    },

    /**
     * Air-object spawning: something appears every minGap..maxGap units of
     * travel, at an altitude within [minAlt, maxAlt] (units above ground).
     * The object kinds (jelly/balloon/spike/slime/coins) are EXAMPLE
     * content — swap their art, retune their responses in launcherScene.ts,
     * or add kinds in entities.ts.
     */
    spawn: {
        minGap: 340,
        maxGap: 680,
        minAlt: 130,
        maxAlt: 1000,
        /** Relative weights; spikes stay out of the first few seconds. */
        weights: { jelly: 42, balloon: 22, coins: 26, spike: 10 },
        spikeMinMeters: 150,
        /** Object-free runway right after the pad, in units. */
        safeStartUnits: 500,
    },

    /** Coin pickups. */
    coins: {
        size: 52,
        /** Coins per arc/row pattern. */
        patternMin: 3,
        patternMax: 6,
    },

    /** Score display: design units of travel per "meter". */
    score: {
        unitsPerMeter: 10,
        /** Wallet payout: coins collected + meters / metersPerCoin. */
        metersPerCoin: 20,
    },

    /** Upgrade shop: 4 tracks, 5 levels each, shared cost curve. */
    upgrades: {
        maxLevel: 5,
        /** Coin cost of level 1..5 on every track. */
        costs: [25, 75, 180, 400, 900],
    },

    /** Rewarded-ad placements (systems/ads.ts owns the mechanics). */
    ads: {
        /** Game-wide daily rewarded-watch budget, shared by every placement. */
        maxPerDay: 15,
        /** Only offer the double-coins ad when a fling earned at least this. */
        minCoinsToDouble: 10,
    },

    /** Camera: keep the hero at least this far below the top of the screen. */
    camera: {
        topMargin: 260,
        /** Background rig vertical parallax vs camera (1 = locked to ground). */
        cloudFactor: 0.35,
    },

    /** Ground strip anchored to the bottom of the screen. */
    ground: {
        height: 150,
    },

    /**
     * Canvas-side palette (Pixi draws with these). The DOM/UI palette is the
     * @theme block in styles/app.css — keep the two in harmony. Sunset vibes,
     * to set the game apart from its endless-runner sibling.
     */
    colors: {
        skyTop: 0xffa958,
        skyBottom: 0xffe6b8,
        cloud: 0xfff3e0,
        cityFar: 0xc98d8d,
        hills: 0xa06cc4,
        hillsShade: 0x84539f,
        grass: 0xe0b45f,
        grassDark: 0xc79a48,
        dirt: 0x9c6b44,
        dirtDark: 0x855636,
        player: 0x38bdf8,
        playerDark: 0x0e8fc7,
        eyeWhite: 0xffffff,
        eyePupil: 0x1e2a3a,
        pad: 0x7c5c3e,
        padDark: 0x5f4630,
        aim: 0xffffff,
        jelly: 0xef5da8,
        jellyDark: 0xc23e85,
        balloon: 0xf87171,
        balloonDark: 0xdc4c4c,
        spike: 0x64748b,
        spikeDark: 0x475569,
        coin: 0xfbbf24,
        coinDark: 0xd99e0b,
        coinShine: 0xfde68a,
        dust: 0xe8d8b8,
        boostFlame: 0xffb020,
    },
} as const;

export type AirKind = 'jelly' | 'balloon' | 'spike';
