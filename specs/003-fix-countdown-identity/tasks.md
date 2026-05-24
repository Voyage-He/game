---
description: "Task list for feature implementation"
---

# Tasks: 修复倒计时与身份分配

**Input**: Design documents from `/specs/003-fix-countdown-identity/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/realtime-api.md, quickstart.md

**Tests**: Required. This feature touches game rules, visibility/privacy boundaries, room lifecycle, HTTP/Socket.IO contracts, reconnect, timers, voting, and user-visible errors. Write the listed tests first and verify they fail before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing single TypeScript application and test scripts are ready for the bug-fix work.

- [X] T001 Verify dependency install and scripts for `npm run build`, `npm test`, `npm run test:e2e`, and `npm run dev:test` in `package.json` and `package-lock.json`
- [X] T002 [P] Confirm accelerated timer and cleanup environment defaults for `PHASE_TIME_SCALE`, `VOTING_TIMEOUT_MS`, and `ROOM_IDLE_TTL_MS` in `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add reusable test scaffolding only; no user story implementation starts until this is complete.

**⚠️ CRITICAL**: User story implementation depends on these helpers to keep failing-first tests concise and consistent.

- [X] T003 [P] Add reusable three-player room and six-card deck fixture helpers in `tests/helpers/room-fixtures.ts`
- [X] T004 [P] Add reusable HTTP/Socket.IO room creation, client connection, event wait, and forced-role helpers in `tests/helpers/socket-fixtures.ts`

**Checkpoint**: Foundation ready - user story tests and implementation can begin.

---

## Phase 3: User Story 1 - 连续显示对局倒计时 (Priority: P1) 🎯 MVP

**Goal**: Timed phases show a calibrated, continuous, once-per-second countdown for all connected and reconnected players, while the server advances each phase exactly once.

**Independent Test**: Start a three-player game and verify close-eyes, role-action, and voting countdowns decrement once per second, stay aligned across clients and reconnect, and advance exactly once.

### Tests for User Story 1 ⚠️

> **NOTE**: Write these tests first and confirm they fail against the current countdown/timer behavior.

- [X] T005 [P] [US1] Add failing RoomTimerService unit tests for stale callbacks with old phase, old `phaseEndsAt`, one active timer per room, and single settlement in `tests/unit/timers.test.ts`
- [X] T006 [P] [US1] Add failing public view timestamp tests for `serverNow`, timed `phaseEndsAt`, and untimed `free_speech` in `tests/unit/visibility.test.ts`
- [X] T007 [P] [US1] Add failing Socket.IO countdown contract tests for reconnect alignment and role action/vote preserving `phaseEndsAt` in `tests/integration/socket-flow.test.ts`
- [X] T008 [P] [US1] Add failing Playwright countdown continuity assertions for close-eyes, role-action, voting, and reconnect in `tests/e2e/three-player-game.spec.ts`

### Implementation for User Story 1

- [X] T009 [P] [US1] Add `serverNow` to `PublicRoomView` and define countdown display derived fields/types in `src/shared/types.ts`
- [X] T010 [P] [US1] Add Zod schemas for `state:public`, `state:private`, settlement, and ISO timestamp fields in `src/shared/contracts.ts`
- [X] T011 [US1] Emit fresh `serverNow` and correct timed/untimed phase timestamp projections in `src/server/game/visibility.ts`
- [X] T012 [US1] Implement expected `phase` plus `phaseEndsAt` stale-timeout guard and one active timer record per room in `src/server/game/timers.ts`
- [X] T013 [US1] Ensure role action, vote, and auto-advance mutations preserve current phase timestamps unless the phase legitimately changes in `src/server/game/engine.ts`
- [X] T014 [US1] Route action/vote mutations through timer scheduling without resetting active phase deadlines in `src/server/realtime/event-handlers.ts`
- [X] T015 [US1] Broadcast current state to new/reconnected sockets using the existing room deadline without restarting the timer in `src/server/realtime/socket-server.ts`
- [X] T016 [US1] Store server clock offset from `serverNow` and expose remaining-seconds/timed-phase snapshot helpers in `src/client/state.ts`
- [X] T017 [US1] Add a one-second render loop that runs only while a timed `phaseEndsAt` exists in `src/client/main.ts`
- [X] T018 [US1] Render calibrated countdown seconds and explicit untimed free-speech text in `src/client/views/game.ts`

