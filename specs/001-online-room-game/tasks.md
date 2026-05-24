# Tasks: 在线房间游戏

**Input**: Design documents from `/specs/001-online-room-game/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/realtime-api.md`, `quickstart.md`

**Tests**: Included because the specification defines mandatory testing scenarios and success criteria, and the plan requires Vitest, Playwright, and HTTP/Socket.IO contract coverage.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same phase after that phase's prerequisites are met; task touches different files and has no dependency on incomplete tasks.
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`) used only for user-story phase tasks.
- Every task description includes exact file path(s) to modify or create.

## Path Conventions

- Single TypeScript web application at repository root.
- Backend files: `src/server/`
- Browser client files: `src/client/`
- Shared contracts/types: `src/shared/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the TypeScript project, tooling, and empty source/test structure.

- [X] T001 Create TypeScript npm project manifest with Express, Socket.IO, Vite, Zod, Vitest, Playwright dependencies and scripts in `package.json`
- [X] T002 [P] Configure TypeScript, Vite, Vitest, and Playwright in `tsconfig.json`, `tsconfig.server.json`, `tsconfig.client.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- [X] T003 [P] Create local environment template and ignore rules in `.env.example` and `.gitignore`
- [X] T004 [P] Create directory placeholders in `src/server/.gitkeep`, `src/server/realtime/.gitkeep`, `src/server/game/.gitkeep`, `src/client/views/.gitkeep`, `src/client/styles/.gitkeep`, `src/shared/.gitkeep`, `tests/unit/.gitkeep`, `tests/integration/.gitkeep`, `tests/e2e/.gitkeep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared domain contracts and application skeletons required before any user story can be completed.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T005 Define shared domain enums and interfaces for Room, PlayerSeat, IdentityCard, RoleAction, Vote, Settlement, and transient ChatMessage in `src/shared/types.ts`
- [X] T006 [P] Define stable error codes and Chinese user-facing messages in `src/shared/errors.ts`
- [X] T007 Implement Zod schemas for HTTP payloads and Socket.IO events from `contracts/realtime-api.md` in `src/shared/contracts.ts`
- [X] T008 [P] Create pure game engine state factory and immutable result types in `src/server/game/engine.ts`
- [X] T009 [P] Create public/private view projection interfaces and hidden-card redaction helpers in `src/server/game/visibility.ts`
- [X] T010 Create in-memory RoomStore primitives for room lookup, update, versioning, token hashing, and cleanup hooks in `src/server/room-store.ts`
- [X] T011 [P] Create Express app and Node server entrypoints with static client serving hooks in `src/server/app.ts` and `src/server/index.ts`
- [X] T012 [P] Create Socket.IO `/rooms` namespace bootstrap and handler registration skeleton in `src/server/realtime/socket-server.ts` and `src/server/realtime/event-handlers.ts`
- [X] T013 [P] Create browser room state, HTTP API, Socket.IO client, and localStorage token skeleton in `src/client/state.ts`

**Checkpoint**: Foundation ready; user story implementation can now begin.

---

## Phase 3: User Story 1 - 开房并完成一局三人在线游戏 (Priority: P1) 🎯 MVP

**Goal**: Three invited players can create/join a room, start exactly one three-player game, progress through all phases, chat during free speech, vote, and view settlement.

**Independent Test**: One player creates a room, two players join with the room code, the owner starts the game, all phases complete, each player votes, and all players see vote totals, eliminated/no-out result, winning camp, final player identities, and final underwater cards.

### Tests for User Story 1

> Write these tests first and verify they fail before implementation.

- [X] T014 [P] [US1] Create HTTP happy-path contract tests for `POST /api/rooms` and `POST /api/rooms/:roomCode/join` in `tests/integration/room-api.test.ts`
- [X] T015 [P] [US1] Create seeded full-game engine tests for deal, phase order, vote tally, tie/no-tie elimination, and settlement in `tests/unit/game-engine.test.ts`
- [X] T016 [P] [US1] Create three-client Socket.IO happy-path flow tests for start, phase broadcasts, relay-only chat, vote progress, settlement, and per-update latency measurement in `tests/integration/socket-flow.test.ts`
- [X] T017 [P] [US1] Create browser happy-path create/join/start/play/vote/settle test in `tests/e2e/three-player-game.spec.ts`

