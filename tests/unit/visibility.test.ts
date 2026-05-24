import { describe, expect, it } from 'vitest';
import type { PlayerSeat, Role, Room, SeatIndex } from '../../src/shared/types.js';
import { performRobberAction, performSeerAction, performWolfAction, setPhase } from '../../src/server/game/engine.js';
import { assertNoHiddenCardsInPublicView, projectPrivateRoomView, projectPublicRoomView, projectSettlementView } from '../../src/server/game/visibility.js';

function makeRoom(playerRoles: Role[] = ['预言家', '狼人', '平民'], underwaterRoles: Role[] = ['强盗', '捣蛋鬼', '水鬼']): Room {
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
  return {
    roomCode: 'ABC123',
    ownerSeatId: 'seat_0',
    status: 'in_game',
    seats,
    deck: [
      ...playerRoles.map((role, index) => ({ cardId: `card_${index}`, role, initialLocation: `playerSeat:seat_${index}` as const, currentLocation: `playerSeat:seat_${index}` as const, visibleToSeatIds: [`seat_${index}`] })),
      ...underwaterRoles.map((role, index) => ({ cardId: `card_${index + 3}`, role, initialLocation: `underwater:${index}` as const, currentLocation: `underwater:${index}` as const, visibleToSeatIds: [] }))
    ],
    underwaterCardIds: ['card_3', 'card_4', 'card_5'],
    actions: [],
    votes: {},
    createdAt: now,
    updatedAt: now,
    version: 1
  };
}

const options = { now: new Date('2026-05-21T12:00:00.000Z'), phaseDurationsMs: { close_eyes: 0, wolf_action: 0, seer_action: 0, robber_action: 0, troublemaker_action: 0, water_ghost_action: 0, open_eyes: 0, voting: 1000 }, votingTimeoutMs: 1000 };

describe('public/private visibility projection', () => {
  it('adds a fresh serverNow timestamp and exposes authoritative timed phase timestamps', () => {
    const room = setPhase(makeRoom(), 'wolf_action', { ...options, now: new Date('2026-05-21T12:00:00.000Z'), phaseDurationsMs: { ...options.phaseDurationsMs, wolf_action: 10_000 } });
    const publicView = projectPublicRoomView(room);
    expect((publicView as any).serverNow).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(publicView.phaseStartedAt).toBe('2026-05-21T12:00:00.000Z');
    expect(publicView.phaseEndsAt).toBe('2026-05-21T12:00:10.000Z');
  });

  it('omits phaseEndsAt for untimed free speech while still sending serverNow', () => {
    const room = setPhase(makeRoom(), 'free_speech', options);
    const publicView = projectPublicRoomView(room);
    expect(publicView.phase).toBe('free_speech');
    expect(publicView.phaseEndsAt).toBeUndefined();
    expect((publicView as any).serverNow).toBeTruthy();
  });

  it('redacts role identities and hidden card contents from public state before settlement', () => {
    const room = setPhase(makeRoom(), 'seer_action', options);
    const publicView = projectPublicRoomView(room);
    expect(assertNoHiddenCardsInPublicView(publicView)).toBe(true);
    expect(JSON.stringify(publicView)).not.toContain('强盗');
  });

  it('shows private action options only to the eligible initial-role player', () => {
    const room = setPhase(makeRoom(), 'seer_action', options);
    const seerView = projectPrivateRoomView(room, 'seat_0');
    const wolfView = projectPrivateRoomView(room, 'seat_1');
    expect(seerView.currentEligibleAction?.phase).toBe('seer_action');
    expect(wolfView.currentEligibleAction).toBeNull();
  });

  it('keeps authorized reveals private to the acting seat until settlement', () => {
    let room = setPhase(makeRoom(), 'seer_action', options);
    room = performSeerAction(room, 0, { mode: 'view_two_underwater', underwaterIndexes: [0, 1] }, options).room;
    const seerView = projectPrivateRoomView(room, 'seat_0');
    const otherView = projectPrivateRoomView(room, 'seat_1');
    expect(seerView.revealedCards.some((card) => card.role === '强盗')).toBe(true);
    expect(otherView.revealedCards.some((card) => card.role === '强盗')).toBe(false);
    expect(projectSettlementView(room)).toBeNull();
  });
});

