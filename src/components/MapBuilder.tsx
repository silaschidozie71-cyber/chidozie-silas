import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Play, RotateCcw, Save, Trash2 } from 'lucide-react';
import { DEFAULT_CUSTOM_GRID, MONSTERS } from '../data/campaign';
import { saveCustomMapToCloud } from '../lib/firebase';
import { CustomMapData, MapDefinition, MapTheme, MonsterType, TileChar } from '../types/game';

interface MapBuilderProps {
  user: User | null;
  playerName: string;
  savedMaps: CustomMapData[];
  onRefreshMaps: () => void;
  onPlayCustomMap: (mapDef: MapDefinition) => void;
  onDeleteMap: (mapId: string) => void;
}

const PALETTE: Array<{ char: TileChar; label: string; swatch: string }> = [
  { char: '.', label: 'Walk Path', swatch: 'bg-slate-700' },
  { char: '#', label: 'Wall / House', swatch: 'bg-slate-300 text-slate-900' },
  { char: 'T', label: 'Pine Tree', swatch: 'bg-emerald-800' },
  { char: 'H', label: 'Hiding Spot', swatch: 'bg-amber-700' },
  { char: 'G', label: 'Gift / Item', swatch: 'bg-[#C81E2B]' },
  { char: 'C', label: 'Candy Coin', swatch: 'bg-amber-400 text-slate-900' },
  { char: 'P', label: 'Puzzle', swatch: 'bg-sky-500 text-slate-950' },
  { char: 'L', label: 'Streetlamp', swatch: 'bg-yellow-200 text-slate-900' },
  { char: 'S', label: 'Player Spawn', swatch: 'bg-emerald-400 text-slate-950' },
  { char: 'M', label: 'Monster', swatch: 'bg-purple-600' },
  { char: 'E', label: 'Escape Gate', swatch: 'bg-teal-400 text-slate-950' },
];

export function customMapToDefinition(data: CustomMapData): MapDefinition {
  const giftCount = data.gridRows.join('').split('').filter((c) => c === 'G').length;
  return {
    id: 'custom',
    chapterNumber: 0,
    title: data.title,
    subtitle: `Custom Map · by ${data.authorName}`,
    theme: data.theme,
    storyline: `Survive ${data.title}, a custom haunted nightmare stalked by ${MONSTERS[data.monsterType].name}.`,
    objectiveLabel: 'Custom Objectives',
    puzzleTitle: 'Rune Gate Lock',
    puzzleHint: 'Align the three winter symbols (Bell · Snowflake · Evergreen) to unlock the exit.',
    escapeLabel: 'Escape Gate',
    imageUrl: `/src/assets/images/map_christmas_village_1795264142484.jpg`,
    monsters: [data.monsterType],
    gridRows: data.gridRows,
    requiredCollectibles: Math.max(1, giftCount),
    rewardPoints: 1400,
    rewardCoins: 75,
    customMapId: data.mapId,
  };
}