### Implementation for User Story 1

- [X] T018 [US1] Implement waiting-room creation, unique room code generation, seat assignment, owner tracking, and join success responses in `src/server/room-store.ts`
- [X] T019 [US1] Implement `POST /api/rooms` and `POST /api/rooms/:roomCode/join` with Zod validation and reconnect-token return in `src/server/app.ts`
- [X] T020 [US1] Implement deck initialization, seeded/random deal support, phase order, vote tally, and settlement calculation in `src/server/game/engine.ts`
- [X] T021 [US1] Implement server-authoritative timed phase scheduling, voting timeout handling, automatic valid vote fallback, and owner-controlled `free_speech` advancement in `src/server/game/timers.ts`
- [X] T022 [US1] Implement public/private state projections for lobby, own initial role, current phase, vote progress, and settlement reveal in `src/server/game/visibility.ts`
- [X] T023 [US1] Implement `room:start`, `phase:advance-to-vote`, `vote:cast`, and relay-only `chat:send` handlers with room-scoped broadcasts and no server-side chat transcript in `src/server/realtime/event-handlers.ts`
- [X] T024 [US1] Connect the Socket.IO namespace to RoomStore, timers, visibility projection, and per-seat broadcasts in `src/server/realtime/socket-server.ts`
- [X] T025 [P] [US1] Implement create room, join room, waiting room, player list, room code sharing, and owner start controls in `src/client/views/lobby.ts`
- [X] T026 [P] [US1] Implement phase timeline, neutral waiting state, voting controls, and settlement result rendering in `src/client/views/game.ts`
- [X] T027 [P] [US1] Implement free-speech text chat rendering and send form in `src/client/views/chat.ts`
- [X] T028 [US1] Wire browser bootstrap, API calls, Socket.IO events, state updates, and view rendering in `src/client/main.ts` and `src/client/state.ts`
- [X] T029 [P] [US1] Add minimal responsive text/CSS styling for lobby, roles, phases, chat, voting, and settlement in `src/client/styles/main.css`

**Checkpoint**: MVP is fully functional and independently testable.

---

## Phase 4: User Story 2 - 私密且准确地执行身份技能 (Priority: P2)

**Goal**: Each role action is validated server-side, private information is only visible to authorized players, optional actions can be skipped, mandatory actions auto-complete on timeout, and swaps use final identity state.

**Independent Test**: With controlled initial player/underwater cards, test 狼人, 预言家, 强盗, 捣蛋鬼, 水鬼, and 平民 behavior; verify eligible choices, automatic mandatory actions, card swaps, and no private card leakage to other seats.

### Tests for User Story 2

> Write these tests first and verify they fail before implementation.

- [X] T030 [P] [US2] Add role-action unit tests covering 狼人, 预言家, 强盗, 捣蛋鬼, 水鬼, and 平民 rules in `tests/unit/game-engine.test.ts`
- [X] T031 [P] [US2] Add private/public visibility tests proving unauthorized seats see zero hidden card contents in `tests/unit/visibility.test.ts`
- [X] T032 [P] [US2] Add Socket.IO action contract tests for `action:wolf`, `action:seer`, `action:robber`, `action:troublemaker`, `action:water-ghost`, and `action:result` in `tests/integration/socket-flow.test.ts`

### Implementation for User Story 2

- [X] T033 [US2] Implement server-side validation and state mutation for all role actions, including reveal and exchange outcomes, in `src/server/game/engine.ts`
- [X] T034 [US2] Implement optional timeout skips and automatic valid target selection for mandatory 捣蛋鬼 and 水鬼 actions in `src/server/game/timers.ts`
- [X] T035 [US2] Implement per-seat private reveal lists, exchange redaction, and settlement-only full reveal rules in `src/server/game/visibility.ts`
- [X] T036 [US2] Implement `action:wolf`, `action:seer`, `action:robber`, `action:troublemaker`, and `action:water-ghost` handlers plus private `action:result` emissions in `src/server/realtime/event-handlers.ts`
- [X] T037 [P] [US2] Add role-specific action controls and private result rendering in `src/client/views/game.ts`
- [X] T038 [US2] Add private revealed-card state and current eligible action handling in `src/client/state.ts`
- [X] T039 [P] [US2] Add text/CSS styles for private action panels, hidden cards, revealed cards, and automatic-action badges in `src/client/styles/main.css`