describe('phase-aware revealed card filtering', () => {
  it('seer views two underwater cards → revealedCards contains both roles during seer_action phase', () => {
    let room = setPhase(makeRoom(), 'seer_action', options);
    room = performSeerAction(room, 0, { mode: 'view_two_underwater', underwaterIndexes: [0, 1] }, options).room;
    const view = projectPrivateRoomView(room, 'seat_0');
    // Own initial card + 2 underwater reveals = 3 total
    const actionReveals = view.revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(actionReveals).toHaveLength(2);
    const roles = actionReveals.map((card) => card.role);
    expect(roles).toContain('强盗');
    expect(roles).toContain('捣蛋鬼');
    const locations = actionReveals.map((card) => card.location);
    expect(locations).toContain('underwater:0');
    expect(locations).toContain('underwater:1');
  });

  it('seer views one player → revealedCards contains that player role', () => {
    let room = setPhase(makeRoom(), 'seer_action', options);
    room = performSeerAction(room, 0, { mode: 'view_one_player', targetSeatIndex: 1 }, options).room;
    const view = projectPrivateRoomView(room, 'seat_0');
    // Own initial card + 1 player reveal = 2 total
    const actionReveals = view.revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(actionReveals).toHaveLength(1);
    expect(actionReveals[0].role).toBe('狼人');
    expect(actionReveals[0].location).toBe('playerSeat:1');
  });

  it('phase advances → revealedCards becomes empty (own initial card persists)', () => {
    let room = setPhase(makeRoom(), 'seer_action', options);
    room = performSeerAction(room, 0, { mode: 'view_two_underwater', underwaterIndexes: [0, 1] }, options).room;
    const actionRevealsBefore = projectPrivateRoomView(room, 'seat_0').revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(actionRevealsBefore).not.toHaveLength(0);
    room = setPhase(room, 'robber_action', options);
    const viewAfter = projectPrivateRoomView(room, 'seat_0');
    // Action reveals should be cleared, but own initial card always remains
    const actionRevealsAfter = viewAfter.revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(actionRevealsAfter).toHaveLength(0);
  });

  it('non-acting player has empty revealedCards during seer phase', () => {
    let room = setPhase(makeRoom(), 'seer_action', options);
    room = performSeerAction(room, 0, { mode: 'view_two_underwater', underwaterIndexes: [0, 1] }, options).room;
    const nonActingView = projectPrivateRoomView(room, 'seat_1');
    // Non-acting player should see no seer reveals (only their own initial card)
    const seerReveals = nonActingView.revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(seerReveals).toHaveLength(0);
  });
});

describe('wolf reveal visibility', () => {
  it('wolf views one underwater card → revealedCards contains that role only', () => {
    let room = setPhase(makeRoom(), 'wolf_action', options);
    room = performWolfAction(room, 1, 0, options).room;
    const view = projectPrivateRoomView(room, 'seat_1');
    const actionReveals = view.revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(actionReveals).toHaveLength(1);
    expect(actionReveals[0].location).toBe('underwater:0');
    expect(actionReveals[0].role).toBe('强盗');
  });

  it('phase advances → wolf reveals cleared', () => {
    let room = setPhase(makeRoom(), 'wolf_action', options);
    room = performWolfAction(room, 1, 0, options).room;
    room = setPhase(room, 'seer_action', options);
    const viewAfter = projectPrivateRoomView(room, 'seat_1');
    const actionReveals = viewAfter.revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(actionReveals).toHaveLength(0);
  });

  it('non-acting player has empty revealedCards during wolf phase', () => {
    let room = setPhase(makeRoom(), 'wolf_action', options);
    room = performWolfAction(room, 1, 0, options).room;
    const nonActingView = projectPrivateRoomView(room, 'seat_0');
    const wolfReveals = nonActingView.revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(wolfReveals).toHaveLength(0);
  });
});

describe('robber reveal visibility', () => {
  it('robber views target player → revealedCards contains that player role', () => {
    let room = setPhase(makeRoom(), 'robber_action', options);
    // Seat 2 is 强盗 (role assignment: seat0=预言家, seat1=狼人, seat2=平民)
    // Actually makeRoom default: [预言家, 狼人, 平民] → seat2=平民, no 强盗 in default
    // Use custom roles for robber test
    room = setPhase(makeRoom(['强盗', '狼人', '平民']), 'robber_action', options);
    room = performRobberAction(room, 0, 1, options).room;
    const view = projectPrivateRoomView(room, 'seat_0');
    const actionReveals = view.revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(actionReveals).toHaveLength(1);
    expect(actionReveals[0].location).toBe('playerSeat:1');
    expect(actionReveals[0].role).toBe('狼人');
  });

  it('robber swap: initialRole remains 强盗 but currentCardId changes', () => {
    const room = setPhase(makeRoom(['强盗', '狼人', '平民']), 'robber_action', options);
    const afterSwap = performRobberAction(room, 0, 1, options).room;
    const view = projectPrivateRoomView(afterSwap, 'seat_0');
    // Robber's initialRole remains 强盗
    expect(view.initialRole).toBe('强盗');
    // Robber sees their own initial card (always)
    const ownInitial = view.revealedCards.find((card) => card.location === 'playerSeat:0:initial');
    expect(ownInitial?.role).toBe('强盗');
  });

  it('phase advances → robber reveals cleared', () => {
    let room = setPhase(makeRoom(['强盗', '狼人', '平民']), 'robber_action', options);
    room = performRobberAction(room, 0, 1, options).room;
    room = setPhase(room, 'troublemaker_action', options);
    const viewAfter = projectPrivateRoomView(room, 'seat_0');
    const actionReveals = viewAfter.revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(actionReveals).toHaveLength(0);
  });

  it('non-acting player has no reveals during robber phase', () => {
    let room = setPhase(makeRoom(['强盗', '狼人', '平民']), 'robber_action', options);
    room = performRobberAction(room, 0, 1, options).room;
    const nonActingView = projectPrivateRoomView(room, 'seat_2');
    const robberReveals = nonActingView.revealedCards.filter((card) => !card.location.includes(':initial'));
    expect(robberReveals).toHaveLength(0);
  });
});
