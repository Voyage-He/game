import crypto from 'node:crypto';
import { GameError } from '../shared/errors.js';
import { RoomCodeSchema, NicknameSchema } from '../shared/contracts.js';
import type { CreateRoomResponse, JoinRoomResponse, PlayerSeat, ReconnectResponse, Room, SeatIndex } from '../shared/types.js';
import { occupiedSeats } from './game/engine.js';

export interface RoomStoreOptions {
  roomIdleTtlMs?: number;
}

export interface SeatLookup {
  room: Room;
  seat: PlayerSeat;
}

export class RoomStore {
  private rooms = new Map<string, Room>();
  private readonly roomIdleTtlMs: number;

  constructor(options: RoomStoreOptions = {}) {
    this.roomIdleTtlMs = options.roomIdleTtlMs ?? Number(process.env.ROOM_IDLE_TTL_MS ?? 1_800_000);
  }

  createRoom(nicknameInput: string): CreateRoomResponse {
    const nickname = normalizeNickname(nicknameInput);
    const roomCode = this.generateUniqueRoomCode();
    const reconnectToken = generateToken();
    const now = new Date().toISOString();
    const ownerSeat: PlayerSeat = {
      seatId: 'seat_0',
      seatIndex: 0,
      nickname,
      isOwner: true,
      connectionStatus: 'connected',
      socketIds: [],
      reconnectTokenHash: hashToken(reconnectToken),
      hasCompletedCurrentAction: false,
      voteSubmitted: false,
      joinedAt: now,
      lastSeenAt: now
    };
    const room: Room = {
      roomCode,
      ownerSeatId: ownerSeat.seatId,
      status: 'waiting',
      seats: [ownerSeat, null, null],
      deck: [],
      underwaterCardIds: [],
      actions: [],
      votes: {},
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    this.rooms.set(roomCode, room);
    return { roomCode, seatIndex: 0, isOwner: true, reconnectToken };
  }

  joinRoom(roomCodeInput: string, nicknameInput: string): JoinRoomResponse {
    const roomCode = normalizeRoomCode(roomCodeInput);
    const nickname = normalizeNickname(nicknameInput);
    const room = this.requireRoom(roomCode);
    if (room.status !== 'waiting') throw new GameError('ROOM_UNAVAILABLE');
    if (occupiedSeats(room).length >= 3) throw new GameError('ROOM_FULL');
    if (occupiedSeats(room).some((seat) => seat.nickname === nickname)) throw new GameError('DUPLICATE_NICKNAME');
    const seatIndex = firstEmptySeatIndex(room);
    const reconnectToken = generateToken();
    const now = new Date().toISOString();
    const seat: PlayerSeat = {
      seatId: `seat_${seatIndex}`,
      seatIndex,
      nickname,
      isOwner: false,
      connectionStatus: 'connected',
      socketIds: [],
      reconnectTokenHash: hashToken(reconnectToken),
      hasCompletedCurrentAction: false,
      voteSubmitted: false,
      joinedAt: now,
      lastSeenAt: now
    };
    room.seats[seatIndex] = seat;
    this.updateRoom(room);
    return { roomCode, seatIndex, isOwner: false, reconnectToken };
  }

  reconnectRoom(roomCodeInput: string, reconnectToken: string): ReconnectResponse {
    const roomCode = normalizeRoomCode(roomCodeInput);
    const room = this.requireRoom(roomCode);
    const seat = this.findSeatByToken(room, reconnectToken);
    if (!seat) throw new GameError('INVALID_RECONNECT_TOKEN');
    seat.connectionStatus = 'connected';
    seat.lastSeenAt = new Date().toISOString();
    this.updateRoom(room);
    return { roomCode, seatIndex: seat.seatIndex, isOwner: seat.isOwner };
  }

  connectSocket(roomCodeInput: string, reconnectToken: string, socketId: string): SeatLookup {
    const roomCode = normalizeRoomCode(roomCodeInput);
    const room = this.requireRoom(roomCode);
    const seat = this.findSeatByToken(room, reconnectToken);
    if (!seat) throw new GameError('INVALID_RECONNECT_TOKEN');
    if (!seat.socketIds.includes(socketId)) seat.socketIds.push(socketId);
    seat.connectionStatus = 'connected';
    seat.lastSeenAt = new Date().toISOString();
    this.updateRoom(room);
    return { room, seat };
  }

  disconnectSocket(roomCode: string, socketId: string): Room | undefined {
    const room = this.rooms.get(roomCode);
    if (!room) return undefined;
    const seat = occupiedSeats(room).find((candidate) => candidate.socketIds.includes(socketId));
    if (seat) {
      seat.socketIds = seat.socketIds.filter((id) => id !== socketId);
      if (seat.socketIds.length === 0) seat.connectionStatus = 'disconnected';
      seat.lastSeenAt = new Date().toISOString();
      this.updateRoom(room);
    }
    return room;
  }

  leaveSeat(roomCode: string, socketId: string): Room | undefined {
    const room = this.rooms.get(roomCode);
    if (!room) return undefined;
    const leavingSeatIndex = room.seats.findIndex((seat) => seat?.socketIds.includes(socketId));
    const next = this.disconnectSocket(roomCode, socketId);
    if (!next) return undefined;
    if (next.status === 'waiting' && leavingSeatIndex >= 0) {
      next.seats[leavingSeatIndex] = null;
      this.updateRoom(next);
    }
    if (occupiedSeats(next).every((seat) => seat.connectionStatus === 'disconnected')) {
      if (next.status !== 'in_game') this.deleteRoom(next.roomCode);
    }
    return next;
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  requireRoom(roomCode: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room || room.status === 'closed') throw new GameError('ROOM_NOT_FOUND');
    return room;
  }

  updateRoom(room: Room): Room {
    room.updatedAt = new Date().toISOString();
    room.version += 1;
    this.rooms.set(room.roomCode, room);
    return room;
  }

  replaceRoom(room: Room): Room {
    this.rooms.set(room.roomCode, room);
    return room;
  }

  deleteRoom(roomCode: string): void {
    this.rooms.delete(roomCode);
  }

  closeRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.status = 'closed';
    room.closedAt = new Date().toISOString();
    this.rooms.delete(roomCode);
  }

