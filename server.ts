import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomPlayer {
  id: string;
  name: string;
  skinId: string;
  ready: boolean;
  isHost: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flashlightOn: boolean;
  sprinting: boolean;
  hiding: boolean;
  hp: number;
  escaped: boolean;
  ws: WebSocket;
}

interface RoomState {
  code: string;
  hostId: string;
  mapId: string;
  mapTitle: string;
  started: boolean;
  collectedIds: Set<string>;
  puzzleSolved: boolean;
  players: Map<string, RoomPlayer>;
  createdAt: number;
}

const rooms = new Map<string, RoomState>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function serializeRoom(room: RoomState) {
  return {
    code: room.code,
    hostId: room.hostId,
    mapId: room.mapId,
    mapTitle: room.mapTitle,
    started: room.started,
    collectedIds: Array.from(room.collectedIds),
    puzzleSolved: room.puzzleSolved,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      skinId: p.skinId,
      ready: p.ready,
      isHost: p.isHost,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      pitch: p.pitch,
      flashlightOn: p.flashlightOn,
      sprinting: p.sprinting,
      hiding: p.hiding,
      hp: p.hp,
      escaped: p.escaped,
    })),
  };
}

function broadcastRoom(room: RoomState, payload: unknown, excludeId?: string) {
  const data = JSON.stringify(payload);
  for (const player of room.players.values()) {
    if (excludeId && player.id === excludeId) continue;
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

function getPublicRooms() {
  return Array.from(rooms.values())
    .filter((r) => !r.started && r.players.size < 4)
    .map((r) => ({
      code: r.code,
      mapId: r.mapId,
      mapTitle: r.mapTitle,
      playerCount: r.players.size,
      hostName: r.players.get(r.hostId)?.name || 'Survivor',
    }));
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: getPublicRooms() });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = `p_${Math.random().toString(36).slice(2, 10)}`;
    let currentRoomCode: string | null = null;

    const send = (msg: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    send({ type: 'connected', clientId, rooms: getPublicRooms() });

    const leaveCurrentRoom = () => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room) {
        currentRoomCode = null;
        return;
      }
      room.players.delete(clientId);
      if (room.players.size === 0) {
        rooms.delete(currentRoomCode);
      } else {
        if (room.hostId === clientId) {
          const nextHost = room.players.values().next().value;
          if (nextHost) {
            nextHost.isHost = true;
            room.hostId = nextHost.id;
          }
        }
        broadcastRoom(room, { type: 'room:updated', room: serializeRoom(room) });
      }
      currentRoomCode = null;
    };

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'room:list') {
        send({ type: 'room:list', rooms: getPublicRooms() });
        return;
      }

      if (type === 'room:create') {
        leaveCurrentRoom();
        const code = generateRoomCode();
        const name = String(msg.name || 'Survivor').slice(0, 24);
        const skinId = String(msg.skinId || 'default');
        const mapId = String(msg.mapId || 'village');
        const mapTitle = String(msg.mapTitle || 'Christmas Village');

        const player: RoomPlayer = {
          id: clientId,
          name,
          skinId,
          ready: true,
          isHost: true,
          x: 0,
          y: 1.7,
          z: 0,
          yaw: 0,
          pitch: 0,
          flashlightOn: true,
          sprinting: false,
          hiding: false,
          hp: 3,
          escaped: false,
          ws,
        };

        const room: RoomState = {
          code,
          hostId: clientId,
          mapId,
          mapTitle,
          started: false,
          collectedIds: new Set<string>(),
          puzzleSolved: false,
          players: new Map([[clientId, player]]),
          createdAt: Date.now(),
        };

        rooms.set(code, room);
        currentRoomCode = code;
        send({ type: 'room:joined', room: serializeRoom(room), clientId });
        return;
      }

      if (type === 'room:join') {
        const code = String(msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) {
          send({ type: 'room:error', message: `Room ${code} not found.` });
          return;
        }
        if (room.players.size >= 4) {
          send({ type: 'room:error', message: `Room ${code} is full (4/4 survivors).` });
          return;
        }
        if (room.started) {
          send({ type: 'room:error', message: `Match in room ${code} has already begun.` });
          return;
        }
        leaveCurrentRoom();
        const name = String(msg.name || 'Survivor').slice(0, 24);
        const skinId = String(msg.skinId || 'default');
        const player: RoomPlayer = {
          id: clientId,
          name,
          skinId,
          ready: false,
          isHost: false,
          x: 0,
          y: 1.7,
          z: 0,
          yaw: 0,
          pitch: 0,
          flashlightOn: true,
          sprinting: false,
          hiding: false,
          hp: 3,
          escaped: false,
          ws,
        };
        room.players.set(clientId, player);
        currentRoomCode = code;
        send({ type: 'room:joined', room: serializeRoom(room), clientId });
        broadcastRoom(room, { type: 'room:updated', room: serializeRoom(room) }, clientId);
        return;
      }

      if (type === 'room:leave') {
        leaveCurrentRoom();
        send({ type: 'room:left', rooms: getPublicRooms() });
        return;
      }

      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;
      const player = room.players.get(clientId);
      if (!player) return;

      if (type === 'room:ready') {
        player.ready = Boolean(msg.ready);
        broadcastRoom(room, { type: 'room:updated', room: serializeRoom(room) });
        return;
      }

      if (type === 'room:map' && room.hostId === clientId && !room.started) {
        room.mapId = String(msg.mapId || room.mapId);
        room.mapTitle = String(msg.mapTitle || room.mapTitle);
        broadcastRoom(room, { type: 'room:updated', room: serializeRoom(room) });
        return;
      }

      if (type === 'game:start' && room.hostId === clientId) {
        room.started = true;
        room.collectedIds.clear();
        room.puzzleSolved = false;
        for (const p of room.players.values()) {
          p.hp = 3;
          p.escaped = false;
          p.hiding = false;
        }
        broadcastRoom(room, { type: 'game:started', room: serializeRoom(room) });
        return;
      }

      if (type === 'player:state') {
        player.x = Number(msg.x) || 0;
        player.y = Number(msg.y) || 1.7;
        player.z = Number(msg.z) || 0;
        player.yaw = Number(msg.yaw) || 0;
        player.pitch = Number(msg.pitch) || 0;
        player.flashlightOn = Boolean(msg.flashlightOn);
        player.sprinting = Boolean(msg.sprinting);
        player.hiding = Boolean(msg.hiding);
        player.hp = Math.max(0, Math.min(5, Number(msg.hp) || 0));
        player.escaped = Boolean(msg.escaped);

        broadcastRoom(
          room,
          {
            type: 'player:state',
            id: clientId,
            x: player.x,
            y: player.y,
            z: player.z,
            yaw: player.yaw,
            pitch: player.pitch,
            flashlightOn: player.flashlightOn,
            sprinting: player.sprinting,
            hiding: player.hiding,
            hp: player.hp,
            escaped: player.escaped,
          },
          clientId,
        );
        return;
      }

      if (type === 'objective:collect') {
        const itemId = String(msg.itemId || '');
        if (!itemId || room.collectedIds.has(itemId)) return;
        room.collectedIds.add(itemId);
        broadcastRoom(room, {
          type: 'objective:collected',
          itemId,
          byName: player.name,
          collectedIds: Array.from(room.collectedIds),
        });
        return;
      }

      if (type === 'puzzle:solve') {
        if (room.puzzleSolved) return;
        room.puzzleSolved = true;
        broadcastRoom(room, {
          type: 'puzzle:solved',
          byName: player.name,
        });
        return;
      }

      if (type === 'monster:sync' && room.hostId === clientId) {
        broadcastRoom(
          room,
          {
            type: 'monster:sync',
            monsters: msg.monsters,
          },
          clientId,
        );
        return;
      }

      if (type === 'chat:ping') {
        const text = String(msg.text || '').slice(0, 80);
        if (!text) return;
        broadcastRoom(room, {
          type: 'chat:ping',
          senderId: clientId,
          senderName: player.name,
          text,
          ts: Date.now(),
        });
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom();
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Hollow Eve server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