**Checkpoint**: Role actions are accurate, private, and testable independently from room error handling.

---

## Phase 5: User Story 3 - 处理房间异常与在线中断 (Priority: P3)

**Goal**: Invalid joins, duplicate nicknames, full/started rooms, reconnect flow, disconnects, invalid actions, and room deletion all produce clear feedback without corrupting valid game state.

**Independent Test**: Attempt nonexistent/full/started-room joins, duplicate nicknames, invalid/late/ineligible actions, browser refresh reconnect with token, reconnect without matching token, and all-player leave cleanup; verify errors and unchanged room/game state.

### Tests for User Story 3

> Write these tests first and verify they fail before implementation.

- [X] T040 [P] [US3] Add invalid join, duplicate nickname, full room, started room, and reconnect-token HTTP contract tests in `tests/integration/room-api.test.ts`
- [X] T041 [P] [US3] Add disconnect, reconnect, socket auth failure, and `room:leave` integration tests in `tests/integration/socket-flow.test.ts`
- [X] T042 [P] [US3] Add browser refresh/reconnect and invalid operation feedback tests in `tests/e2e/three-player-game.spec.ts`
- [X] T043 [P] [US3] Add invalid phase, ineligible actor, invalid target, late action, duplicate vote immutability, disconnected voting timeout, and automatic vote fallback tests in `tests/unit/game-engine.test.ts`

### Implementation for User Story 3

- [X] T044 [US3] Implement `POST /api/rooms/:roomCode/reconnect` and structured JSON error responses for all room HTTP endpoints in `src/server/app.ts`
- [X] T045 [US3] Harden RoomStore for duplicate nickname rejection, full/started/settled room rejection, reconnect-token hash matching, disconnection markers, and room deletion after settlement or all players leave in `src/server/room-store.ts`
- [X] T046 [US3] Enforce Socket.IO auth, per-seat reconnection, disconnect status broadcasts, and `room:leave` behavior in `src/server/realtime/socket-server.ts`
- [X] T047 [US3] Enforce invalid action/vote/phase errors without state mutation and emit stable Chinese error messages in `src/server/realtime/event-handlers.ts`
- [X] T048 [US3] Implement browser reconnect-token persistence, reclaim flow, token cleanup after room closure, and clear error state in `src/client/state.ts`
- [X] T049 [P] [US3] Add lobby error messages for invalid room, unavailable room, full room, duplicate nickname, and reconnect failure in `src/client/views/lobby.ts`
- [X] T050 [P] [US3] Add in-game disconnected player status, invalid action feedback, and retry-safe UI behavior in `src/client/views/game.ts`

**Checkpoint**: Online interruption and error handling are reliable and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality, privacy, deployment, and usability improvements across all user stories.

- [X] T051 [P] Create project usage, local development, test, build, and self-host deployment documentation in `README.md`
- [X] T052 [P] Add public-origin, CORS, port, and production static-asset validation hardening in `src/server/app.ts`
- [X] T053 [P] Improve mobile readability, keyboard focus states, color contrast, and no-custom-art visual polish in `src/client/styles/main.css`
- [X] T054 Perform hidden-information, temporary-data, and chat non-retention privacy hardening review in `src/server/game/visibility.ts` and `src/server/room-store.ts`
- [X] T055 Run the manual smoke flow and update verified commands or deployment notes in `specs/001-online-room-game/quickstart.md`
- [X] T056 [P] Add SC-002 real-time synchronization latency validation for Socket.IO room/game state updates, verifying at least 95% of measured visible updates arrive within 2 seconds in `tests/integration/socket-flow.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and can start immediately.
- **Phase 2: Foundational** depends on Phase 1 and blocks all user stories.
- **Phase 3: User Story 1 (P1)** depends on Phase 2 and forms the MVP.
- **Phase 4: User Story 2 (P2)** depends on Phase 2; it can be developed independently with controlled engine/socket tests, then integrated with US1 UI flow.
- **Phase 5: User Story 3 (P3)** depends on Phase 2; it can be developed independently with error/reconnect tests, then integrated with US1/US2 flows.
- **Phase 6: Polish** depends on completion of the selected story scope.

### User Story Dependency Graph

```text
Phase 1 Setup
    ↓
