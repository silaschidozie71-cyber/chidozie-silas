import React, { useEffect, useRef, useState } from 'react';
import {
  Battery,
  EyeOff,
  Flashlight,
  Heart,
  LogOut,
  Pause,
  Play,
  Radio,
  ShieldAlert,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { HorrorGameEngine } from '../engine/HorrorGameEngine';
import {
  ActiveRoom,
  GameResult,
  GameSettings,
  HudSnapshot,
  MapDefinition,
  RemotePlayerState,
} from '../types/game';
import { PuzzleModal } from './PuzzleModal';

interface GameViewportProps {
  mapDef: MapDefinition;
  settings: GameSettings;
  equippedItems: string[];
  coopMode: 'solo' | 'host' | 'peer';
  activeRoom: ActiveRoom | null;
  localClientId: string | null;
  wsRef: React.MutableRefObject<WebSocket | null>;
  coopEvents: {
    remotePlayers: RemotePlayerState[];
    collectedIds: string[];
    puzzleSolvedBy: string | null;
    monstersSync: Array<{ id: string; x: number; z: number; yaw: number; state: string }> | null;
    pingLog: Array<{ senderName: string; text: string; ts: number }>;
  };
  onExitToMenu: () => void;
  onMatchFinish: (result: GameResult) => void;
}

const INITIAL_HUD: HudSnapshot = {
  hp: 3,
  maxHp: 3,
  stamina: 100,
  maxStamina: 100,
  battery: 100,
  maxBattery: 100,
  flashlightOn: true,
  sprinting: false,
  hiding: false,
  hidingSpotLabel: '',
  collectedCount: 0,
  requiredCount: 1,
  bonusCoinsCollected: 0,
  puzzleSolved: false,
  escapeUnlocked: false,
  elapsedSeconds: 0,
  nearestMonsterDist: 99,
  nearestMonsterName: null,
  interactPrompt: null,
  interactAction: null,
  pointerLocked: false,
  activeConsumableName: null,
  consumableUsesLeft: 0,
  statusToast: null,
  freezeLevel: 0,
  shadowStatic: 0,
};

export const GameViewport: React.FC<GameViewportProps> = ({
  mapDef,
  settings,
  equippedItems,
  coopMode,
  activeRoom,
  localClientId,
  wsRef,
  coopEvents,
  onExitToMenu,
  onMatchFinish,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HorrorGameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [matchResult, setMatchResult] = useState<GameResult | null>(null);

  // Mount WebGL Engine once
  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new HorrorGameEngine(
      mountRef.current,
      mapDef,
      settings,
      equippedItems,
      {
        onHudUpdate: (snap) => setHud(snap),
        onOpenPuzzle: () => setPuzzleOpen(true),
        onCollectItem: (itemId) => {
          if (coopMode !== 'solo' && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'objective:collect', itemId }));
          }
        },
        onSendPlayerState: (st) => {
          if (coopMode !== 'solo' && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'player:state', ...st }));
          }
        },
        onSendMonsters: (monsters) => {
          if (coopMode === 'host' && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'monster:sync', monsters }));
          }
        },
        onGameEnd: (victory, killedBy, snap) => {
          const timeBonus = victory ? Math.max(0, 600 - snap.elapsedSeconds * 2) : 0;
          const score = victory
            ? mapDef.rewardPoints + timeBonus + snap.bonusCoinsCollected * 50 + snap.hp * 150
            : snap.collectedCount * 120 + snap.bonusCoinsCollected * 25;
          const coinsEarned = victory
            ? mapDef.rewardCoins + snap.bonusCoinsCollected * 15
            : Math.max(10, snap.collectedCount * 8 + snap.bonusCoinsCollected * 10);

          const res: GameResult = {
            victory,
            mapId: mapDef.id,
            mapTitle: mapDef.title,
            score,
            coinsEarned,
            timeSeconds: Math.max(5, snap.elapsedSeconds),
            collectedCount: snap.collectedCount,
            requiredCount: snap.requiredCount,
            bonusCoins: snap.bonusCoinsCollected,
            killedBy,
            mode: coopMode === 'solo' ? 'solo' : 'coop',
          };
          setMatchResult(res);
          onMatchFinish(res);
        },
      },
      coopMode,
    );

    engineRef.current = engine;

    const onEsc = (e: KeyboardEvent) => {
      if (e.code === 'KeyP') {
        setPaused((prev) => {
          const next = !prev;
          engine.setPaused(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onEsc);

    return () => {
      window.removeEventListener('keydown', onEsc);
      engine.dispose();
      engineRef.current = null;
    };
  }, [mapDef.id, mapDef.customMapId]);

  // Sync Co-op Remote Players
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || coopMode === 'solo') return;
    coopEvents.remotePlayers.forEach((p) => {
      if (p.id !== localClientId) {
        eng.applyRemotePlayerState(p);
      }
    });
  }, [coopEvents.remotePlayers, coopMode, localClientId]);

  // Sync Co-op Collectibles
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || coopMode === 'solo') return;
    coopEvents.collectedIds.forEach((id) => {
      eng.applyRemoteObjective(id, 'Teammate');
    });
  }, [coopEvents.collectedIds, coopMode]);

  // Sync Co-op Puzzle
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !coopEvents.puzzleSolvedBy) return;
    eng.markPuzzleSolved(coopEvents.puzzleSolvedBy);
  }, [coopEvents.puzzleSolvedBy]);

  // Sync Co-op Monsters
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !coopEvents.monstersSync) return;
    eng.applyRemoteMonsters(coopEvents.monstersSync);
  }, [coopEvents.monstersSync]);

  const sendQuickPing = (text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat:ping', text }));
    }
  };

  const dangerAlpha =
    hud.nearestMonsterDist < 16 ? Math.min(0.62, (1 - hud.nearestMonsterDist / 16) * 0.65) : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090C12] select-none">
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Danger / Heartbeat Vignette */}
      {dangerAlpha > 0.02 && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-150"
          style={{
            background: `radial-gradient(circle, transparent 48%, rgba(185, 28, 28, ${dangerAlpha}) 100%)`,
          }}
        />
      )}

      {/* Frozen Snowman Frost Vignette */}
      {hud.freezeLevel > 0.05 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle, transparent 52%, rgba(56, 189, 248, ${hud.freezeLevel * 0.45}) 100%)`,
          }}
        />
      )}

      {/* Christmas Shadow Static Vignette */}
      {hud.shadowStatic > 0.05 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle, transparent 40%, rgba(15, 10, 28, ${hud.shadowStatic * 0.72}) 100%)`,
          }}
        />
      )}

      {/* Hiding Slit Frame */}
      {hud.hiding && (
        <div className="pointer-events-none absolute inset-0 border-x-[68px] border-y-[44px] border-black/85 flex items-start justify-center pt-6">
          <div className="px-4 py-2 bg-[#090C12]/95 border border-white/15 rounded-lg flex items-center gap-2 text-xs text-[#E5A93C] font-medium">
            <EyeOff className="w-4 h-4" />
            <span>Hiding inside {hud.hidingSpotLabel} · Press [E] to exit</span>
          </div>
        </div>
      )}

      {/* Top-Left Objective HUD (solid dark surface, no backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute top-4 left-4 z-10 w-72 bg-[#0B0F17]/90 border border-white/12 rounded-xl p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-sm font-bold text-white truncate">
            {mapDef.title}
          </span>
          <span className="font-mono text-xs text-[#E5A93C] tabular-nums">
            {formatTime(hud.elapsedSeconds)}
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span>{mapDef.objectiveLabel}</span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                hud.collectedCount >= hud.requiredCount ? 'text-emerald-400' : 'text-white'
              }`}
            >
              {hud.collectedCount}/{hud.requiredCount}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>{mapDef.puzzleTitle}</span>
            <span className={hud.puzzleSolved ? 'text-emerald-400 font-semibold' : 'text-amber-300'}>
              {hud.puzzleSolved ? 'Solved' : 'Pending'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>{mapDef.escapeLabel}</span>
            <span className={hud.escapeUnlocked ? 'text-emerald-400 font-bold' : 'text-red-400'}>
              {hud.escapeUnlocked ? 'OPEN' : 'Locked'}
            </span>
          </div>
        </div>
      </div>

      {/* Top-Right Controls & Co-op Ping Bar */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {!hud.pointerLocked && !paused && !puzzleOpen && !matchResult && (
            <button
              onClick={() => engineRef.current?.requestPointerLock()}
              className="px-3 py-2 bg-[#0B0F17]/90 hover:bg-[#141B29] border border-[#E5A93C]/40 text-[#E5A93C] text-xs font-medium rounded-lg transition-colors"
            >
              Click Viewport to Lock Mouse
            </button>
          )}
          <button
            onClick={() => {
              const next = !paused;
              setPaused(next);
              engineRef.current?.setPaused(next);
            }}
            className="px-3 py-2 bg-[#0B0F17]/90 hover:bg-[#141B29] border border-white/15 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
        </div>

        {/* Co-op Room Overlay */}
        {coopMode !== 'solo' && activeRoom && (
          <div className="w-64 bg-[#0B0F17]/90 border border-white/12 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5 font-medium text-white">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                Co-op Squad · {activeRoom.code}
              </span>
              <span className="font-mono text-slate-400">{activeRoom.players.length}/4</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => sendQuickPing('Monster spotted near me!')}
                className="px-2 py-1 bg-red-950/70 hover:bg-red-900/70 border border-red-500/30 rounded text-[11px] text-red-200"
              >
                Ping Danger
              </button>
              <button
                onClick={() => sendQuickPing('Found objective item!')}
                className="px-2 py-1 bg-amber-950/70 hover:bg-amber-900/70 border border-amber-500/30 rounded text-[11px] text-amber-200"
              >
                Ping Item
              </button>
              <button
                onClick={() => sendQuickPing('Heading to Exit!')}
                className="px-2 py-1 bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/30 rounded text-[11px] text-emerald-200"
              >
                Ping Exit
              </button>
            </div>
            {coopEvents.pingLog.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-white/10 max-h-20 overflow-y-auto">
                {coopEvents.pingLog.slice(-3).map((p, idx) => (
                  <div key={idx} className="text-[11px] text-slate-300 truncate">
                    <span className="text-[#E5A93C] font-medium">{p.senderName}:</span> {p.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center Crosshair & Interact Prompt */}
      {!paused && !puzzleOpen && !matchResult && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow" />
          {hud.interactPrompt && (
            <button
              onClick={() => engineRef.current?.triggerInteract()}
              className="pointer-events-auto mt-5 px-4 py-2 bg-[#0B0F17]/95 border border-[#E5A93C]/50 rounded-lg text-xs font-semibold text-white shadow-lg"
            >
              {hud.interactPrompt}
            </button>
          )}
        </div>
      )}

      {/* Status Toast */}
      {hud.statusToast && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-[#0B0F17]/95 border border-[#E5A93C]/50 rounded-lg text-xs font-medium text-[#E5A93C] shadow-lg">
          {hud.statusToast}
        </div>
      )}

      {/* Proximity Warning */}
      {hud.nearestMonsterDist < 13 && hud.nearestMonsterName && !hud.hiding && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1.5 bg-red-950/85 border border-red-500/50 rounded-lg flex items-center gap-2 text-xs font-semibold text-red-200">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span>{hud.nearestMonsterName} is nearby</span>
        </div>
      )}

      {/* Bottom-Left Survival Bars */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-72 bg-[#0B0F17]/90 border border-white/12 rounded-xl p-4 space-y-3">
        {/* Health */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">Vitality</span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: hud.maxHp }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${
                  i < hud.hp ? 'text-[#C81E2B] fill-[#C81E2B]' : 'text-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Sprint Stamina */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              Stamina [Shift]
            </span>
            <span className="font-mono tabular-nums">{Math.round(hud.stamina)}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${(hud.stamina / hud.maxStamina) * 100}%` }}
            />
          </div>
        </div>

        {/* Flashlight Battery */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1">
              <Flashlight className="w-3.5 h-3.5 text-[#E5A93C]" />
              Flashlight [F]
            </span>
            <span className="font-mono tabular-nums">
              {hud.flashlightOn ? `${Math.round((hud.battery / hud.maxBattery) * 100)}%` : 'OFF'}
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E5A93C] transition-all duration-75"
              style={{ width: `${(hud.battery / hud.maxBattery) * 100}%` }}
            />
          </div>
        </div>

        {hud.activeConsumableName && (
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1">
              <Battery className="w-3.5 h-3.5 text-sky-400" />
              [Q] {hud.activeConsumableName}
            </span>
            <span className="font-mono font-semibold text-white tabular-nums">
              ×{hud.consumableUsesLeft}
            </span>
          </div>
        )}
      </div>

      {/* Bottom-Right Subtle Keybinds Bar */}
      {settings.showControlsHint && (
        <div className="pointer-events-none hidden md:flex absolute bottom-4 right-4 z-10 px-4 py-2.5 bg-[#0B0F17]/90 border border-white/12 rounded-xl items-center gap-4 text-xs text-slate-300">
          <span>WASD Move</span>
          <span>Shift Sprint</span>
          <span>F Light</span>
          <span>E Interact / Hide</span>
          <span>P Pause</span>
        </div>
      )}

      {/* Puzzle Overlay */}
      {puzzleOpen && (
        <PuzzleModal
          mapDef={mapDef}
          onSolve={() => {
            setPuzzleOpen(false);
            engineRef.current?.setPuzzleOpen(false);
            engineRef.current?.markPuzzleSolved();
            if (coopMode !== 'solo' && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'puzzle:solve' }));
            }
          }}
          onClose={() => {
            setPuzzleOpen(false);
            engineRef.current?.setPuzzleOpen(false);
          }}
        />
      )}

      {/* Pause Menu */}
      {paused && !matchResult && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm bg-[#111722] border border-white/15 rounded-xl p-6 space-y-4 text-center">
            <h3 className="font-display text-2xl font-bold text-white">Game Paused</h3>
            <p className="text-xs text-slate-400">{mapDef.title} · {mapDef.subtitle}</p>
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  setPaused(false);
                  engineRef.current?.setPaused(false);
                  engineRef.current?.requestPointerLock();
                }}
                className="w-full py-2.5 bg-[#C81E2B] hover:bg-[#a91823] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4" />
                Resume Survival
              </button>
              <button
                onClick={onExitToMenu}
                className="w-full py-2.5 bg-[#1A2333] hover:bg-[#233045] border border-white/10 text-slate-200 font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Defeat Result Modal */}
      {matchResult && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-md bg-[#111722] border border-white/15 rounded-xl p-7 space-y-5 text-center">
            <div className="flex justify-center">
              {matchResult.victory ? (
                <Trophy className="w-12 h-12 text-[#E5A93C]" />
              ) : (
                <ShieldAlert className="w-12 h-12 text-[#C81E2B]" />
              )}
            </div>
            <div>
              <h2 className="font-display text-3xl font-bold text-white">
                {matchResult.victory ? 'You Escaped Alive' : 'Claimed by the Frost'}
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                {matchResult.victory
                  ? `${matchResult.mapTitle} completed in ${formatTime(matchResult.timeSeconds)}`
                  : `Eliminated by ${matchResult.killedBy || 'the winter nightmare'}`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-[#090C12] border border-white/10 rounded-lg p-4">
              <div>
                <div className="text-xs text-slate-400">Score</div>
                <div className="font-mono text-lg font-bold text-white tabular-nums">
                  {matchResult.score}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Candy Coins</div>
                <div className="font-mono text-lg font-bold text-[#E5A93C] tabular-nums">
                  +{matchResult.coinsEarned}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Objectives</div>
                <div className="font-mono text-lg font-bold text-emerald-400 tabular-nums">
                  {matchResult.collectedCount}/{matchResult.requiredCount}
                </div>
              </div>
            </div>

            {matchResult.victory && (
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-300">
                <Sparkles className="w-4 h-4" />
                <span>Points & Leaderboard record saved!</span>
              </div>
            )}

            <button
              onClick={onExitToMenu}
              className="w-full py-3 bg-[#C81E2B] hover:bg-[#a91823] text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Return to Main Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
