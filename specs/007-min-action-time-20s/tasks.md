# Tasks: 每个身份行动时间至少 20 秒以上

**Input**: Design documents from `specs/007-min-action-time-20s/`

**Prerequisites**: plan.md (✓), spec.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓), quickstart.md (✓)

**Note**: All implementation code is already complete (inherited from Spec 006). The `DEFAULT_PHASE_DURATIONS_MS` constant in `src/shared/types.ts` has all 5 skill phases at 20000ms (≥ 20s). Tasks below are verification-focused — confirming correctness and validating edge cases.

**Tests**: The constitution-required tests are already written and passing. Verification tasks confirm they continue to pass and validate the Spec 007 "at least 20s" semantics.

**Organization**: Tasks are grouped by user story to enable independent verification of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Single TypeScript web application at repository root.
- Backend files: `src/server/`
- Browser client files: `src/client/`
- Shared contracts/types: `src/shared/`
- Tests: `tests/unit/`, `tests/e2e/`
- Spec docs: `specs/007-min-action-time-20s/`

---

## Phase 1: Setup (Verification Environment)

**Purpose**: Ensure verification environment is ready

- [x] T001 Verify Node.js 20+ and npm dependencies installed via `npm install`
- [x] T002 [P] Confirm `npm run build` succeeds with no errors
- [x] T003 [P] Confirm `npm test` passes all 83 existing tests as baseline

**Checkpoint**: Build and test baseline confirmed.

---

## Phase 2: Foundational (Code Review Verification)

**Purpose**: Verify that the existing implementation satisfies all Spec 007 requirements, before proceeding to user story verification

**⚠️ CRITICAL**: No user story verification should proceed until foundational code review confirms the implementation baseline.

- [x] T004 Review `src/shared/types.ts` — confirm `DEFAULT_PHASE_DURATIONS_MS` has all 5 skill phases at 20000ms (wolf_action, seer_action, robber_action, troublemaker_action, water_ghost_action)
- [x] T005 [P] Review `src/shared/types.ts` — confirm non-skill phase values are unchanged (close_eyes=5000, open_eyes=1000, voting=60000)
- [x] T006 [P] Review `src/server/game/engine.ts` — confirm `getPhaseDurationMs()` and `setPhase()` use the constant correctly to compute `phaseEndsAt`
- [x] T007 [P] Review `src/server/game/timers.ts` — confirm `RoomTimerService.engineOptions()` applies `PHASE_TIME_SCALE` to all phases including skill phases
- [x] T008 [P] Review `src/client/state.ts` — confirm `remainingSecondsForDeadline()` uses server-authoritative `phaseEndsAt` timestamp (FR-007)
- [x] T009 [P] Review `src/client/views/game.ts` — confirm countdown display renders Chinese "剩余 XX 秒" with correct value

**Checkpoint**: Code review confirms implementation baseline satisfies all FR-001 through FR-008.

---

## Phase 3: User Story 1 - 技能行动阶段时间充足 (Priority: P1) 🎯 MVP

**Goal**: Verify all 5 skill action phases (wolf_action, seer_action, robber_action, troublemaker_action, water_ghost_action) display ≥ 20s countdown and auto-advance correctly.

**Independent Test**: Run `npm test` with focus on `tests/unit/timers.test.ts` — confirm T001 (exact 20000ms) and T002 (≥ 20000ms) assertions pass for all 5 phases. Also run a live manual test: enter any skill phase, observe ≥ 20s countdown, verify countdown decrements, confirm auto-advance on timeout.

### Verification for User Story 1 ⚠️

> **NOTE**: Tests are already written and passing. These tasks verify correctness and validate edge cases covered by the spec.