Phase 2 Foundational
    ├── Phase 3 US1: full room game MVP
    ├── Phase 4 US2: private role actions
    └── Phase 5 US3: errors and reconnect
            ↓
Phase 6 Polish after selected stories are complete
```

### User Story Dependencies

- **US1 (P1)**: Start after Phase 2; no dependency on US2 or US3.
- **US2 (P2)**: Start after Phase 2 using controlled game states; integrates with US1 for end-user play.
- **US3 (P3)**: Start after Phase 2 using room/socket harnesses; integrates with US1/US2 for full robustness.

### Within Each User Story

- Tests must be written first and should fail before implementation.
- Shared/domain models precede services and event handlers.
- Server validation and mutation precede client controls.
- Public/private visibility must be complete before emitting state to clients.
- Each story reaches its checkpoint before moving to the next priority when working sequentially.

---

## Parallel Execution Examples

### User Story 1

```bash
# Tests can be created together:
Task: "T014 HTTP happy-path contract tests in tests/integration/room-api.test.ts"
Task: "T015 full-game engine tests in tests/unit/game-engine.test.ts"
Task: "T016 Socket.IO happy-path tests in tests/integration/socket-flow.test.ts"
Task: "T017 browser happy-path E2E in tests/e2e/three-player-game.spec.ts"

# Client views can be implemented together after contracts are stable:
Task: "T025 lobby UI in src/client/views/lobby.ts"
Task: "T026 game UI in src/client/views/game.ts"
Task: "T027 chat UI in src/client/views/chat.ts"
Task: "T029 CSS in src/client/styles/main.css"
```

### User Story 2

```bash
# Role correctness, visibility, and socket contract tests can be created together:
Task: "T030 role-action unit tests in tests/unit/game-engine.test.ts"
Task: "T031 visibility privacy tests in tests/unit/visibility.test.ts"
Task: "T032 action socket tests in tests/integration/socket-flow.test.ts"

# Client presentation tasks can run while server role logic is implemented:
Task: "T037 action controls in src/client/views/game.ts"
Task: "T039 private action styles in src/client/styles/main.css"
```

### User Story 3

```bash
# Error and reconnect tests can be created together:
Task: "T040 HTTP error/reconnect tests in tests/integration/room-api.test.ts"
Task: "T041 socket disconnect/reconnect tests in tests/integration/socket-flow.test.ts"
Task: "T042 browser reconnect E2E in tests/e2e/three-player-game.spec.ts"
Task: "T043 invalid action immutability tests in tests/unit/game-engine.test.ts"

# Client error surfaces can run in parallel:
Task: "T049 lobby error messages in src/client/views/lobby.ts"
Task: "T050 in-game error feedback in src/client/views/game.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate the independent MVP test: three players create/join/start/play/vote/settle.
5. Deploy/demo the invite-only room game if MVP validation passes.

### Incremental Delivery

1. Complete Setup + Foundational → runnable skeleton with shared contracts.
2. Add US1 → full three-player online room game MVP.
3. Add US2 → accurate private role skills and hidden-information protection.
4. Add US3 → robust invalid input, disconnect/reconnect, and deletion behavior.
5. Polish → documentation, deployment hardening, privacy review, and quickstart validation.

### Parallel Team Strategy

1. Team completes Phase 1 and Phase 2 together.
2. After Phase 2, assign stories by capability:
   - Developer A: US1 room/game happy path.
   - Developer B: US2 role-action engine and privacy tests.
   - Developer C: US3 reconnect and error handling.
3. Integrate story checkpoints in priority order: US1 → US2 → US3.

---

## Notes

- Use server-authoritative game state for all card locations, timers, actions, votes, and settlement.
- Never emit hidden card identities in public state before settlement.
- Store reconnect tokens in browser `localStorage`, but only store token hashes server-side.
- Delete all temporary room/game/chat data after settlement delivery or after all players leave.
- Keep UI minimal: text labels, colors, semantic HTML, basic emoji/icons only.
