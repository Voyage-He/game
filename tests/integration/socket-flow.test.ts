import { createServer, type Server as HttpServer } from 'node:http';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../../src/server/app.js';
import { RoomStore } from '../../src/server/room-store.js';
import { configureSocketServer, emitRoomState, type SocketServerHandle } from '../../src/server/realtime/socket-server.js';
import { setPhase } from '../../src/server/game/engine.js';
import type { PlayerSeat, PublicRoomView, Role, Room, SeatIndex, SettlementView } from '../../src/shared/types.js';

let store: RoomStore;
let httpServer: HttpServer;
let handle: SocketServerHandle;
let baseUrl: string;
let clients: ClientSocket[] = [];

beforeEach(async () => {
  store = new RoomStore();
  const app = createApp({ roomStore: store, staticDir: process.cwd() });
  httpServer = createServer(app);
  handle = configureSocketServer(httpServer, store, { phaseTimeScale: 1, votingTimeoutMs: 1000 });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const client of clients) client.disconnect();
  clients = [];
  handle.timers.clearAll();
  handle.io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe('Socket.IO room flow contracts', () => {
  it('broadcasts start, chat, vote progress, per-update latency, and settlement', async () => {
    const seats = await createThreeSeats();
    const sockets = await connectSeats(seats);
    const publicEvent = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.phase === 'close_eyes');
    sockets[0]!.emit('room:start', {});
    const started = await publicEvent;
    expect(started.players).toHaveLength(3);

    const chatEvent = waitForEvent(sockets[1]!, 'chat:message');
    sockets[0]!.emit('chat:send', { text: '我觉得狼人不在场。' });
    expect((await chatEvent).text).toContain('狼人');

    const room = setPhase(store.requireRoom(seats.roomCode), 'voting', handle.timers.engineOptions());
    handle.timers.replaceAndSchedule(room);
    const voting = await waitForEvent<PublicRoomView>(sockets[2]!, 'state:public', (view) => view.phase === 'voting');
    const receivedAt = Date.now();
    expect(receivedAt - new Date(voting.phaseStartedAt!).getTime()).toBeLessThan(2000);

    const settlementEvent = waitForEvent<SettlementView>(sockets[0]!, 'settlement:shown');
    sockets[0]!.emit('vote:cast', { targetSeatIndex: 1 });
    sockets[1]!.emit('vote:cast', { targetSeatIndex: 2 });
    sockets[2]!.emit('vote:cast', { targetSeatIndex: 0 });
    const settlement = await settlementEvent;
    expect(settlement.voteTotals.map((total) => total.votes)).toEqual([1, 1, 1]);
  });

  it('validates all role action contracts and emits private action results', async () => {
    const seats = await createThreeSeats();
    const sockets = await connectSeats(seats);
    forceRoles(seats.roomCode, ['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);

    store.replaceRoom(setPhase(store.requireRoom(seats.roomCode), 'wolf_action', handle.timers.engineOptions()));
    emitRoomState(handle.namespace, store, seats.roomCode);
    const wolfResult = waitForEvent(sockets[0]!, 'action:result');
    sockets[0]!.emit('action:wolf', { underwaterIndex: 0 });
    expect((await wolfResult).revealedCards[0].role).toBe('捣蛋鬼');

    store.replaceRoom(setPhase(store.requireRoom(seats.roomCode), 'seer_action', handle.timers.engineOptions()));
    const seerResult = waitForEvent(sockets[1]!, 'action:result');
    sockets[1]!.emit('action:seer', { mode: 'view_two_underwater', underwaterIndexes: [0, 1] });
    expect((await seerResult).revealedCards).toHaveLength(2);

    store.replaceRoom(setPhase(store.requireRoom(seats.roomCode), 'robber_action', handle.timers.engineOptions()));
    const robberResult = waitForEvent(sockets[2]!, 'action:result');
    sockets[2]!.emit('action:robber', { targetSeatIndex: 0 });
    expect((await robberResult).exchangePerformed).toBe(true);

    forceRoles(seats.roomCode, ['捣蛋鬼', '水鬼', '平民'], ['狼人', '预言家', '强盗']);
    store.replaceRoom(setPhase(store.requireRoom(seats.roomCode), 'troublemaker_action', handle.timers.engineOptions()));
    const troubleResult = waitForEvent(sockets[0]!, 'action:result');
    sockets[0]!.emit('action:troublemaker', { targetSeatIndexes: [1, 2] });
    expect((await troubleResult).exchangePerformed).toBe(true);

    store.replaceRoom(setPhase(store.requireRoom(seats.roomCode), 'water_ghost_action', handle.timers.engineOptions()));
    const waterResult = waitForEvent(sockets[1]!, 'action:result');
    sockets[1]!.emit('action:water-ghost', { underwaterIndex: 0 });
    expect((await waterResult).exchangePerformed).toBe(true);
  });

  it('validates at least 95% of visible room state updates within 2 seconds', async () => {
    const seats = await createThreeSeats();
    const sockets = await connectSeats(seats);
    const latencies: number[] = [];

    for (let i = 0; i < 20; i += 1) {
      const room = store.requireRoom(seats.roomCode);
      room.version += 1;
      store.replaceRoom(room);
      const expectedVersion = room.version;
      const start = Date.now();
      const update = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.version === expectedVersion);
      emitRoomState(handle.namespace, store, seats.roomCode);
      await update;
      latencies.push(Date.now() - start);
    }

    const withinTarget = latencies.filter((value) => value < 2000).length;
    expect(withinTarget / latencies.length).toBeGreaterThanOrEqual(0.95);
  });

  it('rejects socket auth failure and invalid operations without state mutation', async () => {
    const seats = await createThreeSeats();
    const sockets = await connectSeats(seats);
    const badSocket = createClient(`${baseUrl}/rooms`, { auth: { roomCode: seats.roomCode, reconnectToken: 'invalid-token-value-that-is-long-enough' }, transports: ['websocket'] });
    clients.push(badSocket);
    const connectError = await waitForEvent<Error>(badSocket, 'connect_error');
    expect(connectError.message).toContain('INVALID_RECONNECT_TOKEN');

    forceRoles(seats.roomCode, ['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);
    store.replaceRoom(setPhase(store.requireRoom(seats.roomCode), 'seer_action', handle.timers.engineOptions()));
    const errorEvent = waitForEvent(sockets[0]!, 'error');
    sockets[0]!.emit('action:seer', { mode: 'view_one_player', targetSeatIndex: 1 });
    expect((await errorEvent).code).toBe('INELIGIBLE_PLAYER');
    expect(store.requireRoom(seats.roomCode).actions).toHaveLength(0);
  });

  it('supports disconnect, reconnect, and room leave status broadcasts', async () => {
    const seats = await createThreeSeats();
    const sockets = await connectSeats(seats);
    sockets[1]!.disconnect();
    await waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.players.some((player) => player.seatIndex === 1 && player.connectionStatus === 'disconnected'));

    const reconnected = createClient(`${baseUrl}/rooms`, { auth: { roomCode: seats.roomCode, reconnectToken: seats.tokens[1] }, transports: ['websocket'] });
    clients.push(reconnected);
    await waitForEvent(reconnected, 'connect');
    await waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.players.some((player) => player.seatIndex === 1 && player.connectionStatus === 'connected'));

    reconnected.emit('room:leave', {});
    await waitForEvent(reconnected, 'disconnect');
  });
});

async function createThreeSeats(): Promise<{ roomCode: string; tokens: string[] }> {
  const create = await request(baseUrl).post('/api/rooms').send({ nickname: '阿明' }).expect(201);
  const roomCode = create.body.roomCode as string;
  const join1 = await request(baseUrl).post(`/api/rooms/${roomCode}/join`).send({ nickname: '小红' }).expect(201);
  const join2 = await request(baseUrl).post(`/api/rooms/${roomCode}/join`).send({ nickname: '小李' }).expect(201);
  return { roomCode, tokens: [create.body.reconnectToken, join1.body.reconnectToken, join2.body.reconnectToken] };
}

async function connectSeats(seats: { roomCode: string; tokens: string[] }): Promise<ClientSocket[]> {
  const sockets = seats.tokens.map((token) => createClient(`${baseUrl}/rooms`, { auth: { roomCode: seats.roomCode, reconnectToken: token }, transports: ['websocket'] }));
  clients.push(...sockets);
  await Promise.all(sockets.map((socket) => waitForEvent(socket, 'connect')));
  return sockets;
}

function forceRoles(roomCode: string, playerRoles: Role[], underwaterRoles: Role[]): void {
  const room = store.requireRoom(roomCode);
  const now = new Date().toISOString();
  const seats = room.seats as PlayerSeat[];
  room.status = 'in_game';
  room.actions = [];
  room.votes = {};
  delete room.settlement;
  room.deck = [
    ...playerRoles.map((role, index) => ({ cardId: `card_${index}`, role, initialLocation: `playerSeat:seat_${index}` as const, currentLocation: `playerSeat:seat_${index}` as const, visibleToSeatIds: [`seat_${index}`] })),
    ...underwaterRoles.map((role, index) => ({ cardId: `card_${index + 3}`, role, initialLocation: `underwater:${index}` as const, currentLocation: `underwater:${index}` as const, visibleToSeatIds: [] }))
  ];
  for (const seat of seats) {
    seat.initialCardId = `card_${seat.seatIndex}`;
    seat.currentCardId = `card_${seat.seatIndex}`;
    seat.connectionStatus = 'connected';
    seat.lastSeenAt = now;
  }
  room.underwaterCardIds = ['card_3', 'card_4', 'card_5'];
  store.replaceRoom(room);
}

function waitForEvent<T = any>(socket: ClientSocket, eventName: string, predicate: (payload: T) => boolean = () => true, timeoutMs = 5000): Promise<T> {
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
