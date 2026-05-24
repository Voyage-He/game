# Tasks: 修复身份牌翻转展示与技能查看

**Input**: Design documents from `/specs/004-fix-card-flip-reveal/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/internal-contracts.md, quickstart.md

**Tests**: Test tasks are REQUIRED. This feature touches game rules (role actions), visibility/privacy boundaries (revealedCards), room lifecycle (phase transitions), Socket.IO contracts (state:private payload), reconnect (card state preservation), and user-visible errors. Tests must be written first and verified to FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- Single TypeScript web application at repository root.
- Backend files: `src/server/`
- Browser client files: `src/client/`
- Shared contracts/types: `src/shared/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify development environment and review all touch points before making changes

- [x] T001 Run `npm install && npm test` to verify clean baseline — all existing tests must pass before starting
- [x] T002 [P] Review current data flow: trace `revealedCards` from `buildRevealedCards()` in `src/server/game/visibility.ts` through `state:private` socket event to `renderGame()` in `src/client/views/game.ts` — confirm root cause (client never renders `revealedCards`) and identify all files requiring changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented — phase-aware server filtering, client card rendering pipeline, and base CSS

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add phase-aware filtering to `buildRevealedCards()` in `src/server/game/visibility.ts` — insert `if (action.phase !== room.phase) continue;` in the actions loop so only current-phase reveals are returned (FR-008, FR-010)
- [x] T004 [P] Add card rendering helpers to `src/client/views/util.ts` — `isLocationRevealed(location: string, revealedCards)` and `getRevealedRole(location: string, revealedCards)` to determine card flip state from `PrivateRoomView.revealedCards`
- [x] T005 [P] Add base card CSS structure to `src/client/styles/main.css` — `.player-card`, `.underwater-card`, `.card`, `.card-inner`, `.card-back`, `.card-front` classes with face-down default state and `data-flipped="true"` face-up state (no animation yet, just show/hide)
- [x] T006 [P] Add client animation tracking state to `src/client/state.ts` — `animatedCardKeys: Set<string>` field on `ClientStateSnapshot`, cleared when `revealedCards` becomes empty (FR-009: prevents flip animation replay on reconnect)
- [x] T007 Replace `renderPlayers()` in `src/client/views/game.ts` with card-based rendering — each player rendered as `<div class="player-card">` with nickname header and inner `.card` element; render `revealedCards` data to set `data-flipped` attribute; add `renderUnderwaterCards()` function rendering three `<div class="underwater-card">` elements with "水下的牌" label (FR-004, FR-005); add shared `renderCardElement(location, role, isFlipped)` helper
- [x] T008 [P] Update `renderActionPanel()` in `src/client/views/game.ts` to ensure underwater buttons and player target buttons use correct action names (`action:wolf`, `action:seer`, `action:robber`) matching server event handlers

**Checkpoint**: Foundation ready — server filters reveals by phase, client renders revealed cards as flipped card elements, base CSS defines card shape. All user stories can now begin in parallel.

---

## Phase 3: User Story 1 - 预言家技能查看身份牌 (Priority: P1) 🎯 MVP

**Goal**: 预言家 activates skill → target cards (two underwater or one player) flip and show correct identity content; non-acting players see nothing; reveals hide on phase change; reconnect preserves face-up state

**Independent Test**: Start a 3-player game with at least one 预言家. During 预言家 phase, select action target (two underwater or one player). Verify cards flip and display correct Chinese role names. Advance phase → cards revert face-down. Reconnect within same phase → cards still face-up.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation. The current code never renders `revealedCards`.**

- [x] T009 [P] [US1] Add seer reveal visibility unit tests to `tests/unit/visibility.test.ts` — seer views two underwater cards → `revealedCards` contains both roles; seer views one player → `revealedCards` contains that player's role; phase advances to next → `revealedCards` is empty; non-acting player's `revealedCards` is empty during seer phase
- [x] T010 [P] [US1] Add seer card rendering unit tests to `tests/unit/game-view.test.ts` — `renderGame()` output for seer with two-underwater reveal contains two flipped `.card[data-flipped="true"]` underwater cards showing correct roles and one face-down underwater card; one-player reveal shows target player card flipped with correct role; non-target players remain face-down; Chinese role names appear in `.card-role` span

