import type { PlayerSeat, Role, Room, SeatIndex } from '../../src/shared/types.js';
import { setPhase, type EngineOptions } from '../../src/server/game/engine.js';

export const TEST_NOW = new Date('2026-05-21T12:00:00.000Z');

export const ZERO_PHASE_OPTIONS: EngineOptions = {
  now: TEST_NOW,
  phaseDurationsMs: {
    close_eyes: 0,
    wolf_action: 0,
    seer_action: 0,
    robber_action: 0,
    troublemaker_action: 0,
    water_ghost_action: 0,
    open_eyes: 0,
    voting: 1000
  },
  votingTimeoutMs: 1000
};

export const FAST_PHASE_OPTIONS: EngineOptions = {
  now: TEST_NOW,
  phaseDurationsMs: {
    close_eyes: 200,
    wolf_action: 300,
    seer_action: 300,
    robber_action: 300,
    troublemaker_action: 300,
    water_ghost_action: 300,
    open_eyes: 100,
    voting: 500
  },
  votingTimeoutMs: 500
};

export function makeThreePlayerRoom(
  playerRoles: Role[] = ['狼人', '预言家', '强盗'],
  underwaterRoles: Role[] = ['捣蛋鬼', '水鬼', '平民'],
  overrides: Partial<Room> = {}
): Room {
  const now = TEST_NOW.toISOString();
  const seats: PlayerSeat[] = [0, 1, 2].map((index) => ({
    seatId: `seat_${index}`,
    seatIndex: index as SeatIndex,
    nickname: ['阿明', '小红', '小李'][index]!,
    isOwner: index === 0,
    connectionStatus: 'connected',
    socketIds: [],
    reconnectTokenHash: `hash_${index}`,
    initialCardId: `card_${index}`,
    currentCardId: `card_${index}`,
    hasCompletedCurrentAction: false,
    voteSubmitted: false,
    joinedAt: now,
    lastSeenAt: now
  }));

  const deck = [
    ...playerRoles.map((role, index) => ({
      cardId: `card_${index}`,
      role,
      initialLocation: `playerSeat:seat_${index}` as const,
      currentLocation: `playerSeat:seat_${index}` as const,
      visibleToSeatIds: [`seat_${index}`]
    })),
    ...underwaterRoles.map((role, index) => ({
      cardId: `card_${index + 3}`,
      role,
      initialLocation: `underwater:${index}` as const,
      currentLocation: `underwater:${index}` as const,
      visibleToSeatIds: []
    }))
  ];

  return {
    roomCode: 'ABC123',
    ownerSeatId: 'seat_0',
    status: 'in_game',
    seats,
    deck,
    underwaterCardIds: ['card_3', 'card_4', 'card_5'],
    actions: [],
    votes: {},
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...overrides
  };
}

export function makeWaitingThreePlayerRoom(overrides: Partial<Room> = {}): Room {
  const room = makeThreePlayerRoom(undefined, undefined, { status: 'waiting', deck: [], underwaterCardIds: [], ...overrides });
  for (const seat of room.seats) {
    if (!seat) continue;
    delete seat.initialCardId;
    delete seat.currentCardId;
    seat.hasCompletedCurrentAction = false;
    seat.voteSubmitted = false;
  }
  return room;
}

export function withPhase(room: Room, phase: NonNullable<Room['phase']>, options: EngineOptions = ZERO_PHASE_OPTIONS): Room {
  return setPhase(room, phase, options);
}

export function roleMultiset(room: Room): Role[] {
  return room.deck.map((card) => card.role).sort();
}
