import type { Server as HttpServer } from 'node:http';
import { Server, type Namespace } from 'socket.io';
import { SocketAuthSchema } from '../../shared/contracts.js';
import { GameError } from '../../shared/errors.js';
import { projectPrivateRoomView, projectPublicRoomView, projectSettlementView } from '../game/visibility.js';
import { RoomTimerService, type RoomTimerOptions } from '../game/timers.js';
import { RoomStore } from '../room-store.js';
import { registerRoomEventHandlers } from './event-handlers.js';
import type { Room } from '../../shared/types.js';

export interface SocketServerOptions extends RoomTimerOptions {
  corsOrigin?: string;
}

export interface SocketServerHandle {
  io: Server;
  namespace: Namespace;
  timers: RoomTimerService;
}

export function configureSocketServer(httpServer: HttpServer, store: RoomStore, options: SocketServerOptions = {}): SocketServerHandle {
  const io = new Server(httpServer, {
    cors: {
      origin: options.corsOrigin ?? process.env.PUBLIC_ORIGIN ?? true,
      credentials: false
    }
  });
  const namespace = io.of('/rooms');

  const broadcastRoomState = (roomCode: string) => emitRoomState(namespace, store, roomCode);
  const broadcastSettlement = (room: Room) => emitSettlement(namespace, room);
  const timers = new RoomTimerService(store, {
    ...options,
    onRoomUpdated: (room) => {
      broadcastRoomState(room.roomCode);
      options.onRoomUpdated?.(room);
    },
    onSettlement: (room) => {
      broadcastSettlement(room);
      options.onSettlement?.(room);
      const cleanup = setTimeout(() => store.deleteRoom(room.roomCode), 250);
      if (typeof cleanup.unref === 'function') cleanup.unref();
    }
  });

  namespace.use((socket, next) => {
    try {
      const auth = SocketAuthSchema.parse(socket.handshake.auth);
      const { room, seat } = store.connectSocket(auth.roomCode, auth.reconnectToken, socket.id);
      socket.data.roomCode = room.roomCode;
      socket.data.seatId = seat.seatId;
      socket.data.seatIndex = seat.seatIndex;
      next();
    } catch (error) {
      const gameError = error instanceof GameError ? error : new GameError('INVALID_RECONNECT_TOKEN');
      next(new Error(JSON.stringify({ code: gameError.code, message: gameError.message })));
    }
  });

  namespace.on('connection', (socket) => {
    const roomCode = socket.data.roomCode as string;
    socket.join(roomCode);
    registerRoomEventHandlers(socket, { store, timers, broadcastRoomState, broadcastSettlement });
    broadcastRoomState(roomCode);

    socket.on('disconnect', () => {
      const room = store.disconnectSocket(roomCode, socket.id);
      if (room) broadcastRoomState(roomCode);
    });
  });

  return { io, namespace, timers };
}

export function emitRoomState(namespace: Namespace, store: RoomStore, roomCode: string): void {
  const room = store.getRoom(roomCode);
  if (!room) return;
  namespace.to(roomCode).emit('state:public', projectPublicRoomView(room));
  for (const seat of room.seats) {
    if (!seat) continue;
    const privateView = projectPrivateRoomView(room, seat.seatId);
    for (const socketId of seat.socketIds) {
      namespace.to(socketId).emit('state:private', privateView);
    }
  }
}

export function emitSettlement(namespace: Namespace, room: Room): void {
  const settlement = projectSettlementView(room);
  if (!settlement) return;
  namespace.to(room.roomCode).emit('settlement:shown', settlement);
}