### Implementation for User Story 1

- [x] T011 [US1] Verify seer two-underwater mode rendering in `src/client/views/game.ts` — ensure the `renderUnderwaterCards()` function correctly reads `revealedCards` with location format `underwater:{index}`; the three seer action buttons (水下 1+2, 1+3, 2+3) emit correct `underwaterIndexes` payloads per existing `action:seer` handler
- [x] T012 [US1] Verify seer one-player mode rendering in `src/client/views/game.ts` — ensure player target buttons emit correct `targetSeatIndex` with `mode: 'view_one_player'`; rendered player card uses `revealedCards` entry with location format `playerSeat:{seatIndex}`
- [x] T013 [US1] Add seer reveal integration test to `tests/integration/socket-flow.test.ts` — after seer action via socket, `state:private` event contains `revealedCards` with correct target roles; after server advances phase, new `state:private` has empty `revealedCards`; verify privacy (other seat's `state:private` has no seer reveals)
- [x] T014 [US1] Add seer E2E tests to `tests/e2e/three-player-game.spec.ts` — three-player game with seer: verify targeted cards visually flip; verify identity content is correct Chinese role name; verify non-seer players see no flipped cards; verify cards revert on phase advance; verify reconnect within same phase preserves face-up state

**Checkpoint**: 预言家 skill card reveal fully functional, tested at unit/integration/E2E levels, independently verifiable

---

## Phase 4: User Story 2 - 狼人技能查看水下牌 (Priority: P1) 🎯 MVP

**Goal**: 狼人 activates skill → selects one of three underwater cards → that card flips and shows correct identity; other two underwater cards remain face-down; reveals hide on phase change; reconnect preserves state

**Independent Test**: Start a 3-player game with 狼人 role. During 狼人 phase, click one underwater card button. Verify that card flips showing correct Chinese role name. Verify other two underwater cards remain face-down. Advance phase → card reverts.

### Tests for User Story 2 ⚠️

- [x] T015 [P] [US2] Add wolf reveal visibility unit tests to `tests/unit/visibility.test.ts` — wolf views one underwater card → `revealedCards` contains that role only (not all three); phase advances → `revealedCards` is empty; non-acting player's `revealedCards` is empty
- [x] T016 [P] [US2] Add wolf card rendering unit tests to `tests/unit/game-view.test.ts` — `renderGame()` output for wolf after viewing underwater index 1 shows only underwater card 1 flipped with correct role in `.card-role`; underwater cards 0 and 2 have `data-flipped="false"`; no player cards are flipped

### Implementation for User Story 2

- [x] T017 [US2] Verify wolf action button flow in `src/client/views/game.ts` — the existing `underwaterButtons('action:wolf', 'underwaterIndex')` in `renderActionPanel` generates three buttons; after wolf acts, server returns `revealedCards` with `location: "underwater:{index}"`; `renderUnderwaterCards()` must match and flip the correct card
- [x] T018 [US2] Add wolf reveal integration test to `tests/integration/socket-flow.test.ts` — after wolf action, `state:private` contains `revealedCards` with one underwater role; verify privacy (other seat has no reveals); after phase change, reveals cleared
- [x] T019 [US2] Add wolf E2E tests to `tests/e2e/three-player-game.spec.ts` — wolf selects underwater card → only that card flips; other two underwater cards remain face-down; no player card identities exposed to wolf; cards revert on phase advance; reconnect preserves state

**Checkpoint**: 狼人 skill card reveal fully functional alongside 预言家, independently verified

---

## Phase 5: User Story 3 - 强盗技能查看并交换身份牌 (Priority: P2)

**Goal**: 强盗 activates skill → target player's card flips showing identity → identity swap executes (robber gets target's role, target gets robber's original role) → robber's own card updates to show new identity; reveals hide on phase change

**Independent Test**: Start a 3-player game with 强盗 role. During robber phase, select a target player. Verify target's card flips showing correct identity. Verify robber's own card updates to show swapped identity. Verify after phase change, target's card reverts face-down (but robber keeps swapped identity as current role).

### Tests for User Story 3 ⚠️

- [x] T020 [P] [US3] Add robber reveal visibility unit tests to `tests/unit/visibility.test.ts` — robber views target player → `revealedCards` contains that player's role with location `playerSeat:{seatIndex}`; after swap engine executes, robber's `initialRole` is still robber (unchanged per engine) but robber's `currentCardId` points to target's card; phase advances → reveals cleared; non-acting player has no reveals
- [x] T021 [P] [US3] Add robber card rendering unit tests to `tests/unit/game-view.test.ts` — target player card shows flipped with correct role; robber's own card shows "你的初始身份" line plus any swap indicator; after phase change, revealed cards hidden but robber's current identity persists via `initialRole` display

### Implementation for User Story 3

- [x] T022 [US3] Handle robber identity swap display in `src/client/views/game.ts` — after robber action returns `state:private`, the robber's own card should visually indicate the swap (e.g., show both initial role and current role); use `privateView.initialRole` (always the user's initial role) and `revealedCards` for the viewed target; swapped identity is reflected server-side via `currentCardId` — add a note/hint on robber's own card showing their identity has been exchanged
- [x] T023 [US3] Ensure robber action buttons emit correct payload in `src/client/views/game.ts` — the existing `playerTargetButtons('action:robber', 'targetSeatIndex')` already generates target buttons; verify the payload matches server's `RobberActionSchema`
- [x] T024 [US3] Add robber reveal+swap integration test to `tests/integration/socket-flow.test.ts` — after robber action, `state:private` contains `revealedCards` with target player's role; after swap, robber's `currentCardId` differs from `initialCardId`; verify privacy for other seats
- [x] T025 [US3] Add robber E2E tests to `tests/e2e/three-player-game.spec.ts` — robber selects target → target card flips with identity; robber's own card reflects swap; cards revert on phase advance; reconnect preserves state within same phase