**Checkpoint**: User Story 1 is independently functional and is the MVP scope.

---

## Phase 4: User Story 2 - 每局重新公平分配身份 (Priority: P2)

**Goal**: Each new game performs a fresh server-side random allocation from the six-card deck, while identities remain stable within the same active game after refresh or reconnect.

**Independent Test**: Start many new games with the same players, nicknames, and join order; verify no fixed seat identity mapping, every game uses all six unique cards, and reconnect keeps the same in-game initial identity.

### Tests for User Story 2 ⚠️

> **NOTE**: Write these tests first and confirm they fail against deterministic or reconnect-redeal behavior.

- [X] T019 [P] [US2] Add failing engine allocation tests for 100 new games with same nicknames/join order, six unique roles, no fixed seat identity, and explicit seed determinism in `tests/unit/game-engine.test.ts`
- [X] T020 [P] [US2] Add failing Socket.IO allocation/stability tests for repeated `room:start`, refresh/reconnect same-game identity, and public no-role leak in `tests/integration/identity-allocation.test.ts`
- [X] T021 [P] [US2] Add failing Playwright identity variation and same-game reload stability checks in `tests/e2e/identity-allocation.spec.ts`

### Implementation for User Story 2

- [X] T022 [US2] Replace implicit `roomCode:version` seeded default with server-side Fisher-Yates shuffle using Node crypto while retaining explicit test seed/random control in `src/server/game/engine.ts`
- [X] T023 [US2] Ensure `RoomTimerService.startGame` only starts a fresh allocation once per `room:start` and never supplies deterministic production seeds in `src/server/game/timers.ts`
- [X] T024 [US2] Keep reconnect/socket connect paths attached to existing `initialCardId` and `currentCardId` without reallocating identities in `src/server/room-store.ts`
- [X] T025 [US2] Ensure `room:start` broadcasts per-seat private identities and public views without card roles after fresh allocation in `src/server/realtime/event-handlers.ts`
- [X] T026 [US2] Preserve private `initialRole` display across browser reconnect/reload without client-side redeal assumptions in `src/client/state.ts`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - 玩家理解修复后的等待与身份结果 (Priority: P3)

**Goal**: The UI clearly explains current phase, waiting/action/voting states, and settlement results in Chinese without leaking hidden information before settlement.

**Independent Test**: Complete a game with role actions, reconnect, and voting timeout; verify Chinese prompts are clear, unauthorized players see no private identities, and settlement shows final identities, water cards, votes, elimination/no-out, and winning camp.

### Tests for User Story 3 ⚠️

> **NOTE**: Write these tests first and confirm they fail where Chinese copy, privacy, or settlement visibility is incomplete.

- [X] T027 [P] [US3] Add failing client view tests for Chinese waiting, acting, voting, free-speech, and settlement text in `tests/unit/game-view.test.ts`
- [X] T028 [P] [US3] Add failing integration privacy/error tests for hidden roles, settlement-only final cards, and Chinese socket error messages in `tests/integration/privacy-errors.test.ts`
- [X] T029 [P] [US3] Add failing Playwright prompts/settlement review test covering action wait states, vote timeout, final identities, and water cards in `tests/e2e/chinese-prompts-settlement.spec.ts`

### Implementation for User Story 3

- [X] T030 [P] [US3] Centralize Chinese phase/action/wait/vote labels used by the game view in `src/client/views/util.ts`
- [X] T031 [US3] Update game UI to show neutral waiting prompts, eligible action prompts, vote progress, and settlement review fields in Chinese in `src/client/views/game.ts`
- [X] T032 [US3] Enforce public/private visibility boundaries and settlement-only final identity/water-card reveal in `src/server/game/visibility.ts`
- [X] T033 [P] [US3] Add or verify Chinese error messages for late actions, duplicate actions, duplicate votes, self-votes, and invalid targets in `src/shared/errors.ts`
- [X] T034 [US3] Emit non-mutating Chinese socket errors for invalid action/vote attempts in `src/server/realtime/event-handlers.ts`
- [X] T035 [P] [US3] Style countdown, waiting, acting, voting, and settlement states with minimal CSS and no extra animations in `src/client/styles/main.css`

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation, cleanup, privacy review, and complete validation.

