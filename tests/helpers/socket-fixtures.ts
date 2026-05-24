import { createServer, type Server as HttpServer } from 'node:http';
import request from 'supertest';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../../src/server/app.js';
import { setPhase } from '../../src/server/game/engine.js';
import { configureSocketServer, emitRoomState, type SocketServerHandle } from '../../src/server/realtime/socket-server.js';
import { RoomStore } from '../../src/server/room-store.js';
import type { Phase, PlayerSeat, Role, Room, SeatIndex } from '../../src/shared/types.js';

export interface SocketTestContext {
  store: RoomStore;
  httpServer: HttpServer;
  handle: SocketServerHandle;
  baseUrl: string;
  clients: ClientSocket[];
}

export async function createSocketTestContext(options: { phaseTimeScale?: number; votingTimeoutMs?: number; roomIdleTtlMs?: number } = {}): Promise<SocketTestContext> {
  const store = new RoomStore({ roomIdleTtlMs: options.roomIdleTtlMs });
  const app = createApp({ roomStore: store, staticDir: process.cwd() });
  const httpServer = createServer(app);
  const handle = configureSocketServer(httpServer, store, {
    phaseTimeScale: options.phaseTimeScale ?? 1,
    votingTimeoutMs: options.votingTimeoutMs ?? 1000
  });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  return { store, httpServer, handle, baseUrl: `http://127.0.0.1:${address.port}`, clients: [] };
}

export async function closeSocketTestContext(context: SocketTestContext): Promise<void> {
  for (const client of context.clients) client.disconnect();
  context.clients = [];
  context.handle.timers.clearAll();
  context.handle.io.close();
  await new Promise<void>((resolve) => context.httpServer.close(() => resolve()));
}

export async function createThreeSeats(context: SocketTestContext): Promise<{ roomCode: string; tokens: string[] }> {
  const create = await request(context.baseUrl).post('/api/rooms').send({ nickname: '阿明' }).expect(201);
  const roomCode = create.body.roomCode as string;
  const join1 = await request(context.baseUrl).post(`/api/rooms/${roomCode}/join`).send({ nickname: '小红' }).expect(201);
  const join2 = await request(context.baseUrl).post(`/api/rooms/${roomCode}/join`).send({ nickname: '小李' }).expect(201);
  return { roomCode, tokens: [create.body.reconnectToken, join1.body.reconnectToken, join2.body.reconnectToken] };
}

export async function connectSeats(context: SocketTestContext, seats: { roomCode: string; tokens: string[] }): Promise<ClientSocket[]> {
  const sockets = seats.tokens.map((token) => createClient(`${context.baseUrl}/rooms`, { auth: { roomCode: seats.roomCode, reconnectToken: token }, transports: ['websocket'] }));
  context.clients.push(...sockets);
  await Promise.all(sockets.map((socket) => waitForEvent(socket, 'connect')));
  return sockets;
}

export function connectSeat(context: SocketTestContext, roomCode: string, token: string): ClientSocket {
  const socket = createClient(`${context.baseUrl}/rooms`, { auth: { roomCode, reconnectToken: token }, transports: ['websocket'] });
  context.clients.push(socket);
  return socket;
}

export function forceRoles(context: SocketTestContext, roomCode: string, playerRoles: Role[], underwaterRoles: Role[]): Room {
  const room = context.store.requireRoom(roomCode);
  const now = new Date().toISOString();
  const seats = room.seats.filter((seat): seat is PlayerSeat => seat !== null).sort((a, b) => a.seatIndex - b.seatIndex);
  room.status = 'in_game';
  room.actions = [];
  room.votes = {};
  delete room.settlement;
  room.deck = [
    ...playerRoles.map((role, index) => ({
      cardId: `card_${index}`,
      role,
      initialLocation: `playerSeat:${seats[index]!.seatId}` as const,
      currentLocation: `playerSeat:${seats[index]!.seatId}` as const,
      visibleToSeatIds: [seats[index]!.seatId]
    })),
    ...underwaterRoles.map((role, index) => ({
      cardId: `card_${index + 3}`,
      role,
      initialLocation: `underwater:${index}` as const,
      currentLocation: `underwater:${index}` as const,
      visibleToSeatIds: []
    }))
  ];
  for (const seat of seats) {
    seat.initialCardId = `card_${seat.seatIndex}`;
    seat.currentCardId = `card_${seat.seatIndex}`;
    seat.connectionStatus = 'connected';
    seat.lastSeenAt = now;
  }
  room.underwaterCardIds = ['card_3', 'card_4', 'card_5'];
  context.store.replaceRoom(room);
  return room;
}

export function setRoomPhase(context: SocketTestContext, roomCode: string, phase: Phase): Room {
  const room = setPhase(context.store.requireRoom(roomCode), phase, context.handle.timers.engineOptions());
  context.store.replaceRoom(room);
  emitRoomState(context.handle.namespace, context.store, roomCode);
  return room;
}

export function waitForEvent<T = any>(socket: ClientSocket, eventName: string, predicate: (payload: T) => boolean = () => true, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);
    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timeout);
      socket.off(eventName, handler);
      resolve(payload);
    };
    socket.on(eventName, handler);
  });
}

export async function waitForEvents<T = any>(sockets: ClientSocket[], eventName: string, predicate: (payload: T) => boolean = () => true, timeoutMs = 5000): Promise<T[]> {
  return Promise.all(sockets.map((socket) => waitForEvent<T>(socket, eventName, predicate, timeoutMs)));
}

export function seatIndexOf(room: Room, seatId: string): SeatIndex {
  const seat = room.seats.find((candidate) => candidate?.seatId === seatId);
  if (!seat) throw new Error(`Missing seat ${seatId}`);
  return seat.seatIndex;
}
