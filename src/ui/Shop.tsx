/**
 * Upgrade shop: the four tracks from game/upgrades.ts as a scrolling list.
 * Each purchase applies immediately (levels live in the save and are read
 * by the next fling's scene). Level pips show progress; MAX replaces the
 * buy button at the cap.
 *
 * Scrolling note: body has touch-action: none (the game needs raw pointer
 * input), so the list opts back into vertical panning with touch-pan-y.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { store, useStore } from '../state/store.ts';
import { buyUpgrade } from '../state/save.ts';
import { UPGRADES, upgradeCost, type UpgradeDef } from '../game/upgrades.ts';
import { CONFIG } from '../game/config.ts';
import { sdkReady } from '../sdk/runSdk.ts';
import { sfx } from '../audio/audio.ts';

function UpgradeRow({ def, level, wallet }: {
    def: UpgradeDef;
    level: number;
    wallet: number;
}) {
    const cost = upgradeCost(level);
    const affordable = cost !== null && wallet >= cost;

    const onBuy = () => {
        const result = buyUpgrade(def.track);
        if (!result) return;
        sfx.purchase();
        store.patch({ totalCoins: result.totalCoins, upgrades: result.upgrades });
        if (sdkReady()) {
            try {
                RundotGameAPI.analytics.recordCustomEvent('upgrade_purchased', {
                    track: def.track, level: result.upgrades[def.track],
                }).catch(() => {});
            } catch { /* non-fatal */ }
        }
    };

    return (
        <div className="flex items-center gap-4 rounded-2xl bg-white/5 px-4 py-4">
            <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-black"
                style={{ background: def.color }}
            >
                {def.name[0]}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold">{def.name}</p>
                <p className="text-[1.1rem] text-white/50">{def.description}</p>
                <div className="mt-1.5 flex gap-1.5">
                    {Array.from({ length: CONFIG.upgrades.maxLevel }, (_, i) => (
                        <span
                            key={i}
                            className={`h-2.5 w-6 rounded-full ${i < level ? '' : 'bg-white/10'}`}
                            style={i < level ? { background: def.color } : undefined}
                        />
                    ))}
                </div>
            </div>
            {cost === null ? (
                <span className="rounded-xl px-4 py-2 text-[1.1rem] font-black text-white/40">MAX</span>
            ) : (
                <button
                    type="button"
                    disabled={!affordable}
                    className={`rounded-xl px-4 py-2 text-[1.1rem] font-bold whitespace-nowrap transition-transform ${affordable
                        ? 'bg-primary text-black active:scale-95'
                        : 'bg-white/5 text-white/30'}`}
                    onClick={onBuy}
                >
                    ● {cost}
                </button>
            )}
        </div>
    );
}

export default function Shop() {
    const wallet = useStore((s) => s.totalCoins);
    const upgrades = useStore((s) => s.upgrades);
    return (
        <div className="flex h-full flex-col pt-safe-top">
            <div className="flex items-center justify-between p-4">
                <button
                    type="button"
                    className="rounded-xl bg-white/10 px-4 py-2 text-lg font-bold transition-transform active:scale-95"
                    onClick={() => { sfx.click(); store.patch({ phase: 'menu' }); }}
                >
                    ←
                </button>
                <h2 className="text-2xl font-black tracking-wide">UPGRADES</h2>
                <div className="rounded-xl bg-black/40 px-4 py-2 text-lg font-bold tabular-nums text-coin">
                    ● {wallet}
                </div>
            </div>
            <div className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-contain px-4 pb-safe-bottom">
                {UPGRADES.map((def) => (
                    <UpgradeRow
                        key={def.track}
                        def={def}
                        level={upgrades[def.track]}
                        wallet={wallet}
                    />
                ))}
            </div>
        </div>
    );
}
