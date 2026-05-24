# Research: 每个身份行动时间至少 20 秒以上

**Feature**: 007-min-action-time-20s | **Date**: 2026-05-23

## Research Questions

### Q1: Current DEFAULT_PHASE_DURATIONS_MS values

**Decision**: All 5 skill action phases already set to 20000ms (20s).

**Findings**:
- `src/shared/types.ts` defines `DEFAULT_PHASE_DURATIONS_MS` with the following values (inherited from Spec 006 implementation):
  - `wolf_action`: 20000ms ✅
  - `seer_action`: 20000ms ✅
  - `robber_action`: 20000ms ✅
  - `troublemaker_action`: 20000ms ✅
  - `water_ghost_action`: 20000ms ✅
  - `close_eyes`: 5000ms (unchanged) ✅
  - `open_eyes`: 1000ms (unchanged) ✅
  - `voting`: 60000ms (unchanged) ✅
- All values satisfy the ≥ 20000ms requirement of Spec 007 FR-001 through FR-005.
- Non-action phase values (FR-006) remain at their original design values.

**Rationale**: Spec 006 already implemented the 20-second duration change. Spec 007 refines the semantics from "exactly 20s" to "at least 20s" (minimum guarantee), and the current value of exactly 20000ms satisfies this constraint.

**Alternatives considered**: Raising to a higher value (e.g. 25000ms or 30000ms) is not required by the current spec; the "at least" framing allows future per-phase differentiation if needed.

### Q2: How phase durations are consumed by the timer system

**Decision**: Service-side `RoomTimerService` and engine's `getPhaseDurationMs()` / `setPhase()` use `DEFAULT_PHASE_DURATIONS_MS` directly. No changes needed.

**Findings**:
- `src/server/game/engine.ts`: `getPhaseDurationMs(phase, options)` returns `options.phaseDurationsMs?.[phase] ?? DEFAULT_PHASE_DURATIONS_MS[phase]`
- `src/server/game/engine.ts`: `setPhase()` calls `getPhaseDurationMs()` to compute `phaseEndsAt` as `now + durationMs`
- `src/server/game/timers.ts`: `RoomTimerService.engineOptions()` applies `PHASE_TIME_SCALE` multiplier to all durations, including skill phases
- `src/server/game/timers.ts`: `schedule()` sets `setTimeout` for `phaseEndsAt - Date.now()`
- `src/server/game/timers.ts`: `advanceTimedPhase()` is called on timeout, auto-completing mandatory actions (捣蛋鬼, 水鬼) and advancing to next phase

**Rationale**: The timer pipeline is duration-agnostic — it works with any duration value through a single code path. The 20000ms value flows naturally through this path without any modification.

### Q3: How the client computes countdown display

**Decision**: Client uses server-authoritative `phaseEndsAt` timestamp, not the duration constant. No changes needed.

**Findings**:
- `src/client/state.ts`: `remainingSecondsForDeadline(phaseEndsAt, serverClockOffsetMs)` computes `Math.max(0, Math.ceil((deadlineMs - estimatedServerNow) / 1000))`
- `src/client/state.ts`: `buildCountdownSnapshot()` returns `{ phase, phaseEndsAt, serverNow, isTimed, remainingSeconds }`
- `src/client/views/game.ts`: renders `剩余 <strong>${countdown.remainingSeconds ?? 0}</strong> 秒`
- The client never references `DEFAULT_PHASE_DURATIONS_MS` for counting down — it only imports the type for TypeScript correctness

**Rationale**: This design satisfies FR-007 (client must use server timestamp, not self-decide). The 20000ms change on the server side automatically propagates to all clients via the `phaseEndsAt` field in `PublicRoomView`.

### Q4: Test coverage for the 20-second requirement

**Decision**: Adequate test coverage already in place. No additional tests needed.

**Findings**:
- `tests/unit/timers.test.ts` T001: Asserts all 5 skill phases = exactly 20000ms
- `tests/unit/timers.test.ts` T002: Asserts all 5 skill phases ≥ 20000ms (directly satisfies Spec 007 "at least" semantics)
- `tests/unit/timers.test.ts` T004: Asserts non-action phases unchanged (5000, 1000, 60000)
- `tests/e2e/three-player-game.spec.ts`: Full three-player flow passes with extended phases
- All 83 tests pass (`npm test`)

**Rationale**: Test coverage explicitly validates both "exactly 20s" (006) and "at least 20s" (007) semantics. No gaps identified.

### Q5: PHASE_TIME_SCALE compatibility

**Decision**: `PHASE_TIME_SCALE` environment variable continues to work correctly with 20000ms base values.

**Findings**:
- `RoomTimerService.engineOptions()` applies `Math.round(DEFAULT_PHASE_DURATIONS_MS[phase] * scale)` for all phases
- With default scale=1, durations are exactly 20000ms
- With scale=0.1 (test mode), skill phases become 2000ms (2s) — still a functional minimum
- E2E tests can use lower scale values for faster test execution while still verifying the duration propagation logic

**Rationale**: The scaling mechanism is independent of base duration values. No modification needed.

## Summary

All Spec 007 requirements are already satisfied by the Spec 006 implementation. The codebase:
- Has `DEFAULT_PHASE_DURATIONS_MS` with 20000ms for all 5 skill phases
- Has tests asserting ≥ 20000ms (T002 directly validates Spec 007 semantics)
- Uses server-authoritative `phaseEndsAt` for client countdown display
- Maintains all non-action phase values unchanged
- Preserves `PHASE_TIME_SCALE` compatibility

**No code changes required for Spec 007.**