**Checkpoint**: 强盗 skill fully functional — card flip reveal + identity swap display, independently verified

---

## Phase 6: User Story 4 - 竖直卡牌展示玩家与水下牌 (Priority: P2)

**Goal**: All players rendered as vertical rectangular cards (~2:3 aspect ratio) in a CSS Grid layout; three underwater cards shown in a row below; disconnected player cards visually distinct; responsive across common window sizes

**Independent Test**: Start a 3-player game. Verify three player cards rendered side-by-side on desktop with nicknames. Verify three face-down underwater cards below with "水下的牌" label. Verify disconnected player card appears dimmed. Resize browser → cards maintain proportions.

### Tests for User Story 4 ⚠️

- [x] T026 [P] [US4] Add card layout unit tests to `tests/unit/game-view.test.ts` — `renderGame()` output contains three `.player-card` elements with nicknames; three `.underwater-card` elements with Chinese labels; disconnected player has `.disconnected` CSS class or data attribute; card HTML structure matches contract in `contracts/internal-contracts.md`
- [x] T027 [P] [US4] Add card layout E2E tests to `tests/e2e/three-player-game.spec.ts` — verify three player cards visible on game start; verify three underwater cards visible with "水下的牌" label; verify disconnected player card shows distinct style; verify card proportions on mobile viewport

### Implementation for User Story 4

- [x] T028 [US4] Implement player card grid layout in `src/client/styles/main.css` — `.players-grid` with `display: grid; grid-template-columns: repeat(3, 1fr)` on desktop; single column on mobile via `@media (max-width: 600px)`; card aspect ratio ~2:3 via `aspect-ratio: 2/3` or fixed width with proportional height; nickname centered above card body
- [x] T029 [US4] Implement underwater card grid in `src/client/styles/main.css` — `.underwater-cards` grid with three cards in a row; section labeled "水下的牌" as heading; same card proportions as player cards; cards default to face-down with subtle border
- [x] T030 [US4] Add disconnected player visual state in `src/client/views/game.ts` and `src/client/styles/main.css` — when `player.connectionStatus === 'disconnected'`, add `.disconnected` class to `.player-card`; apply dimmed/desaturated styling with "离线" badge (FR-013)
- [x] T031 [US4] Implement responsive card scaling in `src/client/styles/main.css` — cards scale proportionally using `clamp()` or `min()` for width; maintain minimum readable text size; prevent overlap at narrow viewports via single-column fallback

