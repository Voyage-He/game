import type { Socket } from 'socket.io';
import {
  ChatSendSchema,
  EmptyPayloadSchema,
  RobberActionSchema,
  SeerActionSchema,
  TroublemakerActionSchema,
  VoteCastSchema,
  WaterGhostActionSchema,
  WolfActionSchema
} from '../../shared/contracts.js';
import { ERROR_MESSAGES, GameError, type ErrorCode } from '../../shared/errors.js';
import type { ChatMessage, Room, SeatIndex } from '../../shared/types.js';
import {
  advanceFreeSpeechToVoting,
  castVote,
  performRobberAction,
  performSeerAction,
  performTroublemakerAction,
  performWaterGhostAction,
  performWolfAction
} from '../game/engine.js';
import type { RoomTimerService } from '../game/timers.js';
import type { RoomStore } from '../room-store.js';

export interface RealtimeHandlerContext {
  store: RoomStore;
  timers: RoomTimerService;
  broadcastRoomState: (roomCode: string) => void;
  broadcastSettlement: (room: Room) => void;
}

export function registerRoomEventHandlers(socket: Socket, context: RealtimeHandlerContext): void {
  socket.on('room:start', (payload) => {
    handleSocketEvent(socket, () => {
      EmptyPayloadSchema.parse(payload ?? {});
      const { room, seatIndex } = getSocketRoomSeat(socket, context.store);
      const seat = room.seats[seatIndex];
      if (!seat || seat.seatId !== room.ownerSeatId) throw new GameError('NOT_ROOM_OWNER');
      context.timers.startGame(room.roomCode);
    });
  });

  socket.on('phase:advance-to-vote', (payload) => {
    handleSocketEvent(socket, () => {
      EmptyPayloadSchema.parse(payload ?? {});
      const { room, seatIndex } = getSocketRoomSeat(socket, context.store);
      const next = advanceFreeSpeechToVoting(room, seatIndex, context.timers.engineOptions());
      context.timers.replaceAndSchedule(next);
    });
  });

  socket.on('action:wolf', (payload) => {
    handleSocketEvent(socket, () => {
      const body = WolfActionSchema.parse(payload);
      const { room, seatIndex } = getSocketRoomSeat(socket, context.store);
      const next = performWolfAction(room, seatIndex, body.underwaterIndex, context.timers.engineOptions());
      socket.emit('action:result', next.result);
      context.timers.replaceAndSchedule(next.room);
    });
  });

  socket.on('action:seer', (payload) => {
    handleSocketEvent(socket, () => {
      const body = SeerActionSchema.parse(payload);
      const { room, seatIndex } = getSocketRoomSeat(socket, context.store);
      const next = performSeerAction(room, seatIndex, body, context.timers.engineOptions());
      socket.emit('action:result', next.result);
      context.timers.replaceAndSchedule(next.room);
    });
  });

  socket.on('action:robber', (payload) => {
    handleSocketEvent(socket, () => {
      const body = RobberActionSchema.parse(payload);
      const { room, seatIndex } = getSocketRoomSeat(socket, context.store);
      const next = performRobberAction(room, seatIndex, body.targetSeatIndex, context.timers.engineOptions());
      socket.emit('action:result', next.result);
      context.timers.replaceAndSchedule(next.room);
    });
  });

  socket.on('action:troublemaker', (payload) => {
    handleSocketEvent(socket, () => {
      const body = TroublemakerActionSchema.parse(payload);
      const { room, seatIndex } = getSocketRoomSeat(socket, context.store);
      const next = performTroublemakerAction(room, seatIndex, body.targetSeatIndexes, context.timers.engineOptions());
      socket.emit('action:result', next.result);
      context.timers.replaceAndSchedule(next.room);
    });
  });

  socket.on('action:water-ghost', (payload) => {
    handleSocketEvent(socket, () => {
      const body = WaterGhostActionSchema.parse(payload);
      const { room, seatIndex } = getSocketRoomSeat(socket, context.store);
      const next = performWaterGhostAction(room, seatIndex, body.underwaterIndex, context.timers.engineOptions());
      socket.emit('action:result', next.result);
      context.timers.replaceAndSchedule(next.room);
    });
  });

  socket.on('vote:cast', (payload) => {
    handleSocketEvent(socket, () => {
      const body = VoteCastSchema.parse(payload);
      const { room, seatIndex } = getSocketRoomSeat(socket, context.store);
      const next = castVote(room, seatIndex, body.targetSeatIndex, context.timers.engineOptions());
      context.timers.replaceAndSchedule(next);
    });
  });

  socket.on('chat:send', (payload) => {
    handleSocketEvent(socket, () => {
      const body = ChatSendSchema.parse(payload);
      const { room, seatIndex } = getSocketRoomSeat(socket, context.store);
      const seat = room.seats[seatIndex];
      if (!seat) throw new GameError('INELIGIBLE_PLAYER');
      const message: ChatMessage = {
        messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        roomCode: room.roomCode,
        senderSeatId: seat.seatId,
        seatIndex,
        nickname: seat.nickname,
        text: body.text,
        sentAt: new Date().toISOString()
      };
      socket.nsp.to(room.roomCode).emit('chat:message', message);
    });
  });

  socket.on('room:leave', (payload) => {
    handleSocketEvent(socket, () => {
      EmptyPayloadSchema.parse(payload ?? {});
      const roomCode = socket.data.roomCode as string | undefined;
      if (roomCode) context.store.leaveSeat(roomCode, socket.id);
      context.broadcastRoomState(roomCode ?? '');
      socket.disconnect(true);
    });
  });
}

function getSocketRoomSeat(socket: Socket, store: RoomStore): { room: Room; seatIndex: SeatIndex } {
  const roomCode = socket.data.roomCode as string | undefined;
  const seatIndex = socket.data.seatIndex as SeatIndex | undefined;
  if (!roomCode || seatIndex === undefined) throw new GameError('INVALID_RECONNECT_TOKEN');
  const room = store.requireRoom(roomCode);
  return { room, seatIndex };
}

function handleSocketEvent(socket: Socket, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    emitSocketError(socket, normalizeError(error));
  }
}

function normalizeError(error: unknown): GameError {
  if (error instanceof GameError) return error;
  return new GameError('VALIDATION_ERROR');
}

function emitSocketError(socket: Socket, error: GameError): void {
  const code = error.code as ErrorCode;
  socket.emit('error', { code, message: error.message || ERROR_MESSAGES[code] });
}
