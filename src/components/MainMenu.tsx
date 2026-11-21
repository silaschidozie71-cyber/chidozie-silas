import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Coins,
  Compass,
  Hammer,
  Play,
  Radio,
  Shield,
  ShoppingBag,
  Skull,
  Sliders,
  Trophy,
  Users,
} from 'lucide-react';
import {
  CAMPAIGN_MAPS,
  HERO_BACKDROP_URL,
  MONSTERS,
  SHOP_ITEMS,
} from '../data/campaign';
import {
  ActiveRoom,
  CustomMapData,
  GameSettings,
  LeaderboardEntry,
  MapDefinition,
  MapId,
  MenuTab,
  RoomSummary,
  UserProgression,
} from '../types/game';
import { MapBuilder } from './MapBuilder';

interface MainMenuProps {
  activeTab: MenuTab;
  setActiveTab: (tab: MenuTab) => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  progression: UserProgression;
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onLaunchMap: (mapDef: MapDefinition) => void;
  onBuyOrEquipItem: (itemId: string) => void;
  leaderboard: LeaderboardEntry[];
  leaderboardFilter: MapId | 'all';
  onChangeLeaderboardFilter: (f: MapId | 'all') => void;
  customMaps: CustomMapData[];
  onRefreshCustomMaps: () => void;
  onDeleteCustomMap: (mapId: string) => void;
  // Multiplayer props
  wsConnected: boolean;
  publicRooms: RoomSummary[];
  activeRoom: ActiveRoom | null;
  localClientId: string | null;
  roomError: string | null;
  onCreateRoom: (mapId: string, mapTitle: string) => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onToggleReady: (ready: boolean) => void;
  onChangeRoomMap: (mapId: string, mapTitle: string) => void;
  onStartCoopMatch: () => void;
  onRefreshRooms: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  activeTab,
  setActiveTab,
  user,
  onSignIn,
  onSignOut,
  progression,
  settings,
  onUpdateSettings,
  onLaunchMap,
  onBuyOrEquipItem,
  leaderboard,
  leaderboardFilter,
  onChangeLeaderboardFilter,
  customMaps,
  onRefreshCustomMaps,
  onDeleteCustomMap,
  wsConnected,
  publicRooms,
  activeRoom,
  localClientId,
  roomError,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleReady,
  onChangeRoomMap,
  onStartCoopMatch,
  onRefreshRooms,
}) => {
  const [selectedChapterIdx, setSelectedChapterIdx] = useState(0);
  const [mapsSubMode, setMapsSubMode] = useState<'browse' | 'builder'>('browse');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [createMapId, setCreateMapId] = useState<string>('village');

  const selectedMap = CAMPAIGN_MAPS[selectedChapterIdx] || CAMPAIGN_MAPS[0];
  const localPeer = activeRoom?.players.find((p) => p.id === localClientId);
  const isHost = activeRoom?.hostId === localClientId;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#090C12] text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#090C12]/95 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            onClick={() => setActiveTab('play')}
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-[#E5A93C] transition-colors"
          >
            Hollow Eve
          </button>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="flex items-center gap-6 overflow-x-auto">
            {(
              [
                ['play', 'Play'],
                ['multiplayer', 'Multiplayer'],
                ['maps', 'Maps'],
                ['shop', 'Shop'],
                ['leaderboard', 'Leaderboard'],
                ['settings', 'Settings'],
              ] as Array<[MenuTab, string]>
            ).map(([tabId, label]) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`py-5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                  activeTab === tabId
                    ? 'border-[#C81E2B] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-4 shrink-0">
            {user ? (
              <button
                onClick={onSignOut}
                className="px-4 py-2 text-xs font-semibold text-slate-200 bg-[#141B29] hover:bg-[#1C2639] border border-white/15 rounded-lg whitespace-nowrap shrink-0 transition-colors"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={onSignIn}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#C81E2B] hover:bg-[#a91823] rounded-lg whitespace-nowrap shrink-0 transition-colors"
              >
                Sign In with Google
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-10">
        {/* ================= PLAY / STORYLINE TAB ================= */}
        {activeTab === 'play' && (
          <div className="space-y-10">
            {/* Hero Storyline Split */}
            <section className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#111722] min-h-[420px] flex items-end">
              <img
                src={HERO_BACKDROP_URL}
                alt="Frosthaven Christmas Village at Midnight"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#090C12] via-[#090C12]/70 to-black/25" />

              <div className="relative z-10 w-full p-8 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#E5A93C] font-medium">
                    <span>Five-Chapter Survival Horror</span>
                    <span aria-hidden="true">·</span>
                    <span>{progression.points.toLocaleString()} Total Points</span>
                    <span aria-hidden="true">·</span>
                    <span>{progression.candyCoins.toLocaleString()} Candy Coins</span>
                  </div>
                  <h1 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight [text-wrap:balance]">
                    Survive the Cursed Christmas Night
                  </h1>
                  <p className="text-sm md:text-base text-slate-200 max-w-2xl leading-relaxed">
                    Frosthaven has fallen silent beneath a blood-red moon. Search frozen cottages for stolen gifts, recover missing railway tracks in the blizzard, outsmart the workshop guards, uncover the Haunted Mansion’s secret basement, and board the Midnight Polar Express before dawn.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => onLaunchMap(selectedMap)}
                      className="px-6 py-3 bg-[#C81E2B] hover:bg-[#a91823] text-white font-semibold text-sm rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      Play {selectedMap.title}
                    </button>
                    <button
                      onClick={() => setActiveTab('multiplayer')}
                      className="px-5 py-3 bg-[#141B29]/90 hover:bg-[#1D273B] border border-white/15 text-slate-100 font-semibold text-sm rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Users className="w-4 h-4" />
                      Co-op Multiplayer
                    </button>
                  </div>
                </div>

                {/* Selected Chapter Card */}
                <div className="lg:col-span-4 bg-[#0B0F17]/92 border border-white/15 rounded-xl p-5 space-y-3">
                  <div className="text-xs text-slate-400">
                    Selected Chapter · {selectedMap.subtitle}
                  </div>
                  <div className="font-display text-xl font-bold text-white">
                    {selectedMap.title}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedMap.storyline}
                  </p>
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                    <span>Reward</span>
                    <span className="font-mono text-[#E5A93C] tabular-nums">
                      +{selectedMap.rewardPoints} pts · +{selectedMap.rewardCoins} coins
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Storyline Chapter Selector */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold text-white">
                  Storyline Chapters
                </h2>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {progression.completedMaps.length}/5 Escaped
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {CAMPAIGN_MAPS.map((m, idx) => {
                  const completed = progression.completedMaps.includes(m.id);
                  const active = idx === selectedChapterIdx;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedChapterIdx(idx)}
                      className={`text-left rounded-xl overflow-hidden border transition-colors bg-[#111722] flex flex-col ${
                        active
                          ? 'border-[#C81E2B]'
                          : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="aspect-[4/3] w-full bg-[#090C12] overflow-hidden relative">
                        <img
                          src={m.imageUrl}
                          alt={m.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3.5 space-y-1 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="text-xs text-slate-400">
                            Chapter {m.chapterNumber} {completed ? '· Escaped' : ''}
                          </div>
                          <div className="font-display text-sm font-bold text-white mt-0.5">
                            {m.title}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400 pt-2">
                          {m.monsters.map((mt) => MONSTERS[mt].name).join(', ')}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Monster Field Dossier */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Nightmares of Frosthaven
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Study their audio cues and abilities before entering the blizzard.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.values(MONSTERS).map((monster) => (
                  <div
                    key={monster.id}
                    className="bg-[#111722] border border-white/10 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: monster.accentColor }}
                      >
                        {monster.title}
                      </span>
                      <Skull className="w-4 h-4 text-slate-500 shrink-0" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-white">
                      {monster.name}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {monster.description}
                    </p>
                    <div className="pt-2 border-t border-white/10 text-xs text-slate-400">
                      {monster.ability}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ================= MULTIPLAYER TAB ================= */}
        {activeTab === 'multiplayer' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold text-white">
                  Co-op Survival Multiplayer
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Team up with up to 4 survivors in real-time to collect items, solve puzzles, and escape together.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Radio className={`w-4 h-4 ${wsConnected ? 'text-emerald-400' : 'text-red-400'}`} />
                <span>{wsConnected ? 'Multiplayer Server Connected' : 'Connecting to Server...'}</span>
              </div>
            </div>

            {roomError && (
              <div className="p-3.5 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200">
                {roomError}
              </div>
            )}

            {!activeRoom ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Create Room */}
                <div className="lg:col-span-5 bg-[#111722] border border-white/10 rounded-xl p-6 space-y-4">
                  <h2 className="font-display text-xl font-bold text-white">Host Co-op Room</h2>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">Select Map</label>
                    <select
                      value={createMapId}
                      onChange={(e) => setCreateMapId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#090C12] border border-white/15 rounded-lg text-sm text-white"
                    >
                      {CAMPAIGN_MAPS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} ({m.subtitle})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    disabled={!wsConnected}
                    onClick={() => {
                      const found = CAMPAIGN_MAPS.find((m) => m.id === createMapId) || CAMPAIGN_MAPS[0];
                      onCreateRoom(found.id, found.title);
                    }}
                    className="w-full py-3 bg-[#C81E2B] hover:bg-[#a91823] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Create Lobby Room
                  </button>
                </div>

                {/* Join by Code & Public Rooms */}
                <div className="lg:col-span-7 bg-[#111722] border border-white/10 rounded-xl p-6 space-y-5">
                  <div className="space-y-2">
                    <h2 className="font-display text-xl font-bold text-white">Join Squad</h2>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 4-letter Room Code (e.g. X9K2)"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-2.5 bg-[#090C12] border border-white/15 rounded-lg text-sm font-mono uppercase text-white"
                      />
                      <button
                        disabled={!wsConnected || !joinCodeInput.trim()}
                        onClick={() => onJoinRoom(joinCodeInput.trim())}
                        className="px-5 py-2.5 bg-[#1A2333] hover:bg-[#243147] border border-white/15 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        Join
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Open Lobbies</h3>
                      <button
                        onClick={onRefreshRooms}
                        className="text-xs text-[#E5A93C] hover:underline"
                      >
                        Refresh List
                      </button>
                    </div>
                    {publicRooms.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">
                        No open lobbies right now. Create a room on the left or share your room code!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {publicRooms.map((r) => (
                          <div
                            key={r.code}
                            className="flex items-center justify-between p-3 bg-[#090C12] border border-white/10 rounded-lg"
                          >
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {r.mapTitle} · <span className="font-mono text-[#E5A93C]">{r.code}</span>
                              </div>
                              <div className="text-xs text-slate-400">
                                Host: {r.hostName} · {r.playerCount}/4 Survivors
                              </div>
                            </div>
                            <button
                              onClick={() => onJoinRoom(r.code)}
                              className="px-4 py-1.5 bg-[#C81E2B] hover:bg-[#a91823] text-white text-xs font-semibold rounded-md"
                            >
                              Join
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Active Lobby Screen */
              <div className="bg-[#111722] border border-white/10 rounded-xl p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="text-xs text-slate-400">Room Code</div>
                    <div className="font-mono text-3xl font-bold text-[#E5A93C] tracking-widest">
                      {activeRoom.code}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isHost && (
                      <select
                        value={activeRoom.mapId}
                        onChange={(e) => {
                          const found = CAMPAIGN_MAPS.find((m) => m.id === e.target.value);
                          if (found) onChangeRoomMap(found.id, found.title);
                        }}
                        className="px-3 py-2 bg-[#090C12] border border-white/15 rounded-lg text-sm text-white"
                      >
                        {CAMPAIGN_MAPS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={onLeaveRoom}
                      className="px-4 py-2 bg-[#1A2333] hover:bg-[#233045] border border-white/15 text-xs font-semibold text-slate-200 rounded-lg"
                    >
                      Leave Room
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {activeRoom.players.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 bg-[#090C12] border border-white/10 rounded-lg space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white truncate">{p.name}</span>
                        {p.isHost && (
                          <span className="text-[11px] font-medium text-[#E5A93C]">Host</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {p.ready ? 'Ready for Departure' : 'Preparing Gear...'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  {!isHost && localPeer && (
                    <button
                      onClick={() => onToggleReady(!localPeer.ready)}
                      className="px-5 py-2.5 bg-[#1A2333] hover:bg-[#233045] border border-white/15 text-white text-sm font-semibold rounded-lg"
                    >
                      {localPeer.ready ? 'Unready' : 'Mark Ready'}
                    </button>
                  )}
                  {isHost && (
                    <button
                      onClick={onStartCoopMatch}
                      className="px-6 py-3 bg-[#C81E2B] hover:bg-[#a91823] text-white text-sm font-semibold rounded-lg flex items-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      Launch Co-op Match ({activeRoom.mapTitle})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= MAPS & MAP BUILDER TAB ================= */}
        {activeTab === 'maps' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold text-white">
                  Maps & Map Builder
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Explore all five official Frosthaven locations or design your own haunted 3D map.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#111722] border border-white/10 rounded-lg">
                <button
                  onClick={() => setMapsSubMode('browse')}
                  className={`px-4 py-2 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                    mapsSubMode === 'browse'
                      ? 'bg-[#C81E2B] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  Campaign Maps
                </button>
                <button
                  onClick={() => setMapsSubMode('builder')}
                  className={`px-4 py-2 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                    mapsSubMode === 'builder'
                      ? 'bg-[#C81E2B] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Hammer className="w-3.5 h-3.5" />
                  Build Map
                </button>
              </div>
            </div>

            {mapsSubMode === 'browse' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {CAMPAIGN_MAPS.map((m) => (
                  <div
                    key={m.id}
                    className="bg-[#111722] border border-white/10 rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[4/3] w-full bg-[#090C12] overflow-hidden">
                      <img
                        src={m.imageUrl}
                        alt={m.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="text-xs text-[#E5A93C] font-medium">
                          {m.subtitle} · {m.requiredCollectibles} Items
                        </div>
                        <h3 className="font-display text-xl font-bold text-white">{m.title}</h3>
                        <p className="text-xs text-slate-300 leading-relaxed">{m.storyline}</p>
                      </div>
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-400 truncate">
                          {m.monsters.map((mt) => MONSTERS[mt].name).join(' · ')}
                        </span>
                        <button
                          onClick={() => onLaunchMap(m)}
                          className="px-4 py-2 bg-[#C81E2B] hover:bg-[#a91823] text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors"
                        >
                          Enter Map
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <MapBuilder
                user={user}
                playerName={settings.playerName}
                savedMaps={customMaps}
                onRefreshMaps={onRefreshCustomMaps}
                onPlayCustomMap={onLaunchMap}
                onDeleteMap={onDeleteCustomMap}
              />
            )}
          </div>
        )}

        {/* ================= SHOP TAB ================= */}
        {activeTab === 'shop' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold text-white">
                  Frosthaven Outfitter Shop
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Spend earned Candy Coins on survival gear, consumables, and co-op outfits.
                </p>
              </div>
              <div className="px-4 py-2.5 bg-[#111722] border border-white/10 rounded-lg flex items-center gap-2 text-sm">
                <Coins className="w-4 h-4 text-[#E5A93C]" />
                <span className="font-mono font-bold text-white tabular-nums">
                  {progression.candyCoins.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">Candy Coins</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {SHOP_ITEMS.map((item) => {
                const owned = progression.unlockedItems.includes(item.id);
                const equipped = progression.equippedItems.includes(item.id);
                const canAfford = progression.candyCoins >= item.price;

                return (
                  <div
                    key={item.id}
                    className="bg-[#111722] border border-white/10 rounded-xl p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="capitalize">{item.category}</span>
                        <span className="font-mono text-[#E5A93C] tabular-nums">
                          {owned ? 'Owned' : `${item.price} Coins`}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-white">{item.name}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
                      <div className="pt-2 text-xs text-emerald-400 font-medium">
                        {item.effectSummary}
                      </div>
                    </div>

                    <button
                      disabled={!owned && !canAfford}
                      onClick={() => onBuyOrEquipItem(item.id)}
                      className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                        equipped
                          ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                          : owned
                            ? 'bg-[#1A2333] hover:bg-[#233045] border border-white/15 text-white'
                            : canAfford
                              ? 'bg-[#C81E2B] hover:bg-[#a91823] text-white'
                              : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {equipped ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Equipped (Click to Unequip)
                        </>
                      ) : owned ? (
                        <>
                          <Shield className="w-3.5 h-3.5" />
                          Equip Item
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          Purchase ({item.price} Coins)
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= LEADERBOARD TAB ================= */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold text-white">
                  Survivor Leaderboard
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Fastest escapes and highest survival scores across all five chapters.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#111722] border border-white/10 rounded-lg">
                {(
                  [
                    ['all', 'All Maps'],
                    ['village', 'Village'],
                    ['forest', 'Forest'],
                    ['factory', 'Factory'],
                    ['mansion', 'Mansion'],
                    ['station', 'Train Station'],
                  ] as Array<[MapId | 'all', string]>
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => onChangeLeaderboardFilter(id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      leaderboardFilter === id
                        ? 'bg-[#C81E2B] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#111722] border border-white/10 rounded-xl overflow-hidden">
              {leaderboard.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <Trophy className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm text-slate-300">No recorded escapes for this filter yet.</p>
                  <p className="text-xs text-slate-500">
                    Complete a chapter to claim the top spot on the leaderboard.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#090C12] border-b border-white/10 text-xs text-slate-400">
                      <tr>
                        <th className="py-3.5 px-5 font-medium">Rank</th>
                        <th className="py-3.5 px-5 font-medium">Survivor</th>
                        <th className="py-3.5 px-5 font-medium">Location</th>
                        <th className="py-3.5 px-5 font-medium">Mode</th>
                        <th className="py-3.5 px-5 font-medium text-right">Time</th>
                        <th className="py-3.5 px-5 font-medium text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {leaderboard.map((entry, idx) => (
                        <tr key={entry.entryId} className="hover:bg-white/[0.02]">
                          <td className="py-3.5 px-5 font-mono text-xs text-[#E5A93C] tabular-nums">
                            #{idx + 1}
                          </td>
                          <td className="py-3.5 px-5 font-medium text-white">
                            {entry.playerName}
                          </td>
                          <td className="py-3.5 px-5 text-slate-300 capitalize">
                            {entry.mapId === 'station'
                              ? 'Frozen Train Station'
                              : entry.mapId === 'village'
                                ? 'Christmas Village'
                                : entry.mapId === 'forest'
                                  ? 'Frozen Forest'
                                  : entry.mapId === 'factory'
                                    ? "Santa's Factory"
                                    : entry.mapId === 'mansion'
                                      ? 'Haunted Mansion'
                                      : 'Custom Map'}
                          </td>
                          <td className="py-3.5 px-5 text-xs text-slate-400 uppercase">
                            {entry.mode}
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono text-slate-300 tabular-nums">
                            {formatTime(entry.timeSeconds)}
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono font-bold text-white tabular-nums">
                            {entry.score.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SETTINGS TAB ================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h1 className="font-display text-3xl font-bold text-white">Settings & Controls</h1>
              <p className="text-sm text-slate-400 mt-1">
                Tune sensitivity, audio ambience, visual fidelity, and cloud account sync.
              </p>
            </div>

            <div className="bg-[#111722] border border-white/10 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sliders className="w-4 h-4 text-[#E5A93C]" />
                <span>Gameplay & Audio</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Survivor Display Name</label>
                  <input
                    type="text"
                    maxLength={24}
                    value={settings.playerName}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, playerName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#090C12] border border-white/15 rounded-lg text-sm text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Graphics Quality</label>
                  <select
                    value={settings.graphicsQuality}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        graphicsQuality: e.target.value as 'high' | 'medium',
                      })
                    }
                    className="w-full px-3 py-2 bg-[#090C12] border border-white/15 rounded-lg text-sm text-white"
                  >
                    <option value="high">High (Dynamic Shadows & Full Detail)</option>
                    <option value="medium">Medium (Performance Mode)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Master Audio Volume</span>
                    <span className="font-mono tabular-nums">
                      {Math.round(settings.masterVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.masterVolume}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        masterVolume: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-[#C81E2B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Mouse Look Sensitivity</span>
                    <span className="font-mono tabular-nums">
                      {settings.mouseSensitivity.toFixed(1)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={2.4}
                    step={0.1}
                    value={settings.mouseSensitivity}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        mouseSensitivity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-[#C81E2B]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.invertY}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, invertY: e.target.checked })
                    }
                    className="accent-[#C81E2B] w-4 h-4"
                  />
                  Invert Y-Axis Look
                </label>

                <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showControlsHint}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, showControlsHint: e.target.checked })
                    }
                    className="accent-[#C81E2B] w-4 h-4"
                  />
                  Show Keybinds on HUD
                </label>
              </div>
            </div>

            {/* Keybinds Reference */}
            <div className="bg-[#111722] border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="font-display text-lg font-bold text-white">Survival Controls</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {[
                  ['W A S D / Arrows', 'Move'],
                  ['Mouse / Drag', 'Look Around'],
                  ['Shift', 'Sprint (Uses Stamina)'],
                  ['F', 'Toggle Flashlight'],
                  ['E', 'Collect / Hide / Puzzle / Escape'],
                  ['Q', 'Use Equipped Consumable'],
                  ['P', 'Pause Menu'],
                ].map(([key, action]) => (
                  <div
                    key={key}
                    className="p-3 bg-[#090C12] border border-white/10 rounded-lg space-y-1"
                  >
                    <div className="font-mono font-semibold text-[#E5A93C]">{key}</div>
                    <div className="text-slate-300">{action}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
