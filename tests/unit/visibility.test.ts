import { describe, expect, it } from 'vitest';
import type { PlayerSeat, Role, Room, SeatIndex } from '../../src/shared/types.js';
import { performSeerAction, setPhase } from '../../src/server/game/engine.js';
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
