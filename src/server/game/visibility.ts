import {
  ROLE_BY_PHASE,
  type IdentityCard,
  type Phase,
  type PrivateRoomView,
  type PublicRoomView,
  type Role,
  type RolePhase,
  type Room,
  type SeatIndex,
  type SettlementView
} from '../../shared/types.js';
import { getCardById, getCurrentCardForSeat, getInitialRoleForSeat, getSeatById, occupiedSeats } from './engine.js';

const ACTION_OPTIONS: Record<RolePhase, string[]> = {
  wolf_action: ['view_one_underwater', 'skip'],
  seer_action: ['view_two_underwater', 'view_one_player', 'skip'],
  robber_action: ['view_one_player_and_exchange', 'skip'],
  troublemaker_action: ['exchange_two_other_players'],
  water_ghost_action: ['exchange_self_with_underwater']
};

export function projectPublicRoomView(room: Room): PublicRoomView {
  const phase = room.phase;
  const players = occupiedSeats(room)
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((seat) => ({
      seatIndex: seat.seatIndex,
      nickname: seat.nickname,
      isOwner: seat.isOwner,
      connectionStatus: seat.connectionStatus
    }));

  const view: PublicRoomView = {
    roomCode: room.roomCode,
    status: room.status,
    version: room.version,
    players,
    serverNow: new Date().toISOString()
  };

  if (phase) {
    view.phase = phase;
    view.phaseStartedAt = room.phaseStartedAt;
    if (phase !== 'free_speech' && phase !== 'settlement' && room.phaseEndsAt) {
      view.phaseEndsAt = room.phaseEndsAt;
    }
    view.phaseCompletion = { currentRoleCompleted: isCurrentRoleCompleted(room, phase) };
  }

  if (phase === 'voting' || phase === 'settlement') {
    view.voteCompletion = {
      submittedCount: Object.keys(room.votes).length,
      requiredCount: occupiedSeats(room).length
    };
  }

  return view;
}

export function projectPrivateRoomView(room: Room, seatId: string): PrivateRoomView {
  const seat = getSeatById(room, seatId);
  const initialRole = getInitialRoleForSeat(room, seat);
  const eligiblePhase = room.phase && ROLE_BY_PHASE[room.phase] === initialRole ? (room.phase as RolePhase) : null;
  const submittedVote = room.votes[seatId]
    ? {
        targetSeatIndex: getSeatById(room, room.votes[seatId].targetSeatId).seatIndex,
        isAutomatic: room.votes[seatId].isAutomatic
      }
    : null;

  return {
    seatIndex: seat.seatIndex,
    initialRole,
    currentEligibleAction: eligiblePhase ? { phase: eligiblePhase, options: ACTION_OPTIONS[eligiblePhase] } : null,
    revealedCards: buildRevealedCards(room, seatId),
    submittedVote
  };
}

export function projectSettlementView(room: Room): SettlementView | null {
  if (!room.settlement) return null;
  return {
    voteTotals: room.settlement.voteTotals.map((total) => ({ seatIndex: total.seatIndex, votes: total.votes })),
    eliminatedSeatIndex: room.settlement.eliminatedSeatIndex,
    winningCamp: room.settlement.winningCamp,
    finalPlayerCards: room.settlement.finalPlayerCards.map((entry) => ({
      seatIndex: entry.seatIndex,
      nickname: entry.nickname,
      role: entry.role
    })),
    finalUnderwaterCards: room.settlement.finalUnderwaterCards,
    automaticActions: room.settlement.roleActionsSummary
      .filter((action) => action.isAutomatic)
      .map((action) => ({ phase: action.phase, seatIndex: action.seatIndex })),
    automaticVotes: room.settlement.automaticVotes
  };
}

export function redactCardForPublic(_card: IdentityCard): { role: 'hidden' } {
  return { role: 'hidden' };
}

export function assertNoHiddenCardsInPublicView(view: PublicRoomView): boolean {
  return !JSON.stringify(view).match(/狼人|预言家|强盗|捣蛋鬼|水鬼|平民/u);
}

function buildRevealedCards(room: Room, seatId: string): Array<{ location: string; role: Role }> {
  const revealed: Array<{ location: string; role: Role }> = [];
  const ownSeat = getSeatById(room, seatId);
  if (ownSeat.initialCardId) {
    const card = getCardById(room, ownSeat.initialCardId);
    revealed.push({ location: `playerSeat:${ownSeat.seatIndex}:initial`, role: card.role });
  }

  for (const action of room.actions) {
    if (action.actingSeatId !== seatId) continue;
    if (action.phase !== room.phase) continue;
    for (const cardId of action.revealedCardIds) {
      const card = getCardById(room, cardId);
      const target = action.selectedTargets.find((candidate) => {
        if (candidate.kind === 'underwater') return card.initialLocation === `underwater:${candidate.underwaterIndex}` || card.currentLocation === `underwater:${candidate.underwaterIndex}`;
        if (!candidate.seatId) return false;
        return card.initialLocation === `playerSeat:${candidate.seatId}` || card.currentLocation === `playerSeat:${candidate.seatId}`;
      });
      revealed.push({ location: targetToLocation(target), role: card.role });
    }
  }

  return dedupeReveals(revealed);
}

function targetToLocation(target: { kind: 'player' | 'underwater'; seatIndex?: SeatIndex; underwaterIndex?: number } | undefined): string {
  if (!target) return 'unknown';
  if (target.kind === 'underwater') return `underwater:${target.underwaterIndex ?? 0}`;
  return `playerSeat:${target.seatIndex ?? 0}`;
}

function dedupeReveals(items: Array<{ location: string; role: Role }>): Array<{ location: string; role: Role }> {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.location}:${item.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isCurrentRoleCompleted(room: Room, phase: Phase): boolean {
  const role = ROLE_BY_PHASE[phase];
  if (!role) return phase !== 'free_speech';
  return room.actions.some((action) => action.phase === phase);
}

export function privateCurrentRole(room: Room, seatId: string): Role | null {
  const seat = getSeatById(room, seatId);
  return getCurrentCardForSeat(room, seat).role;
}