- [x] T010 [US1] Run `npm test -- tests/unit/timers.test.ts` and confirm T001 "sets wolf_action, seer_action, robber_action, troublemaker_action, water_ghost_action to 20000ms" passes in `tests/unit/timers.test.ts`
- [x] T011 [P] [US1] Run `npm test -- tests/unit/timers.test.ts` and confirm T002 "returns at least 20000ms for all action phases" passes in `tests/unit/timers.test.ts` — this directly validates Spec 007 "≥ 20s" semantics
- [x] T012 [P] [US1] Run `npm run dev` and manually verify: start a game, observe wolf_action countdown starts ≥ 20 and decrements each second (acceptance scenario 1)
- [x] T013 [P] [US1] Run `npm run dev` and manually verify: observe troublemaker_action countdown starts ≥ 20 (was 5s before Spec 006, acceptance scenario 2)
- [x] T014 [P] [US1] Run `npm run dev` and manually verify: submit a card action with ~3s remaining — countdown continues, phase advances on timeout, not early (acceptance scenario 3)
- [x] T015 [P] [US1] Run `npm run dev` and manually verify: observe all 5 phases (wolf→seer→robber→troublemaker→water_ghost) each start ≥ 20s in sequence (acceptance scenario 4)
- [x] T016 [US1] Verify edge case — countdown submits at last second: submit action at 1s remaining, confirm action accepted and phase advances normally in `src/server/game/engine.ts`
- [x] T017 [P] [US1] Verify edge case — disconnect/reconnect: close browser tab during skill phase, reconnect via `POST /api/rooms/:code/reconnect`, confirm countdown matches other players via `remainingSecondsForDeadline()` in `src/client/state.ts`
- [x] T018 [P] [US1] Verify edge case — PHASE_TIME_SCALE: set `PHASE_TIME_SCALE=0.1` environment variable, restart server, confirm scaled skill phases = 2000ms (≥ minimum guarantee) via `RoomTimerService.engineOptions()` in `src/server/game/timers.ts`

**Checkpoint**: User Story 1 verified — all 5 skill phases ≥ 20s, countdown decrements, auto-advance works, edge cases handled.

---

## Phase 4: User Story 2 - 非技能阶段时长保持不变 (Priority: P2)

**Goal**: Verify non-skill phases (close_eyes=5s, open_eyes=1s, voting=60s) are not affected by the 20s skill phase change.

**Independent Test**: Run `npm test -- tests/unit/timers.test.ts` T004 — confirm non-action-phase values are exactly 5000, 1000, 60000. Manual: observe close_eyes=5s, open_eyes=1s, voting=60s during gameplay.

### Verification for User Story 2 ⚠️

- [x] T019 [US2] Run `npm test -- tests/unit/timers.test.ts` and confirm T004 "keeps non-action-phase values unchanged (close_eyes=5000, open_eyes=1000, voting=60000)" passes in `tests/unit/timers.test.ts`
- [x] T020 [P] [US2] Run `npm run dev` and manually verify: game starts → close_eyes phase displays 5s countdown (acceptance scenario 1)
- [x] T021 [P] [US2] Run `npm run dev` and manually verify: after all skill phases → voting phase displays 60s countdown (acceptance scenario 2)
- [x] T022 [P] [US2] Run `npm run dev` and manually verify: between skill phases → open_eyes transition displays 1s countdown (acceptance scenario 3)
- [x] T023 [P] [US2] Verify edge case — free_speech and settlement phases: confirm these have no countdown display (they are untimed) in `src/server/game/timers.ts` `isTimedPhase()` and `src/client/views/game.ts`

**Checkpoint**: User Story 2 verified — non-skill phases unchanged, no regression from 20s change.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories and documentation consistency.

- [x] T024 [P] Run full test suite `npm test` — confirm all 83 tests pass with zero failures
- [x] T025 [P] Run `npm run build` — confirm TypeScript compilation and Vite bundle succeed with no errors
- [x] T026 [P] Verify Chinese user-facing copy: confirm "剩余 XX 秒" display in `src/client/views/game.ts` line 136 and error messages in `src/shared/errors.ts` are correct
- [x] T027 [P] Verify real-time update latency: confirm phase state changes (`PublicRoomView.phaseEndsAt`) are broadcast to all clients within 2s via Socket.IO in `src/server/realtime/socket-server.ts`
- [x] T028 [P] Verify temporary data cleanup: confirm no phase duration data persists after settlement/all players leave — `RoomStore` cleanup logic unchanged in `src/server/room-store.ts`
- [x] T029 Update feature quickstart in `specs/007-min-action-time-20s/quickstart.md` with any findings from verification
- [x] T030 [P] Run `npm run test:e2e` (if Playwright environment available) — confirm `tests/e2e/three-player-game.spec.ts` passes with extended phases

