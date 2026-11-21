import React, { useState } from 'react';
import { Bell, Clock, Flame, Lock, Snowflake, Trees, X, Zap } from 'lucide-react';
import { MapDefinition } from '../types/game';
import { audioEngine } from '../engine/audioEngine';

interface PuzzleModalProps {
  mapDef: MapDefinition;
  onSolve: () => void;
  onClose: () => void;
}

export const PuzzleModal: React.FC<PuzzleModalProps> = ({ mapDef, onSolve, onClose }) => {
  // Village Rune Lock state (target: Bell=2, Snowflake=0, Evergreen=1)
  const [dials, setDials] = useState([0, 1, 2]);
  // Forest Track Levers (sequence: Lever 2 -> Lever 3 -> Lever 1)
  const [levers, setLevers] = useState<number[]>([]);
  // Factory Power Conduit angles (0, 90, 180, 270 -> all must align to 0 or 180)
  const [pipes, setPipes] = useState([90, 270, 90, 180]);
  // Mansion Clock (target: hour=12, minute=0, lever pulled)
  const [clockHour, setClockHour] = useState(9);
  const [clockMin, setClockMin] = useState(30);
  // Station Boiler Valves (target: all 4 between 60 and 80)
  const [valves, setValves] = useState([35, 90, 45, 85]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSolveSuccess = () => {
    audioEngine.playCollect(false);
    onSolve();
  };

  // Village: Bell (2), Snowflake (0), Evergreen (1)
  const cycleDial = (idx: number) => {
    audioEngine.playClick();
    setErrorMsg(null);
    setDials((prev) => prev.map((v, i) => (i === idx ? (v + 1) % 3 : v)));
  };

  const verifyVillage = () => {
    if (dials[0] === 2 && dials[1] === 0 && dials[2] === 1) {
      handleSolveSuccess();
    } else {
      setErrorMsg('The padlock stays frozen shut. Check the Frosthaven chime order.');
    }
  };

  // Forest: Sequence 2 -> 3 -> 1
  const pullLever = (num: number) => {
    audioEngine.playClick();
    setErrorMsg(null);
    if (levers.includes(num)) return;
    const next = [...levers, num];
    const expected = [2, 3, 1];
    if (next[next.length - 1] !== expected[next.length - 1]) {
      setLevers([]);
      setErrorMsg('Track switch jammed! Follow the frozen signal plate: 2 → 3 → 1.');
      return;
    }
    setLevers(next);
    if (next.length === 3) {
      setTimeout(handleSolveSuccess, 260);
    }
  };

  // Factory: align all 4 circuit relays to 0 degrees
  const rotatePipe = (idx: number) => {
    audioEngine.playClick();
    setErrorMsg(null);
    const next = pipes.map((deg, i) => (i === idx ? (deg + 90) % 360 : deg));
    setPipes(next);
    if (next.every((d) => d === 0)) {
      setTimeout(handleSolveSuccess, 260);
    }
  };

  // Mansion: Midnight 12:00
  const verifyMansion = () => {
    if (clockHour === 12 && clockMin === 0) {
      handleSolveSuccess();
    } else {
      setErrorMsg('The grandfather clock must strike Midnight (12:00) to reveal the Secret Basement.');
    }
  };

  // Station: Boiler valves 60..80 PSI
  const adjustValve = (idx: number, delta: number) => {
    audioEngine.playClick();
    setErrorMsg(null);
    setValves((prev) =>
      prev.map((v, i) => (i === idx ? Math.max(10, Math.min(100, v + delta)) : v)),
    );
  };

  const verifyStation = () => {
    if (valves.every((v) => v >= 60 && v <= 80)) {
      handleSolveSuccess();
    } else {
      setErrorMsg('Steam pressure unstable! Balance every gauge between 60 and 80 PSI.');
    }
  };

  const runeIcons = [
    { label: 'Snowflake', Icon: Snowflake },
    { label: 'Evergreen', Icon: Trees },
    { label: 'Sleigh Bell', Icon: Bell },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg bg-[#0F1520] border border-white/15 rounded-xl shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-medium text-[#E5A93C] tracking-wide">
              {mapDef.title} · Puzzle Mechanism
            </p>
            <h3 className="font-display text-xl font-bold text-white mt-1">
              {mapDef.puzzleTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close puzzle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">{mapDef.puzzleHint}</p>

        {/* Map 1 & Custom: Rune Padlock */}
        {(mapDef.id === 'village' || mapDef.id === 'custom') && (
          <div className="space-y-4">
            <div className="bg-[#090C12] border border-white/10 rounded-lg p-3 text-xs text-slate-300">
              Frosthaven Plaque Clue: <span className="text-white font-semibold">1st Sleigh Bell · 2nd Snowflake · 3rd Evergreen</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {dials.map((val, idx) => {
                const { Icon, label } = runeIcons[val];
                return (
                  <button
                    key={idx}
                    onClick={() => cycleDial(idx)}
                    className="flex flex-col items-center justify-center gap-2 py-5 px-3 bg-[#161F2E] hover:bg-[#1E2A3E] border border-white/15 rounded-lg transition-colors"
                  >
                    <Icon className="w-7 h-7 text-[#E5A93C]" />
                    <span className="text-xs font-medium text-slate-200">{label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={verifyVillage}
              className="w-full py-3 bg-[#C81E2B] hover:bg-[#a91823] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Unlock Gate Mechanism
            </button>
          </div>
        )}

        {/* Map 2: Frozen Rail Junction */}
        {mapDef.id === 'forest' && (
          <div className="space-y-4">
            <div className="bg-[#090C12] border border-white/10 rounded-lg p-3 text-xs text-slate-300">
              Iced Signal Plate: Throw switches in order <span className="font-mono text-[#38BDF8] font-semibold">2 → 3 → 1</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((num) => {
                const engaged = levers.includes(num);
                return (
                  <button
                    key={num}
                    onClick={() => pullLever(num)}
                    className={`py-6 px-3 rounded-lg border text-center transition-colors ${
                      engaged
                        ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                        : 'bg-[#161F2E] hover:bg-[#1E2A3E] border-white/15 text-slate-100'
                    }`}
                  >
                    <div className="font-mono text-2xl font-bold tabular-nums">#{num}</div>
                    <div className="text-xs mt-1 text-slate-400">
                      {engaged ? 'Engaged' : 'Pull Lever'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Map 3: Factory Power Circuit */}
        {mapDef.id === 'factory' && (
          <div className="space-y-4">
            <div className="bg-[#090C12] border border-white/10 rounded-lg p-3 text-xs text-slate-300">
              Rotate all 4 brass dynamo relays so every conduit points horizontally (<span className="text-[#E5A93C] font-semibold">0°</span>) to restore loading bay power.
            </div>
            <div className="grid grid-cols-4 gap-3">
              {pipes.map((deg, idx) => (
                <button
                  key={idx}
                  onClick={() => rotatePipe(idx)}
                  className={`py-5 px-2 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                    deg === 0
                      ? 'bg-amber-950/40 border-[#E5A93C] text-[#E5A93C]'
                      : 'bg-[#161F2E] hover:bg-[#1E2A3E] border-white/15 text-slate-300'
                  }`}
                >
                  <Zap
                    className="w-7 h-7 transition-transform"
                    style={{ transform: `rotate(${deg}deg)` }}
                  />
                  <span className="font-mono text-xs tabular-nums">{deg}°</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Map 4: Haunted Mansion Grandfather Clock */}
        {mapDef.id === 'mansion' && (
          <div className="space-y-4">
            <div className="bg-[#090C12] border border-white/10 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-[#E5A93C]" />
                <div>
                  <div className="text-xs text-slate-400">Grand Clock Time</div>
                  <div className="font-mono text-2xl font-bold text-white tabular-nums">
                    {String(clockHour).padStart(2, '0')}:{String(clockMin).padStart(2, '0')}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    audioEngine.playClick();
                    setClockHour((h) => (h % 12) + 1);
                  }}
                  className="px-3 py-2 bg-[#161F2E] hover:bg-[#1E2A3E] border border-white/15 rounded-lg text-xs font-medium text-white"
                >
                  +1 Hour
                </button>
                <button
                  onClick={() => {
                    audioEngine.playClick();
                    setClockMin((m) => (m + 15) % 60);
                  }}
                  className="px-3 py-2 bg-[#161F2E] hover:bg-[#1E2A3E] border border-white/15 rounded-lg text-xs font-medium text-white"
                >
                  +15 Min
                </button>
              </div>
            </div>
            <button
              onClick={verifyMansion}
              className="w-full py-3 bg-[#C81E2B] hover:bg-[#a91823] text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Pull Hidden Study Lever (Reveal Secret Basement)
            </button>
          </div>
        )}

        {/* Map 5: Frozen Train Station Boiler */}
        {mapDef.id === 'station' && (
          <div className="space-y-4">
            <div className="bg-[#090C12] border border-white/10 rounded-lg p-3 text-xs text-slate-300">
              Balance all 4 locomotive steam gauges inside the <span className="text-emerald-400 font-semibold">60–80 PSI</span> ignition zone.
            </div>
            <div className="grid grid-cols-2 gap-3">
              {valves.map((psi, idx) => {
                const inRange = psi >= 60 && psi <= 80;
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      inRange
                        ? 'bg-emerald-950/30 border-emerald-500/50'
                        : 'bg-[#161F2E] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                      <span>Valve #{idx + 1}</span>
                      <span className="font-mono font-bold tabular-nums text-white">{psi} PSI</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => adjustValve(idx, -10)}
                        className="flex-1 py-1.5 bg-[#090C12] hover:bg-black border border-white/10 rounded text-xs font-mono text-white"
                      >
                        -10
                      </button>
                      <button
                        onClick={() => adjustValve(idx, 10)}
                        className="flex-1 py-1.5 bg-[#090C12] hover:bg-black border border-white/10 rounded text-xs font-mono text-white"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={verifyStation}
              className="w-full py-3 bg-[#C81E2B] hover:bg-[#a91823] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Flame className="w-4 h-4" />
              Ignite Midnight Polar Express
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
};