**Checkpoint**: Card-based UI layout complete — players and underwater cards rendered as vertical cards with proper proportions, responsive across devices

---

## Phase 7: User Story 5 - 身份牌翻转动画效果 (Priority: P3)

**Goal**: Card flip from face-down to face-up uses CSS 3D `rotateY(180deg)` transition in 0.3–0.8 seconds; flip animation plays only on first reveal per phase (not on reconnect); card back has theme-colored pattern; card front shows role name in Chinese

**Independent Test**: During any skill activation, observe target card: it visually rotates from back to front over ~0.5 seconds. Reconnect within same phase → card is face-up instantly (no animation replay). Phase change → card flips back.

### Tests for User Story 5 ⚠️

- [x] T032 [P] [US5] Add flip animation CSS class tests to `tests/unit/game-view.test.ts` — newly revealed card HTML contains `card-flip-in` CSS class; already-revealed card (simulated reconnect) has `data-flipped="true"` but no `card-flip-in`; `animatedCardKeys` tracking prevents duplicate animation class
- [x] T033 [P] [US5] Add flip animation E2E tests to `tests/e2e/three-player-game.spec.ts` — verify flip animation CSS class present on initial reveal; verify animation completes without visual errors; verify reconnect within same phase shows face-up without animation; verify phase change hides cards

### Implementation for User Story 5

- [x] T034 [US5] Implement CSS 3D card flip in `src/client/styles/main.css` — `.card` container with `perspective: 800px`; `.card-inner` with `transform-style: preserve-3d` and `transition: transform 0.5s ease`; `.card[data-flipped="true"] .card-inner { transform: rotateY(180deg); }`; `.card-back` with `backface-visibility: hidden`, `#2454d6` background, subtle diagonal stripe via `repeating-linear-gradient`; `.card-front` with `backface-visibility: hidden; transform: rotateY(180deg);`, white background, role name centered; both faces positioned absolutely within card body
- [x] T035 [US5] Add `card-flip-in` initial reveal animation in `src/client/styles/main.css` — distinct from steady-state flipped; applies a one-time `@keyframes` or transition from initial face-down to face-up when class is present; class is removed after animation completes (via `animationend` event or not re-applied on next render)
- [x] T036 [US5] Implement animation replay prevention in `src/client/views/game.ts` — before adding `card-flip-in` class, check `snapshot.animatedCardKeys` Set; if key (location string) is present, render card face-up without animation class; if key is absent, add it to Set and include `card-flip-in` class; clear Set in `renderGame()` when `revealedCards` array is empty (phase change signal per FR-008)
- [x] T037 [US5] Verify reconnect skip-animation behavior in `src/client/state.ts` and `src/client/views/game.ts` — on receiving `state:private` during reconnect within same phase, `revealedCards` is populated; `animatedCardKeys` starts empty; cards render with `card-flip-in` animation only if `animatedCardKeys` Set was empty (first render); on subsequent renders within same phase (timer ticks, chat), cards stay face-up without animation; on phase change, `revealedCards` empties, Set clears

**Checkpoint**: Card flip animation fully functional — smooth CSS 3D rotation, no replay on reconnect, cards hide on phase change

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories — state cleanup, Chinese text validation, full test suite verification

- [x] T038 [P] Add new-game state cleanup in `src/client/state.ts` — ensure `animatedCardKeys` Set is cleared when game status transitions to `in_game` from `waiting` (FR-014: no residual card-face data from previous game)
- [x] T039 [P] Verify all Chinese text correctness across card rendering in `src/client/views/game.ts` and `src/client/views/util.ts` — role names on card fronts (狼人, 预言家, 强盗, 捣蛋鬼, 水鬼, 平民), underwater card labels (水下 1/2/3), phase labels, action prompts, disconnected badge (离线), "水下的牌" section heading (FR-015)
- [x] T040 [P] Run full unit + integration test suite: `npm test` — all existing tests plus new tests must pass; fix any regressions
- [x] T041 Run full E2E test suite: `npm run test:e2e` — all three-player game scenarios must pass including new card flip E2E tests; fix any flaky selectors
- [x] T042 Run `npm run build` to verify production build succeeds with no TypeScript or bundling errors

