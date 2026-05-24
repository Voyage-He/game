import { describe, expect, it } from 'vitest';
import { ROLES, type PlayerSeat, type Role, type Room, type SeatIndex } from '../../src/shared/types.js';
import { GameError } from '../../src/shared/errors.js';
import {
  advanceFreeSpeechToVoting,
  advanceTimedPhase,
  castVote,
  getCardAtUnderwater,
  getCurrentCardForSeat,
  getSeatByIndex,
  initializeGame,
  performRobberAction,
  performSeerAction,
  performTroublemakerAction,
  performWaterGhostAction,
  performWolfAction,
  setPhase
} from '../../src/server/game/engine.js';
import { makeWaitingThreePlayerRoom } from '../helpers/room-fixtures.js';

function makeRoom(playerRoles: Role[] = ['狼人', '预言家', '强盗'], underwaterRoles: Role[] = ['捣蛋鬼', '水鬼', '平民']): Room {
  const now = new Date('2026-05-21T12:00:00.000Z').toISOString();
  const seats: PlayerSeat[] = [0, 1, 2].map((index) => ({
    seatId: `seat_${index}`,
    seatIndex: index as SeatIndex,
    nickname: `玩家${index + 1}`,
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
    version: 1
  };
}

const instantOptions = { now: new Date('2026-05-21T12:00:00.000Z'), phaseDurationsMs: { close_eyes: 0, wolf_action: 0, seer_action: 0, robber_action: 0, troublemaker_action: 0, water_ghost_action: 0, open_eyes: 0, voting: 1000 }, votingTimeoutMs: 1000 };

describe('game engine phase, deal, voting, and settlement', () => {
  it('initializes exactly six cards, three player cards, three underwater cards, and ordered phases', () => {
    const waiting = makeRoom();
    waiting.status = 'waiting';
    waiting.deck = [];
    waiting.underwaterCardIds = [];
    const started = initializeGame(waiting, { ...instantOptions, seed: 'deal-test' });
    expect(started.deck).toHaveLength(6);
    expect(started.seats.every((seat) => seat?.initialCardId && seat.currentCardId)).toBe(true);
    expect(started.underwaterCardIds).toHaveLength(3);

    let room = started;
    const phases = [room.phase];
    for (let i = 0; i < 7; i += 1) {
      room = advanceTimedPhase(room, instantOptions);
      phases.push(room.phase);
    }
    expect(phases).toEqual(['close_eyes', 'wolf_action', 'seer_action', 'robber_action', 'troublemaker_action', 'water_ghost_action', 'open_eyes', 'free_speech']);
  });

  it('settles tied votes as no elimination and good win when wolf is underwater', () => {
    let room = makeRoom(['预言家', '强盗', '平民'], ['狼人', '捣蛋鬼', '水鬼']);
    room = setPhase(room, 'voting', instantOptions);
    room = castVote(room, 0, 1, instantOptions);
    room = castVote(room, 1, 2, instantOptions);
    room = castVote(room, 2, 0, instantOptions);
    expect(room.settlement?.eliminatedSeatIndex).toBeNull();
    expect(room.settlement?.winningCamp).toBe('好人');
  });

  it('settles strict highest vote as elimination and good win when final wolf is eliminated', () => {
    let room = makeRoom(['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);
    room = setPhase(room, 'voting', instantOptions);
    room = castVote(room, 0, 1, instantOptions);
    room = castVote(room, 1, 0, instantOptions);
    room = castVote(room, 2, 0, instantOptions);
    expect(room.settlement?.eliminatedSeatIndex).toBe(0);
    expect(room.settlement?.winningCamp).toBe('好人');
  });

  it('runs 100 controlled rule settlements with deterministic final identities and winning camp', () => {
    const roleSets: Array<[Role[], Role[]]> = [
      [['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']],
      [['预言家', '强盗', '平民'], ['狼人', '捣蛋鬼', '水鬼']],
      [['捣蛋鬼', '水鬼', '平民'], ['狼人', '预言家', '强盗']],
      [['水鬼', '狼人', '平民'], ['预言家', '强盗', '捣蛋鬼']]
    ];
    for (let i = 0; i < 100; i += 1) {
      const [players, underwater] = roleSets[i % roleSets.length]!;
      let room = makeRoom(players, underwater);
      room = setPhase(room, 'voting', instantOptions);
      room = castVote(room, 0, 1, instantOptions);
      room = castVote(room, 1, 2, instantOptions);
      room = castVote(room, 2, 0, instantOptions);
      expect(room.settlement?.finalPlayerCards).toHaveLength(3);
      expect(room.settlement?.finalUnderwaterCards).toHaveLength(3);
      expect(['好人', '狼人']).toContain(room.settlement?.winningCamp);
    }
  });
});

describe('fresh identity allocation', () => {
  it('uses all six unique roles and does not fix a seat to one identity across 100 new games', () => {
    const rolesBySeat = [new Set<Role>(), new Set<Role>(), new Set<Role>()];

    for (let i = 0; i < 100; i += 1) {
      const started = initializeGame(makeWaitingThreePlayerRoom({ roomCode: 'FIXED1', version: 1 }), instantOptions);
      expect(new Set(started.deck.map((card) => card.role))).toEqual(new Set(ROLES));
      for (const seat of started.seats) {
        if (!seat?.initialCardId) continue;
        const role = started.deck.find((card) => card.cardId === seat.initialCardId)?.role;
        expect(role).toBeTruthy();
        rolesBySeat[seat.seatIndex]!.add(role!);
      }
    }

    expect(rolesBySeat.every((roles) => roles.size > 1)).toBe(true);
  });

  it('keeps explicit test seed allocation deterministic', () => {
    const first = initializeGame(makeWaitingThreePlayerRoom({ roomCode: 'FIXED1', version: 1 }), { ...instantOptions, seed: 'unit-seed' });
    const second = initializeGame(makeWaitingThreePlayerRoom({ roomCode: 'FIXED1', version: 1 }), { ...instantOptions, seed: 'unit-seed' });

    expect(first.deck.map((card) => `${card.initialLocation}:${card.role}`)).toEqual(second.deck.map((card) => `${card.initialLocation}:${card.role}`));
  });
});

describe('role actions and hidden-information mutations', () => {
  it('handles wolf, seer, robber, troublemaker, and water ghost actions', () => {
    let room = makeRoom(['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);
    room = setPhase(room, 'wolf_action', instantOptions);
    const wolf = performWolfAction(room, 0, 0, instantOptions);
    expect(wolf.result.revealedCards[0]?.role).toBe('捣蛋鬼');

    room = setPhase(wolf.room, 'seer_action', instantOptions);
    const seer = performSeerAction(room, 1, { mode: 'view_two_underwater', underwaterIndexes: [0, 1] }, instantOptions);
    expect(seer.result.revealedCards.map((card) => card.role)).toEqual(['捣蛋鬼', '水鬼']);

    room = setPhase(seer.room, 'robber_action', instantOptions);
    const robber = performRobberAction(room, 2, 0, instantOptions);
    expect(robber.result.exchangePerformed).toBe(true);
    expect(getCurrentCardForSeat(robber.room, getSeatByIndex(robber.room, 2)).role).toBe('狼人');

    room = makeRoom(['捣蛋鬼', '水鬼', '平民'], ['狼人', '预言家', '强盗']);
    room = setPhase(room, 'troublemaker_action', instantOptions);
    const troublemaker = performTroublemakerAction(room, 0, [1, 2], instantOptions);
    expect(getCurrentCardForSeat(troublemaker.room, getSeatByIndex(troublemaker.room, 1)).role).toBe('平民');

    room = setPhase(troublemaker.room, 'water_ghost_action', instantOptions);
    const waterGhost = performWaterGhostAction(room, 1, 0, instantOptions);
    expect(getCardAtUnderwater(waterGhost.room, 0).role).toBe('平民');
  });

  it('auto-completes mandatory actions on phase timeout', () => {
    let room = makeRoom(['捣蛋鬼', '水鬼', '平民'], ['狼人', '预言家', '强盗']);
    room = setPhase(room, 'troublemaker_action', instantOptions);
    room = advanceTimedPhase(room, instantOptions);
    expect(room.actions.find((action) => action.role === '捣蛋鬼')?.isAutomatic).toBe(true);

    room = setPhase(room, 'water_ghost_action', instantOptions);
    room = advanceTimedPhase(room, instantOptions);
    expect(room.actions.find((action) => action.role === '水鬼')?.isAutomatic).toBe(true);
  });
});

describe('invalid operations preserve valid state', () => {
  it('rejects wrong phase, ineligible actors, invalid targets, late actions, duplicate votes, and auto-votes disconnected seats', () => {
    let room = makeRoom(['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);
    expect(() => performWolfAction(setPhase(room, 'seer_action', instantOptions), 0, 0, instantOptions)).toThrow(GameError);
    expect(() => performSeerAction(setPhase(room, 'seer_action', instantOptions), 0, { mode: 'view_one_player', targetSeatIndex: 1 }, instantOptions)).toThrow(GameError);
    expect(() => performRobberAction(setPhase(room, 'robber_action', instantOptions), 2, 2, instantOptions)).toThrow(GameError);
    const lateRoom = setPhase(room, 'wolf_action', { ...instantOptions, now: new Date('2026-05-21T12:00:00.000Z'), phaseDurationsMs: { ...instantOptions.phaseDurationsMs, wolf_action: 1 } });
    expect(() => performWolfAction(lateRoom, 0, 0, { ...instantOptions, now: new Date('2026-05-21T12:00:01.000Z') })).toThrow(GameError);

    room = setPhase(room, 'voting', instantOptions);
    room = castVote(room, 0, 1, instantOptions);
    expect(() => castVote(room, 0, 2, instantOptions)).toThrow(GameError);
    room.seats[2]!.connectionStatus = 'disconnected';
    room = castVote(room, 1, 0, instantOptions);
    room = advanceTimedPhase(room, instantOptions);
    expect(room.settlement?.automaticVotes).toHaveLength(1);
  });

  it('owner can advance free speech to a fixed voting timeout', () => {
    let room = setPhase(makeRoom(), 'free_speech', instantOptions);
    room = advanceFreeSpeechToVoting(room, 0, { ...instantOptions, votingTimeoutMs: 60000 });
    expect(room.phase).toBe('voting');
    expect(new Date(room.phaseEndsAt!).getTime() - new Date(room.phaseStartedAt!).getTime()).toBe(60000);
  });
});
