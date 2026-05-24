import { DEFAULT_PHASE_DURATIONS_MS, type Phase, type Room } from '../../shared/types.js';
import { advanceTimedPhase, initializeGame, type EngineOptions } from './engine.js';
import type { RoomStore } from '../room-store.js';

export interface RoomTimerCallbacks {
  onRoomUpdated?: (room: Room) => void;
  onSettlement?: (room: Room) => void;
}

export interface RoomTimerOptions extends RoomTimerCallbacks {
  phaseTimeScale?: number;
  votingTimeoutMs?: number;
}

interface ActiveTimerRecord {
  expectedPhase: Phase;
  expectedPhaseEndsAt: string;
  timeoutHandle: NodeJS.Timeout;
}

export class RoomTimerService {
  private readonly timers = new Map<string, ActiveTimerRecord>();
  private readonly phaseTimeScale: number;
  private readonly votingTimeoutMs: number;
  private readonly callbacks: RoomTimerCallbacks;

  constructor(private readonly store: RoomStore, options: RoomTimerOptions = {}) {
    this.phaseTimeScale = options.phaseTimeScale ?? Number(process.env.PHASE_TIME_SCALE ?? 1);
    this.votingTimeoutMs = options.votingTimeoutMs ?? Number(process.env.VOTING_TIMEOUT_MS ?? DEFAULT_PHASE_DURATIONS_MS.voting);
    this.callbacks = options;
  }

  engineOptions(now = new Date()): EngineOptions {
    const scale = Number.isFinite(this.phaseTimeScale) ? Math.max(0, this.phaseTimeScale) : 1;
    return {
      now,
      phaseDurationsMs: {
        close_eyes: Math.round(DEFAULT_PHASE_DURATIONS_MS.close_eyes * scale),
        wolf_action: Math.round(DEFAULT_PHASE_DURATIONS_MS.wolf_action * scale),
        seer_action: Math.round(DEFAULT_PHASE_DURATIONS_MS.seer_action * scale),
        robber_action: Math.round(DEFAULT_PHASE_DURATIONS_MS.robber_action * scale),
        troublemaker_action: Math.round(DEFAULT_PHASE_DURATIONS_MS.troublemaker_action * scale),
        water_ghost_action: Math.round(DEFAULT_PHASE_DURATIONS_MS.water_ghost_action * scale),
        open_eyes: Math.round(DEFAULT_PHASE_DURATIONS_MS.open_eyes * scale),
        voting: Math.round(this.votingTimeoutMs * scale)
      },
      votingTimeoutMs: Math.round(this.votingTimeoutMs * scale)
    };
  }

  startGame(roomCode: string, seed?: string): Room {
    const room = this.store.requireRoom(roomCode);
    const next = initializeGame(room, { ...this.engineOptions(), seed });
    this.store.replaceRoom(next);
    this.callbacks.onRoomUpdated?.(next);
    this.schedule(next);
    return next;
  }

  replaceAndSchedule(room: Room): Room {
    this.store.replaceRoom(room);
    this.callbacks.onRoomUpdated?.(room);
    if (room.phase === 'settlement') {
      this.clear(room.roomCode);
      this.callbacks.onSettlement?.(room);
    } else {
      this.schedule(room);
    }
    return room;
  }

  schedule(room: Room): void {
    this.clear(room.roomCode);
    if (!room.phase || !room.phaseEndsAt || room.phase === 'free_speech' || room.phase === 'settlement') return;
    const expectedPhase = room.phase;
    const expectedPhaseEndsAt = room.phaseEndsAt;
    const delay = Math.max(0, new Date(expectedPhaseEndsAt).getTime() - Date.now());
    const timeoutHandle = setTimeout(() => this.onPhaseTimeout(room.roomCode, expectedPhase, expectedPhaseEndsAt), delay);
    if (typeof timeoutHandle.unref === 'function') timeoutHandle.unref();
    this.timers.set(room.roomCode, { expectedPhase, expectedPhaseEndsAt, timeoutHandle });
  }

  clear(roomCode: string): void {
    const existing = this.timers.get(roomCode);
    if (existing) clearTimeout(existing.timeoutHandle);
    this.timers.delete(roomCode);
  }

  clearAll(): void {
    for (const roomCode of this.timers.keys()) this.clear(roomCode);
  }

  private onPhaseTimeout(roomCode: string, expectedPhase?: Phase, expectedPhaseEndsAt?: string): void {
    const active = this.timers.get(roomCode);
    if (active && active.expectedPhase === expectedPhase && active.expectedPhaseEndsAt === expectedPhaseEndsAt) {
      clearTimeout(active.timeoutHandle);
      this.timers.delete(roomCode);
    }

    const room = this.store.getRoom(roomCode);
    if (!room || room.phase === 'free_speech' || room.phase === 'settlement') return;

    const phaseToMatch = expectedPhase ?? room.phase;
    const deadlineToMatch = expectedPhaseEndsAt ?? room.phaseEndsAt;
    if (!phaseToMatch || !deadlineToMatch) return;
    if (room.phase !== phaseToMatch || room.phaseEndsAt !== deadlineToMatch) return;

    const next = advanceTimedPhase(room, this.engineOptions());
    this.store.replaceRoom(next);
    this.callbacks.onRoomUpdated?.(next);
    if (next.phase === 'settlement') {
      this.callbacks.onSettlement?.(next);
      this.clear(roomCode);
      return;
    }
    this.schedule(next);
  }
}

export function isTimedPhase(phase: Phase | undefined): boolean {
  return Boolean(phase && phase !== 'free_speech' && phase !== 'settlement');
}