**Checkpoint**: All user stories complete, all tests pass, production build succeeds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–7)**: All depend on Foundational phase completion
  - US1 (P1), US2 (P1): Can start in parallel after Phase 2
  - US3 (P2), US4 (P2), US5 (P3): Can start in parallel after Phase 2
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — only Phase 2
- **User Story 2 (P1)**: No dependencies on other stories — only Phase 2
- **User Story 3 (P2)**: No dependencies on other stories — only Phase 2
- **User Story 4 (P2)**: Depends on Phase 2 CSS foundation (T005); may refine CSS added in other stories
- **User Story 5 (P3)**: Depends on Phase 2 CSS foundation (T005) and animation tracking (T006); most naturally implemented after US4 card layout is stable

### Within Each User Story

- Constitution-required tests MUST be written and FAIL before implementation
- Unit tests → Integration tests → E2E tests (where applicable)
- Server-side changes before client-side rendering verification
- Privacy validation (non-acting player cannot see reveals) before merging

### Parallel Opportunities

- All Phase 1 tasks can run together
- Phase 2: T003 (server), T004 (client util), T005 (CSS), T006 (state) are all in different files and can run in parallel
- Phase 2: T007 depends on T004 (needs helpers) and T005 (needs CSS classes); T008 depends on T007
- Phase 3–7: All five user stories can begin in parallel once Phase 2 completes
- Within each user story: test tasks marked [P] can run in parallel
- Phase 8: T038, T039 can run in parallel; T040–T042 run sequentially

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Add seer reveal visibility unit tests in tests/unit/visibility.test.ts"
Task: "Add seer card rendering unit tests in tests/unit/game-view.test.ts"

# After tests are written (and fail), implement:
Task: "Verify seer two-underwater mode rendering in src/client/views/game.ts"
Task: "Verify seer one-player mode rendering in src/client/views/game.ts"

# Then integration + E2E:
Task: "Add seer reveal integration test in tests/integration/socket-flow.test.ts"
Task: "Add seer E2E tests in tests/e2e/three-player-game.spec.ts"
```

---

## Parallel Example: User Stories 1 & 2 Together

```bash
# After Phase 2 completes, launch US1 and US2 in parallel:
Developer A: Phase 3 (US1) — T009–T014
Developer B: Phase 4 (US2) — T015–T019

# Both stories modify game.ts but in different functions; coordinate on merge
# US1 touches seer action panel + card rendering
# US2 touches wolf action panel + card rendering
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T008) — CRITICAL, blocks everything
3. Complete Phase 3: User Story 1 — 预言家 skill reveal (T009–T014)
4. Complete Phase 4: User Story 2 — 狼人 skill reveal (T015–T019)
5. **STOP and VALIDATE**: Both P1 bug fixes work — cards reveal identity when skills activate
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready (card rendering pipeline works)
2. Add US1 + US2 → Bug fix complete → Test independently → Deploy/Demo (MVP!)
3. Add US3 → Robber fixed → Test independently → Deploy/Demo
4. Add US4 → Card UI refined → Test independently → Deploy/Demo
5. Add US5 → Animation polished → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Single Developer Strategy

1. Phase 1 → Phase 2 (Setup + Foundational)
2. US1 + US2 together (both P1, share same rendering mechanism)
3. US3 (P2, robber swap adds complexity)
4. US4 (P2, card layout refinement)
5. US5 (P3, animation polish)
6. Phase 8 (verify everything)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks within same phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (the current code never renders `revealedCards`, so new tests will fail)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The root cause (per research.md) is that `renderGame()` never renders `privateView?.revealedCards` — the foundational phase fixes this
- Server engine (`engine.ts`) logic for `performSeerAction`, `performWolfAction`, `performRobberAction` is already correct and does not need modification
- All Socket.IO event names and Zod schemas in `src/shared/contracts.ts` remain unchanged
- Card flip animation uses pure CSS 3D transforms — zero new dependencies