**Checkpoint**: All verification complete. Feature confirmed to satisfy Spec 007 requirements.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (baseline confirmed)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (code review confirms baseline)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (code review confirms baseline) — independent of US1 verification
- **Polish (Phase 5)**: Depends on Phase 3 and Phase 4 completion

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on US2
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — no dependencies on US1. Can run in parallel with US1.

### Within Each User Story

- Test verification tasks (T010, T011 for US1; T019 for US2) should run before manual verification
- Manual verification tasks (T012-T015, T020-T022) marked [P] can run in parallel
- Edge case tasks (T016-T018, T023) can run after basic verification

### Parallel Opportunities

- All Phase 1 tasks (T001-T003) can run in parallel if environment setup is confirmed
- All Phase 2 code review tasks (T004-T009) can run in parallel
- Phase 3 (US1) and Phase 4 (US2) can run in parallel after Phase 2
- Within US1: T010, T011, T012-T015, T017, T018 can all run in parallel (separate test/verification paths)
- Within US2: T019, T020-T022, T023 can all run in parallel
- Phase 5 tasks (T024-T030) marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all verification tasks for User Story 1 in parallel:
Task: "Run unit timers test T001 in tests/unit/timers.test.ts" (T010)
Task: "Run unit timers test T002 in tests/unit/timers.test.ts" (T011)
Task: "Manually verify wolf_action countdown >= 20s" (T012)
Task: "Manually verify troublemaker_action countdown >= 20s" (T013)
Task: "Manually verify early submit doesn't skip phase" (T014)
Task: "Manually verify all 5 phases in sequence" (T015)
Task: "Verify PHASE_TIME_SCALE edge case" (T018)
```

## Parallel Example: User Story 2

```bash
# Launch all verification tasks for User Story 2 in parallel:
Task: "Run unit timers test T004 in tests/unit/timers.test.ts" (T019)
Task: "Manually verify close_eyes = 5s" (T020)
Task: "Manually verify voting = 60s" (T021)
Task: "Manually verify open_eyes = 1s" (T022)
Task: "Verify free_speech/settlement untimed" (T023)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

Since all code is already implemented, the "MVP" path is pure verification:

1. Complete Phase 1: Setup (T001-T003) — confirm environment
2. Complete Phase 2: Foundational (T004-T009) — confirm code baseline
3. Complete Phase 3: User Story 1 (T010-T018) — verify skill phases ≥ 20s
4. **STOP and VALIDATE**: User Story 1 independently verified — all 5 skill phases have ≥ 20s countdown
5. Feature is already deployable (code unchanged from current working state)

### Incremental Delivery

1. Setup + Foundational → Baseline confirmed
2. Verify User Story 1 → Skill phases ≥ 20s confirmed (MVP!)
3. Verify User Story 2 → Non-skill phases unchanged confirmed
4. Polish → Full suite validation complete
5. Each story adds verification confidence independently

### Single Developer Strategy

With one developer, proceed sequentially through phases 1→2→3→4→5. Most tasks within a phase are [P] parallel, so can be batch-executed.

---

## Notes

- **[P]** tasks = different verification paths, can run in parallel
- **[Story]** label maps task to specific user story for traceability
- **No code changes required** — all implementation inherited from Spec 006
- **T002** in `tests/unit/timers.test.ts` directly validates Spec 007 "≥ 20s" semantics via `toBeGreaterThanOrEqual(20000)`
- **T004** in `tests/unit/timers.test.ts` validates non-action phase values unchanged
- All 83 existing tests pass (`npm test`) — these tasks verify, not modify
- E2E test execution (T030) is optional if Playwright environment is configured
- Chinese UI copy (T026) must remain "剩余 XX 秒" — this is verified, not changed