  listRooms(): Room[] {
    return [...this.rooms.values()];
  }

  cleanupExpiredRooms(now = Date.now()): number {
    let removed = 0;
    for (const room of this.rooms.values()) {
      const lastUpdated = new Date(room.updatedAt).getTime();
      const allDisconnected = occupiedSeats(room).length > 0 && occupiedSeats(room).every((seat) => seat.connectionStatus === 'disconnected');
      if ((allDisconnected || room.status === 'settled') && now - lastUpdated >= this.roomIdleTtlMs) {
        this.rooms.delete(room.roomCode);
        removed += 1;
      }
    }
    return removed;
  }

  private findSeatByToken(room: Room, reconnectToken: string): PlayerSeat | undefined {
    const tokenHash = hashToken(reconnectToken);
    return occupiedSeats(room).find((seat) => timingSafeEqual(seat.reconnectTokenHash, tokenHash));
  }

  private generateUniqueRoomCode(): string {
    for (let i = 0; i < 100; i += 1) {
      const code = crypto.randomBytes(4).toString('base64url').replace(/[^A-Z0-9]/giu, '').slice(0, 6).toUpperCase().padEnd(6, 'X');
      if (!this.rooms.has(code)) return code;
    }
    throw new GameError('ROOM_UNAVAILABLE', '房间码生成失败，请稍后重试。');
  }
}

export function normalizeNickname(input: string): string {
  const parsed = NicknameSchema.safeParse(input);
  if (!parsed.success) throw new GameError('INVALID_NICKNAME');
  return parsed.data.trim();
}

export function normalizeRoomCode(input: string): string {
  const parsed = RoomCodeSchema.safeParse(String(input).toUpperCase());
  if (!parsed.success) throw new GameError('ROOM_NOT_FOUND');
  return parsed.data;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function firstEmptySeatIndex(room: Room): SeatIndex {
  const index = room.seats.findIndex((seat) => seat === null);
  if (index < 0 || index > 2) throw new GameError('ROOM_FULL');
  return index as SeatIndex;
}
