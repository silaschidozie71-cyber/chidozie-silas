import React, { useCallback, useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { CAMPAIGN_MAPS, SHOP_ITEMS } from './data/campaign';
import { audioEngine } from './engine/audioEngine';
import {
  deleteCustomMapFromCloud,
  fetchCustomMapsFromCloud,
  fetchLeaderboardEntries,
  fetchOrCreateUserProfile,
  saveUserProgression,
  signInWithGoogle,
  signOutUser,
  submitLeaderboardEntry,
  subscribeAuth,
  testFirestoreConnection,
} from './lib/firebase';
import {
  ActiveRoom,
  CustomMapData,
  GameResult,
  GameSettings,
  LeaderboardEntry,
  MapDefinition,
  MapId,
  MenuTab,
  RemotePlayerState,
  RoomSummary,
  UserProgression,
} from './types/game';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GameViewport } from './components/GameViewport';
import { MainMenu } from './components/MainMenu';

const SETTINGS_KEY = 'hollow_eve_settings_v1';
const PROGRESSION_KEY = 'hollow_eve_progression_v1';
const LOCAL_LEADERBOARD_KEY = 'hollow_eve_local_leaderboard_v1';
const LOCAL_CUSTOM_MAPS_KEY = 'hollow_eve_custom_maps';

const DEFAULT_SETTINGS: GameSettings = {
  playerName: 'Survivor',
  masterVolume: 0.7,
  mouseSensitivity: 1.0,
  graphicsQuality: 'high',
  invertY: false,
  showControlsHint: true,
};

