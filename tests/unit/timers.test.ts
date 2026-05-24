import { describe, expect, it, vi } from 'vitest';
import { RoomTimerService } from '../../src/server/game/timers.js';
import { RoomStore } from '../../src/server/room-store.js';
import { DEFAULT_PHASE_DURATIONS_MS, type Phase, type Room } from '../../src/shared/types.js';
import { castVote, setPhase } from '../../src/server/game/engine.js';
import { makeThreePlayerRoom } from '../helpers/room-fixtures.js';

const phaseOptions = (now: string, durationMs: number) => ({
  now: new Date(now),
  phaseDurationsMs: {
    close_eyes: durationMs,
    wolf_action: durationMs,
    seer_action: durationMs,
    robber_action: durationMs,
    troublemaker_action: durationMs,
    water_ghost_action: durationMs,
    open_eyes: durationMs,
    voting: durationMs
  },
  votingTimeoutMs: durationMs
});

function createService(room: Room, onSettlement = vi.fn()): { store: RoomStore; service: RoomTimerService; onSettlement: ReturnType<typeof vi.fn> } {
  const store = new RoomStore();
  store.replaceRoom(room);
  const service = new RoomTimerService(store, { phaseTimeScale: 1, votingTimeoutMs: 1000, onSettlement });
  return { store, service, onSettlement };
}

function triggerTimeout(service: RoomTimerService, roomCode: string, expectedPhase?: Phase, expectedPhaseEndsAt?: string): void {
  (service as unknown as { onPhaseTimeout: (roomCode: string, expectedPhase?: Phase, expectedPhaseEndsAt?: string) => void }).onPhaseTimeout(
    roomCode,
    expectedPhase,
    expectedPhaseEndsAt
  );
}

describe('DEFAULT_PHASE_DURATIONS_MS', () => {
  // T001: Verify action-phase values are exactly 20000ms
  it('sets wolf_action, seer_action, robber_action, troublemaker_action, water_ghost_action to 20000ms', () => {
    expect(DEFAULT_PHASE_DURATIONS_MS.wolf_action).toBe(20000);
    expect(DEFAULT_PHASE_DURATIONS_MS.seer_action).toBe(20000);
    expect(DEFAULT_PHASE_DURATIONS_MS.robber_action).toBe(20000);
    expect(DEFAULT_PHASE_DURATIONS_MS.troublemaker_action).toBe(20000);
    expect(DEFAULT_PHASE_DURATIONS_MS.water_ghost_action).toBe(20000);
  });

  // T002: Verify all 5 action phases return ≥ 20000ms
  it('returns at least 20000ms for all action phases', () => {
    const actionPhases = ['wolf_action', 'seer_action', 'robber_action', 'troublemaker_action', 'water_ghost_action'] as const;
    for (const phase of actionPhases) {
      expect(DEFAULT_PHASE_DURATIONS_MS[phase]).toBeGreaterThanOrEqual(20000);
    }
  });

  // T004: Verify non-action-phase values unchanged
  it('keeps non-action-phase values unchanged (close_eyes=5000, open_eyes=1000, voting=60000)', () => {
    expect(DEFAULT_PHASE_DURATIONS_MS.close_eyes).toBe(5000);
    expect(DEFAULT_PHASE_DURATIONS_MS.open_eyes).toBe(1000);
    expect(DEFAULT_PHASE_DURATIONS_MS.voting).toBe(60000);
  });
});

describe('RoomTimerService stale-timeout guards', () => {
  it('ignores a stale timeout when the room has moved to a different phase', () => {
    let room = setPhase(makeThreePlayerRoom(), 'close_eyes', phaseOptions('2026-05-21T12:00:00.000Z', 5000));
    const oldPhase = room.phase!;
    const oldPhaseEndsAt = room.phaseEndsAt!;
    const { store, service } = createService(room);

    room = setPhase(room, 'wolf_action', phaseOptions('2026-05-21T12:00:01.000Z', 5000));
    store.replaceRoom(room);

    triggerTimeout(service, room.roomCode, oldPhase, oldPhaseEndsAt);

    expect(store.requireRoom(room.roomCode).phase).toBe('wolf_action');
    expect(store.requireRoom(room.roomCode).phaseEndsAt).toBe(room.phaseEndsAt);
  });

  it('ignores a stale timeout when the same phase has a newer phaseEndsAt', () => {
    let room = setPhase(makeThreePlayerRoom(), 'wolf_action', phaseOptions('2026-05-21T12:00:00.000Z', 5000));
    const oldPhase = room.phase!;
    const oldPhaseEndsAt = room.phaseEndsAt!;
    const { store, service } = createService(room);

    room = setPhase(room, 'wolf_action', phaseOptions('2026-05-21T12:00:01.000Z', 5000));
    store.replaceRoom(room);

    triggerTimeout(service, room.roomCode, oldPhase, oldPhaseEndsAt);

    expect(store.requireRoom(room.roomCode).phase).toBe('wolf_action');
    expect(store.requireRoom(room.roomCode).phaseEndsAt).toBe(room.phaseEndsAt);
  });

  it('keeps exactly one active timer record with the expected phase and deadline per room', () => {
    const room = setPhase(makeThreePlayerRoom(), 'seer_action', phaseOptions('2026-05-21T12:00:00.000Z', 60_000));
    const { service } = createService(room);

    service.schedule(room);
    service.schedule({ ...room, version: room.version + 1 });

    const timers = (service as unknown as { timers: Map<string, { expectedPhase?: Phase; expectedPhaseEndsAt?: string }> }).timers;
    expect(timers.size).toBe(1);
    expect(timers.get(room.roomCode)?.expectedPhase).toBe('seer_action');
    expect(timers.get(room.roomCode)?.expectedPhaseEndsAt).toBe(room.phaseEndsAt);

    service.clearAll();
  });

  it('settles a voting timeout at most once even if an old callback fires again', () => {
    let room = setPhase(makeThreePlayerRoom(), 'voting', phaseOptions('2026-05-21T12:00:00.000Z', 1000));
    room = castVote(room, 0, 1, { now: new Date('2026-05-21T12:00:00.100Z') });
    room = castVote(room, 1, 2, { now: new Date('2026-05-21T12:00:00.200Z') });
    const expectedPhase = room.phase!;
    const expectedPhaseEndsAt = room.phaseEndsAt!;
    const { store, service, onSettlement } = createService(room);

    triggerTimeout(service, room.roomCode, expectedPhase, expectedPhaseEndsAt);
    triggerTimeout(service, room.roomCode, expectedPhase, expectedPhaseEndsAt);

    expect(store.requireRoom(room.roomCode).phase).toBe('settlement');
    expect(onSettlement).toHaveBeenCalledTimes(1);
    expect(store.requireRoom(room.roomCode).settlement?.automaticVotes).toHaveLength(1);
  });
});