- [X] T036 [P] Update Chinese manual verification and troubleshooting notes for countdown/reconnect/identity allocation in `README.md`
- [X] T037 [P] Sync targeted commands and expected user-facing results with final implementation in `specs/003-fix-countdown-identity/quickstart.md`
- [X] T038 Audit temporary room cleanup and no persistent match/chat history after settlement/all-left flows in `src/server/room-store.ts`
- [X] T039 [P] Remove duplicated fixtures/imports introduced during tests and keep helper docs concise in `tests/helpers/room-fixtures.ts` and `tests/helpers/socket-fixtures.ts`
- [X] T040 Run `npm run build`, `npm test`, and `npm run test:e2e` from scripts defined in `package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user story work.
- **Phase 3 US1 (P1)**: Depends on Phase 2 and is the MVP.
- **Phase 4 US2 (P2)**: Depends on Phase 2; can be developed in parallel with US1 after coordinating shared files, but delivery follows US1.
- **Phase 5 US3 (P3)**: Depends on Phase 2; can be developed in parallel with US1/US2 after coordinating shared files, but delivery follows US2.
- **Phase 6 Polish**: Depends on the selected user stories being complete.

### User Story Dependencies

- **US1**: No dependency on other stories after foundation.
- **US2**: No functional dependency on US1, but shares `src/server/game/engine.ts`, `src/server/game/timers.ts`, and `src/client/state.ts`; coordinate edits if parallelized.
- **US3**: No functional dependency on US1/US2, but validates the user-facing and privacy result of both fixes.

### Within Each User Story

1. Write all story tests first and confirm they fail.
2. Update shared types/contracts before server projections or client rendering.
3. Implement server-authoritative logic before browser display logic.
4. Re-run targeted tests for the story before moving to the next priority.

---

## Parallel Opportunities

- Setup T002 can run alongside T001.
- Foundational T003 and T004 can run in parallel.
- US1 tests T005, T006, T007, and T008 target different files and can run in parallel.
- US1 implementation T009 and T010 can run in parallel before server/client implementation tasks.
- US2 tests T019, T020, and T021 target different files and can run in parallel.
- US3 tests T027, T028, and T029 target different files and can run in parallel.
- US3 implementation T030, T033, and T035 target different files and can run in parallel.
- Polish T036, T037, and T039 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Launch failing-first countdown/timer tests together:
Task T005: tests/unit/timers.test.ts
Task T006: tests/unit/visibility.test.ts
Task T007: tests/integration/socket-flow.test.ts
Task T008: tests/e2e/three-player-game.spec.ts

# Launch independent shared contract work together:
Task T009: src/shared/types.ts
Task T010: src/shared/contracts.ts
```

## Parallel Example: User Story 2

```bash
# Launch allocation and stability tests together:
Task T019: tests/unit/game-engine.test.ts
Task T020: tests/integration/identity-allocation.test.ts
Task T021: tests/e2e/identity-allocation.spec.ts
```

## Parallel Example: User Story 3

```bash
# Launch UI/privacy/error tests together:
Task T027: tests/unit/game-view.test.ts
Task T028: tests/integration/privacy-errors.test.ts
Task T029: tests/e2e/chinese-prompts-settlement.spec.ts

# Launch independent copy/style/error file work together:
Task T030: src/client/views/util.ts
Task T033: src/shared/errors.ts
Task T035: src/client/styles/main.css
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational.
3. Complete Phase 3 User Story 1.
4. Stop and validate countdown continuity, reconnect alignment, and single phase advancement with T005-T008.
5. Demo or deploy only after the MVP tests pass.

### Incremental Delivery

1. Deliver US1 to fix continuous countdown and timer idempotency.
2. Deliver US2 to fix fresh per-game identity allocation and same-game identity stability.
3. Deliver US3 to clarify Chinese player prompts, privacy boundaries, and settlement review.
4. Complete Phase 6 validation before release.

### Parallel Team Strategy

1. One developer completes T001-T004.
2. After foundation, split by story: Developer A on US1, Developer B on US2, Developer C on US3.
3. Coordinate shared files listed in the dependency section before merging.
4. Run full build, unit/integration, and E2E validation from `package.json` after integration.

---

## Notes

- `[P]` tasks are parallelizable because they touch different files or have no dependency on incomplete tasks.
- `[US1]`, `[US2]`, and `[US3]` labels map directly to the user stories in `spec.md`.
- No task introduces accounts, persistent storage, public lobby, matchmaking, spectators, external services, or custom artwork.
- Hidden identities and water cards must remain private until rule-authorized reveal or settlement.
