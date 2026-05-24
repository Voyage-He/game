import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { RoomStore } from '../../src/server/room-store.js';

describe('HTTP room API contracts', () => {
  it('creates and joins a room with reconnect tokens', async () => {
    const store = new RoomStore();
    const app = createApp({ roomStore: store });

    const create = await request(app).post('/api/rooms').send({ nickname: '阿明' }).expect(201);
    expect(create.body.roomCode).toMatch(/^[A-Z0-9]{6,}$/);
    expect(create.body.seatIndex).toBe(0);
    expect(create.body.reconnectToken).toBeTruthy();

    const join = await request(app).post(`/api/rooms/${create.body.roomCode}/join`).send({ nickname: '小红' }).expect(201);
    expect(join.body.seatIndex).toBe(1);
    expect(join.body.reconnectToken).toBeTruthy();
  });

  it('rejects invalid joins, duplicate nicknames, full rooms, and started rooms', async () => {
    const store = new RoomStore();
    const app = createApp({ roomStore: store });

    await request(app).post('/api/rooms/NOPE99/join').send({ nickname: '小红' }).expect(404);
    const create = await request(app).post('/api/rooms').send({ nickname: '阿明' }).expect(201);
    const roomCode = create.body.roomCode as string;
    await request(app).post(`/api/rooms/${roomCode}/join`).send({ nickname: '阿明' }).expect(409);
    await request(app).post(`/api/rooms/${roomCode}/join`).send({ nickname: '小红' }).expect(201);
    await request(app).post(`/api/rooms/${roomCode}/join`).send({ nickname: '小李' }).expect(201);
    await request(app).post(`/api/rooms/${roomCode}/join`).send({ nickname: '小王' }).expect(409);

    const room = store.requireRoom(roomCode);
    room.status = 'in_game';
    store.replaceRoom(room);
    await request(app).post(`/api/rooms/${roomCode}/join`).send({ nickname: '新人' }).expect(409);
  });

  it('reconnects with a valid token and rejects invalid tokens', async () => {
    const store = new RoomStore();
    const app = createApp({ roomStore: store });
    const create = await request(app).post('/api/rooms').send({ nickname: '阿明' }).expect(201);
    const roomCode = create.body.roomCode as string;

    await request(app).post(`/api/rooms/${roomCode}/reconnect`).send({ reconnectToken: 'wrong-token-value-that-is-long-enough' }).expect(409);
    const reconnect = await request(app).post(`/api/rooms/${roomCode}/reconnect`).send({ reconnectToken: create.body.reconnectToken }).expect(200);
    expect(reconnect.body.seatIndex).toBe(0);
  });

  it('returns stable Chinese error responses for validation failures', async () => {
    const app = createApp({ roomStore: new RoomStore() });
    const response = await request(app).post('/api/rooms').send({ nickname: '' }).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBeTruthy();
  });
});