const DEFAULT_PROGRESSION: UserProgression = {
  displayName: 'Survivor',
  points: 0,
  candyCoins: 60,
  unlockedItems: [],
  equippedItems: [],
  completedMaps: [],
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<MenuTab>('play');
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<GameSettings>(() =>
    readJson(SETTINGS_KEY, DEFAULT_SETTINGS),
  );
  const [progression, setProgression] = useState<UserProgression>(() =>
    readJson(PROGRESSION_KEY, DEFAULT_PROGRESSION),
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    readJson(LOCAL_LEADERBOARD_KEY, []),
  );
  const [leaderboardFilter, setLeaderboardFilter] = useState<MapId | 'all'>('all');
  const [customMaps, setCustomMaps] = useState<CustomMapData[]>(() =>
    readJson(LOCAL_CUSTOM_MAPS_KEY, []),
  );

  // Active 3D Match State
  const [activeMap, setActiveMap] = useState<MapDefinition | null>(null);
  const [coopMode, setCoopMode] = useState<'solo' | 'host' | 'peer'>('solo');

  // WebSocket Multiplayer State
  const wsRef = useRef<WebSocket | null>(null);
  const localClientIdRef = useRef<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [localClientId, setLocalClientId] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [coopEvents, setCoopEvents] = useState<{
    remotePlayers: RemotePlayerState[];
    collectedIds: string[];
    puzzleSolvedBy: string | null;
    monstersSync: Array<{ id: string; x: number; z: number; yaw: number; state: string }> | null;
    pingLog: Array<{ senderName: string; text: string; ts: number }>;
  }>({
    remotePlayers: [],
    collectedIds: [],
    puzzleSolvedBy: null,
    monstersSync: null,
    pingLog: [],
  });

  // Boot Firestore connection check & Auth subscription
  useEffect(() => {
    testFirestoreConnection();
    const unsub = subscribeAuth(async (authUser) => {
      setUser(authUser);
      if (authUser) {
        try {
          const profile = await fetchOrCreateUserProfile(authUser, settings.playerName);
          setProgression(profile);
          localStorage.setItem(PROGRESSION_KEY, JSON.stringify(profile));
          if (profile.displayName) {
            setSettings((prev) => ({ ...prev, playerName: profile.displayName }));
          }
        } catch (err) {
          console.error('Failed to load profile:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Load Leaderboard
  const refreshLeaderboard = useCallback(async (filter: MapId | 'all') => {
    const localRows = readJson<LeaderboardEntry[]>(LOCAL_LEADERBOARD_KEY, []);
    try {
      const cloudRows = await fetchLeaderboardEntries(filter);
      if (cloudRows.length > 0) {
        setLeaderboard(cloudRows);
        return;
      }
    } catch {
      // Fallback to local rows if offline or index pending
    }
    const filtered =
      filter === 'all' ? localRows : localRows.filter((r) => r.mapId === filter);
    setLeaderboard(filtered.sort((a, b) => b.score - a.score));
  }, []);

  useEffect(() => {
    refreshLeaderboard(leaderboardFilter);
  }, [leaderboardFilter, refreshLeaderboard]);

  // Load Custom Maps
  const refreshCustomMaps = useCallback(async () => {
    const localMaps = readJson<CustomMapData[]>(LOCAL_CUSTOM_MAPS_KEY, []);
    try {
      const cloudMaps = await fetchCustomMapsFromCloud();
      const mapById = new Map<string, CustomMapData>();
      cloudMaps.forEach((m) => mapById.set(m.mapId, m));
      localMaps.forEach((m) => {
        if (!mapById.has(m.mapId)) mapById.set(m.mapId, m);
      });
      setCustomMaps(Array.from(mapById.values()));
    } catch {
      setCustomMaps(localMaps);
    }
  }, []);

  useEffect(() => {
    refreshCustomMaps();
  }, [refreshCustomMaps]);

  // Sync volume setting
  useEffect(() => {
    audioEngine.setVolume(settings.masterVolume);
  }, [settings.masterVolume]);

  // WebSocket Multiplayer Client with Auto-Reconnect
  useEffect(() => {
    let closedByUnmount = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setRoomError(null);
      };

      ws.onmessage = (evt) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        const type = String(msg.type || '');

        if (type === 'connected') {
          const cid = String(msg.clientId || '');
          localClientIdRef.current = cid;
          setLocalClientId(cid);
          setPublicRooms((msg.rooms as RoomSummary[]) || []);
        } else if (type === 'room:list') {
          setPublicRooms((msg.rooms as RoomSummary[]) || []);
        } else if (type === 'room:joined' || type === 'room:updated') {
          setActiveRoom(msg.room as ActiveRoom);
          setRoomError(null);
        } else if (type === 'room:left') {
          setActiveRoom(null);
          setPublicRooms((msg.rooms as RoomSummary[]) || []);
        } else if (type === 'room:error') {
          setRoomError(String(msg.message || 'Room error'));
        } else if (type === 'game:started') {
          const room = msg.room as ActiveRoom;
          setActiveRoom(room);
          const mapDef =
            CAMPAIGN_MAPS.find((m) => m.id === room.mapId) || CAMPAIGN_MAPS[0];
          setCoopEvents({
            remotePlayers: [],
            collectedIds: [],
            puzzleSolvedBy: null,
            monstersSync: null,
            pingLog: [],
          });
          setCoopMode(room.hostId === localClientIdRef.current ? 'host' : 'peer');
          setActiveMap(mapDef);
        } else if (type === 'player:state') {
          const p = msg as unknown as RemotePlayerState;
          setCoopEvents((prev) => {
            const others = prev.remotePlayers.filter((x) => x.id !== p.id);
            return { ...prev, remotePlayers: [...others, p] };
          });
        } else if (type === 'objective:collected') {
          setCoopEvents((prev) => ({
            ...prev,
            collectedIds: (msg.collectedIds as string[]) || prev.collectedIds,
          }));
        } else if (type === 'puzzle:solved') {
          setCoopEvents((prev) => ({
            ...prev,
            puzzleSolvedBy: String(msg.byName || 'Teammate'),
          }));
        } else if (type === 'monster:sync') {
          setCoopEvents((prev) => ({
            ...prev,
            monstersSync: msg.monsters as Array<{
              id: string;
              x: number;
              z: number;
              yaw: number;
              state: string;
            }>,
          }));
        } else if (type === 'chat:ping') {
          setCoopEvents((prev) => ({
            ...prev,
            pingLog: [
              ...prev.pingLog.slice(-10),
              {
                senderName: String(msg.senderName || 'Ally'),
                text: String(msg.text || ''),
                ts: Number(msg.ts) || Date.now(),
              },
            ],
          }));
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closedByUnmount) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      closedByUnmount = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const updateSettings = (next: GameSettings) => {
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const persistProgression = async (next: UserProgression) => {
    setProgression(next);
    localStorage.setItem(PROGRESSION_KEY, JSON.stringify(next));
    if (user) {
      try {
        await saveUserProgression(user, next);
      } catch (err) {
        console.error('Cloud progression sync failed:', err);
      }
    }
  };

  const handleBuyOrEquipItem = (itemId: string) => {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return;

    const owned = progression.unlockedItems.includes(itemId);
    if (!owned) {
      if (progression.candyCoins < item.price) return;
      const next: UserProgression = {
        ...progression,
        candyCoins: progression.candyCoins - item.price,
        unlockedItems: [...progression.unlockedItems, itemId],
        equippedItems: [...progression.equippedItems, itemId],
      };
      persistProgression(next);
      return;
    }

    const equipped = progression.equippedItems.includes(itemId);
    const nextEquipped = equipped
      ? progression.equippedItems.filter((id) => id !== itemId)
      : [...progression.equippedItems, itemId];
    persistProgression({ ...progression, equippedItems: nextEquipped });
  };

  const handleMatchFinish = async (result: GameResult) => {
    const completedSet = new Set(progression.completedMaps);
    if (result.victory && result.mapId !== 'custom') {
      completedSet.add(result.mapId);
    }

    const nextProg: UserProgression = {
      ...progression,
      displayName: settings.playerName || progression.displayName,
      points: progression.points + result.score,
      candyCoins: progression.candyCoins + result.coinsEarned,
      completedMaps: Array.from(completedSet),
    };
    await persistProgression(nextProg);

    if (result.victory) {
      const localEntry: LeaderboardEntry = {
        entryId: `local_${Date.now()}`,
        uid: user?.uid || 'local',
        playerName: settings.playerName || 'Survivor',
        mapId: result.mapId,
        score: result.score,
        timeSeconds: result.timeSeconds,
        giftsCollected: result.collectedCount,
        mode: result.mode,
      };
      const existing = readJson<LeaderboardEntry[]>(LOCAL_LEADERBOARD_KEY, []);
      localStorage.setItem(
        LOCAL_LEADERBOARD_KEY,
        JSON.stringify([localEntry, ...existing].slice(0, 50)),
      );

      if (user) {
        try {
          await submitLeaderboardEntry(user, {
            playerName: settings.playerName || user.displayName || 'Survivor',
            mapId: result.mapId,
            score: result.score,
            timeSeconds: result.timeSeconds,
            giftsCollected: result.collectedCount,
            mode: result.mode,
          });
        } catch (err) {
          console.error('Failed to submit leaderboard entry:', err);
        }
      }
      refreshLeaderboard(leaderboardFilter);
    }
  };

  const handleDeleteCustomMap = async (mapId: string) => {
    const localMaps = readJson<CustomMapData[]>(LOCAL_CUSTOM_MAPS_KEY, []);
    localStorage.setItem(
      LOCAL_CUSTOM_MAPS_KEY,
      JSON.stringify(localMaps.filter((m) => m.mapId !== mapId)),
    );
    if (user) {
      try {
        await deleteCustomMapFromCloud(mapId);
      } catch {
        // ignore if local-only
      }
    }
    refreshCustomMaps();
  };

  const equippedSkin =
    progression.equippedItems.find((id) => id.startsWith('skin_')) || 'default';

  return (
    <ErrorBoundary>
      {activeMap ? (
        <GameViewport
          mapDef={activeMap}
          settings={settings}
          equippedItems={progression.equippedItems}
          coopMode={coopMode}
          activeRoom={activeRoom}
          localClientId={localClientId}
          wsRef={wsRef}
          coopEvents={coopEvents}
          onExitToMenu={() => {
            setActiveMap(null);
            setCoopMode('solo');
          }}
          onMatchFinish={handleMatchFinish}
        />
      ) : (
        <MainMenu
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          onSignIn={() => signInWithGoogle().catch((e) => console.error(e))}
          onSignOut={() => signOutUser().catch((e) => console.error(e))}
          progression={progression}
          settings={settings}
          onUpdateSettings={updateSettings}
          onLaunchMap={(mapDef) => {
            setCoopMode('solo');
            setActiveMap(mapDef);
          }}
          onBuyOrEquipItem={handleBuyOrEquipItem}
          leaderboard={leaderboard}
          leaderboardFilter={leaderboardFilter}
          onChangeLeaderboardFilter={setLeaderboardFilter}
          customMaps={customMaps}
          onRefreshCustomMaps={refreshCustomMaps}
          onDeleteCustomMap={handleDeleteCustomMap}
          wsConnected={wsConnected}
          publicRooms={publicRooms}
          activeRoom={activeRoom}
          localClientId={localClientId}
          roomError={roomError}
          onCreateRoom={(mapId, mapTitle) =>
            wsRef.current?.send(
              JSON.stringify({
                type: 'room:create',
                name: settings.playerName,
                skinId: equippedSkin,
                mapId,
                mapTitle,
              }),
            )
          }
          onJoinRoom={(code) =>
            wsRef.current?.send(
              JSON.stringify({
                type: 'room:join',
                code,
                name: settings.playerName,
                skinId: equippedSkin,
              }),
            )
          }
          onLeaveRoom={() =>
            wsRef.current?.send(JSON.stringify({ type: 'room:leave' }))
          }
          onToggleReady={(ready) =>
            wsRef.current?.send(JSON.stringify({ type: 'room:ready', ready }))
          }
          onChangeRoomMap={(mapId, mapTitle) =>
            wsRef.current?.send(
              JSON.stringify({ type: 'room:map', mapId, mapTitle }),
            )
          }
          onStartCoopMatch={() =>
            wsRef.current?.send(JSON.stringify({ type: 'game:start' }))
          }
          onRefreshRooms={() =>
            wsRef.current?.send(JSON.stringify({ type: 'room:list' }))
          }
        />
      )}
    </ErrorBoundary>
  );
}