export const MapBuilder: React.FC<MapBuilderProps> = ({
  user,
  playerName,
  savedMaps,
  onRefreshMaps,
  onPlayCustomMap,
  onDeleteMap,
}) => {
  const [title, setTitle] = useState('Kringle Alley');
  const [theme, setTheme] = useState<MapTheme>('village');
  const [monsterType, setMonsterType] = useState<MonsterType>('evil_santa');
  const [grid, setGrid] = useState<string[][]>(() =>
    DEFAULT_CUSTOM_GRID.map((row) => row.split('')),
  );
  const [brush, setBrush] = useState<TileChar>('#');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const paintCell = (r: number, c: number) => {
    setStatusMsg(null);
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      // Keep single S, E, P
      if (brush === 'S' || brush === 'E' || brush === 'P') {
        for (let rr = 0; rr < 16; rr++) {
          for (let cc = 0; cc < 16; cc++) {
            if (next[rr][cc] === brush) next[rr][cc] = '.';
          }
        }
      }
      next[r][c] = brush;
      return next;
    });
  };

  const validateMap = (): string | null => {
    const flat = grid.flat().join('');
    if (!flat.includes('S')) return 'Place 1 Player Spawn (S) tile.';
    if (!flat.includes('E')) return 'Place 1 Escape Gate (E) tile.';
    if (!flat.includes('P')) return 'Place 1 Puzzle Station (P) tile.';
    if (!flat.includes('G')) return 'Place at least 1 Gift / Objective (G) tile.';
    if (!flat.includes('M')) return 'Place at least 1 Monster Spawn (M) tile.';
    return null;
  };

  const buildDataObject = (): CustomMapData => ({
    mapId: `cmap_${Date.now()}`,
    ownerId: user?.uid || 'local',
    authorName: playerName || 'Architect',
    title: title.trim() || 'Untitled Nightmare',
    theme,
    monsterType,
    gridRows: grid.map((r) => r.join('')),
  });

  const handleSave = async () => {
    const err = validateMap();
    if (err) {
      setStatusMsg(err);
      return;
    }
    const data = buildDataObject();
    // Always store locally too
    const localKey = 'hollow_eve_custom_maps';
    const existing: CustomMapData[] = JSON.parse(localStorage.getItem(localKey) || '[]');
    localStorage.setItem(localKey, JSON.stringify([data, ...existing].slice(0, 12)));

    if (user) {
      setSaving(true);
      try {
        await saveCustomMapToCloud(user, data);
        setStatusMsg('Saved custom map to Cloud Library & Local Storage.');
      } catch (e) {
        setStatusMsg(e instanceof Error ? e.message : 'Saved locally (Cloud sync failed).');
      } finally {
        setSaving(false);
      }
    } else {
      setStatusMsg('Saved locally. Sign in with Google to publish to Cloud Maps.');
    }
    onRefreshMaps();
  };

  const handlePlayNow = () => {
    const err = validateMap();
    if (err) {
      setStatusMsg(err);
      return;
    }
    onPlayCustomMap(customMapToDefinition(buildDataObject()));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Editor Grid */}
      <div className="lg:col-span-7 bg-[#111722] border border-white/10 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-white">16×16 Map Architect</h3>
            <p className="text-xs text-slate-400">
              Paint walls, cottages, hiding spots, gifts, and monster spawns.
            </p>
          </div>
          <button
            onClick={() => setGrid(DEFAULT_CUSTOM_GRID.map((row) => row.split('')))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Template
          </button>
        </div>

        <div className="grid grid-cols-16 gap-1 bg-[#090C12] p-2.5 rounded-lg border border-white/10 select-none">
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const p = PALETTE.find((x) => x.char === cell) || PALETTE[0];
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => paintCell(r, c)}
                  title={`(${r},${c}) ${p.label}`}
                  className={`aspect-square rounded-sm text-[10px] font-mono font-bold flex items-center justify-center transition-transform hover:scale-110 ${p.swatch}`}
                >
                  {cell === '.' ? '' : cell}
                </button>
              );
            }),
          )}
        </div>

        {/* Tile Brush Palette */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {PALETTE.map((item) => (
            <button
              key={item.char}
              onClick={() => setBrush(item.char)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                brush === item.char
                  ? 'bg-[#C81E2B]/20 border-[#C81E2B] text-white'
                  : 'bg-[#090C12] border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-sm font-mono text-[10px] font-bold flex items-center justify-center shrink-0 ${item.swatch}`}
              >
                {item.char === '.' ? '·' : item.char}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Settings & Saved Maps */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-[#111722] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-lg font-bold text-white">Map Configuration</h3>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Map Title</label>
            <input
              type="text"
              maxLength={40}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#090C12] border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-[#E5A93C]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Environment Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as MapTheme)}
                className="w-full px-3 py-2 bg-[#090C12] border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-[#E5A93C]"
              >
                <option value="village">Christmas Village</option>
                <option value="forest">Frozen Forest</option>
                <option value="factory">Santa's Factory</option>
                <option value="mansion">Haunted Mansion</option>
                <option value="station">Frozen Train Station</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Stalking Monster</label>
              <select
                value={monsterType}
                onChange={(e) => setMonsterType(e.target.value as MonsterType)}
                className="w-full px-3 py-2 bg-[#090C12] border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-[#E5A93C]"
              >
                <option value="evil_santa">Evil Santa</option>
                <option value="frozen_snowman">Frozen Snowman</option>
                <option value="naughty_elf">Naughty Elf</option>
                <option value="christmas_shadow">Christmas Shadow</option>
              </select>
            </div>
          </div>

          {statusMsg && (
            <div className="p-3 bg-[#090C12] border border-[#E5A93C]/40 rounded-lg text-xs text-slate-200">
              {statusMsg}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 px-4 bg-[#1A2333] hover:bg-[#233045] border border-white/15 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Map'}
            </button>
            <button
              onClick={handlePlayNow}
              className="flex-1 py-2.5 px-4 bg-[#C81E2B] hover:bg-[#a91823] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4" />
              Play Custom Map
            </button>
          </div>
        </div>

        {/* Saved Custom Maps List */}
        <div className="bg-[#111722] border border-white/10 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-base font-bold text-white">Community & Saved Maps</h4>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {savedMaps.length} maps
            </span>
          </div>

          {savedMaps.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              No saved custom maps yet. Build and save one above!
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {savedMaps.map((m) => (
                <div
                  key={m.mapId}
                  className="flex items-center justify-between gap-3 p-3 bg-[#090C12] border border-white/10 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{m.title}</div>
                    <div className="text-xs text-slate-400 truncate">
                      {m.authorName} · {MONSTERS[m.monsterType].name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onPlayCustomMap(customMapToDefinition(m))}
                      className="px-3 py-1.5 bg-[#C81E2B] hover:bg-[#a91823] text-white text-xs font-semibold rounded-md transition-colors"
                    >
                      Play
                    </button>
                    {(!user || m.ownerId === user.uid || m.ownerId === 'local') && (
                      <button
                        onClick={() => onDeleteMap(m.mapId)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors"
                        title="Delete map"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
