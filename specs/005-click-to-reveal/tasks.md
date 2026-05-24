# Tasks: 点击卡牌直接翻转揭示身份

**Input**: Design documents from `/specs/005-click-to-reveal/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/card-click-events.md, quickstart.md

**Tests**: Required for card clickability rendering, selection state management, click event contracts, privacy boundaries, and partial-selection auto-action fallback. Write tests before verifying implementation; they should fail when run against the pre-change code.

**Organization**: All client-side implementation resides in shared files (`state.ts`, `game.ts`, `util.ts`, `main.css`, `main.ts`) and must be done together in Foundational (Phase 2). Each user story phase adds independent tests validating that role's specific click behavior. Server code requires zero modifications.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Backend files: `src/server/` — **no changes needed**
- Browser client files: `src/client/`
- Shared contracts/types: `src/shared/` — **no changes needed**
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project initialization needed — the project is already configured with Vite, Socket.IO client, Vitest, and Playwright. This feature adds zero new dependencies.

*No tasks in this phase.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Client-side scaffolding that ALL user stories depend on: selection state model, prompt text helpers, CSS for clickable/selected/submitted states, prompt-only action panel rendering, CSS class assignment on card elements, and card click event delegation. All implementation is in this phase because the four source files are shared across all roles.

**⚠️ CRITICAL**: No user story testing can begin until this phase is complete.

### Implementation

- [x] T001 [P] Add `SelectionState` interface and fields (`actionSubmitted`, `seerActionMode`, `seerUnderwaterClicked`, `troublemakerSelected`) to `ClientStateSnapshot` in `src/client/state.ts`. Initialize defaults in constructor and add clear-on-phase-change logic in the `state:private` handler (clear when `revealedCards.length === 0` or `currentEligibleAction === null`).
- [x] T002 [P] Add click prompt text constants and `getActionPrompt(phase, selectionState)` / `getSelectionProgress(phase, selectionState)` helper functions in `src/client/views/util.ts`. Map every role phase to a Chinese prompt per the research.md §3 table (e.g., "请点击一张水下牌查看身份" for wolf_action, "已查看 1/2 张水下牌" for seer progress).
- [x] T003 [P] Add CSS classes in `src/client/styles/main.css`: `.card.clickable` (`cursor: pointer`, `:hover` with `transform: scale(1.03)` + enhanced `box-shadow`, `transition` 0.15s ease), `.card.selected` (blue glow border `box-shadow: 0 0 0 3px #2454d6`), `.card.submitted` (`pointer-events: none` + `opacity: 0.6`), and `.card.clickable:active` (brief `scale(0.97)`).
- [x] T004 Replace button-based `renderActionPanel()` in `src/client/views/game.ts` with a prompt-only panel. Remove all `<button data-action=...>` generation. Each `case` in the switch now renders: the role action title (from `ROLE_ACTION_LABELS`), the Chinese prompt text (from util.ts helpers), the countdown timer, and selection progress (for seer underwater count, troublemaker selection count). Keep the `actionWrapper()` layout but remove its `buttons` parameter.
- [x] T005 Add card clickability CSS class logic to `renderPlayerCard()` and `renderUnderwaterCards()` in `src/client/views/game.ts`. Based on `currentEligibleAction` and `selectionState`, add: `.clickable` class to eligible card elements (e.g., underwater cards during wolf_action, other players' cards during robber_action), `.selected` class for troublemaker-selected cards and seer-clicked underwater cards, `.submitted` class on all cards when `actionSubmitted` is true.
- [x] T006 Implement `bindCardClickHandlers()` in `src/client/views/game.ts`. Add delegated `click` listeners on `.underwater-cards-grid` and `.players-grid`. The handler must: (a) identify clicked card via `event.target.closest()`, (b) read `data-seat-index` or `data-underwater-index`, (c) check `currentEligibleAction` and `selectionState` guards per the contracts document, (d) manage multi-step selection state (seer underwater mode lock, troublemaker select/deselect), (e) emit the correct `action:*` event via `clientState.sendRoleAction()`, (f) set `actionSubmitted = true` on submission. Export this function.
- [x] T007 Wire card click binding into `src/client/main.ts`. In `bindGameControls()`, remove the `[data-action]` button listener loop and replace with a call to `bindCardClickHandlers()`.

**Checkpoint**: Foundation ready — all cards render with appropriate `.clickable`/`.selected`/`.submitted` CSS classes, the action panel shows Chinese prompts (no buttons), and clicking cards triggers the correct Socket.IO events. User story testing can now begin.

---

## Phase 3: User Story 1 — 狼人点击水下牌直接翻转查看 (Priority: P1) 🎯 MVP

**Goal**: Wolf player clicks an underwater card to immediately flip it and see its identity. Single-step click, no multi-step selection needed.

**Independent Test**: In a three-player game, the wolf player clicks any underwater card during wolf_action → the card flips with animation, shows the correct role, and no further cards are clickable. Non-wolf players' clicks produce no response.

### Tests for User Story 1 ⚠️

> Write these tests AFTER Phase 2 implementation is complete. Verify they pass against the new card-click rendering.

- [x] T008 [P] [US1] Unit test: underwater cards have `.clickable` class during wolf_action for the acting player, and no `.clickable` after action submitted, in `tests/unit/game-view.test.ts`
- [x] T009 [P] [US1] Unit test: wolf action panel shows prompt "请点击一张水下牌查看身份" (no buttons), in `tests/unit/game-view.test.ts`
- [x] T010 [P] [US1] E2E test: wolf player clicks an underwater card → card flips with animation → identity shown, in `tests/e2e/three-player-game.spec.ts`
- [x] T011 [P] [US1] E2E test: non-acting player clicks underwater cards during wolf_action → no response, no flip, in `tests/e2e/three-player-game.spec.ts`

**Checkpoint**: Wolf card click works end-to-end — MVP functional. The simplest role (single-click, one target type) validates the entire card-click interaction model.

---

## Phase 4: User Story 2 — 预言家点击卡牌翻转查看 (Priority: P1)

**Goal**: Seer can either click another player's card (immediate flip + action complete) OR click up to two distinct underwater cards (each flips immediately, second click completes action). First click locks the mode — cannot switch between player and underwater paths.

**Independent Test**: In a three-player game, seer (a) clicks a player card → card flips, action done; (b) clicks underwater card 1 → flips, clicks underwater card 2 → flips, action done. Verify mode lock: clicking underwater first then trying player card has no effect, and vice versa.

### Tests for User Story 2 ⚠️

- [x] T012 [P] [US2] Unit test: seer underwater mode — first click on underwater card adds `.selected` but does not show panel progress text until render, in `tests/unit/game-view.test.ts`
- [x] T013 [P] [US2] Unit test: seer underwater mode — second distinct click shows progress "已查看 2/2 张水下牌" and action panel reflects submitted state, in `tests/unit/game-view.test.ts`
- [x] T014 [P] [US2] Unit test: seer player mode — clicking a player card in seer_action emits `action:seer` with `mode: 'view_one_player'` payload, in `tests/unit/game-view.test.ts`
- [x] T015 [P] [US2] Unit test: seer mode lock — after clicking underwater card, other player cards lose `.clickable`; after clicking player card, underwater cards lose `.clickable`, in `tests/unit/game-view.test.ts`
- [x] T016 [P] [US2] Unit test: seer cannot click a third underwater card after two already clicked, in `tests/unit/game-view.test.ts`
- [x] T017 [P] [US2] E2E test: seer clicks two underwater cards in sequence → both flip with animation → panel shows "已查看 1/2" then "已查看 2/2", in `tests/e2e/three-player-game.spec.ts`
- [x] T018 [P] [US2] E2E test: seer clicks a player card → card flips immediately → action completes (no further clicks accepted), in `tests/e2e/three-player-game.spec.ts`
- [x] T019 [P] [US2] Integration test: countdown expiry during partial seer underwater selection (1 of 2 clicked) → server auto-action completes → client receives partial reveal preserved, in `tests/integration/socket-flow.test.ts`

**Checkpoint**: Seer card click works in both player and underwater modes with mode locking and countdown resilience. Both P1 user stories (wolf + seer) now complete.

---

## Phase 5: User Story 3 — 强盗点击玩家卡牌翻转查看并交换 (Priority: P2)

**Goal**: Robber clicks another player's card to flip it, see the role, and trigger identity swap. Single-step click.

**Independent Test**: In a three-player game, robber clicks another player's card → card flips showing role → robber's own identity card updates to the target's original role after swap.

### Tests for User Story 3 ⚠️

- [x] T020 [P] [US3] Unit test: robber action panel shows prompt "请点击一名其他玩家的卡牌查看并交换身份" and own player card lacks `.clickable`, in `tests/unit/game-view.test.ts`
- [x] T021 [P] [US3] E2E test: robber clicks target player card → card flips showing role → robber's own displayed identity updates after swap, in `tests/e2e/three-player-game.spec.ts`

**Checkpoint**: Robber card click works. P2 stories begin.

---

## Phase 6: User Story 4 — 捣蛋鬼和水鬼点击卡牌选择交换目标 (Priority: P2)

**Goal**: Troublemaker selects two other players by clicking their cards (first click selects, second different click submits; re-clicking selected card deselects it). Water Ghost clicks one underwater card to select it (immediate submit). No identity flip — these are selection-only actions.

**Independent Test**: Troublemaker clicks player A (highlighted), clicks player B (both highlighted, action submitted). Re-clicking player A deselects it. Water Ghost clicks an underwater card (highlighted, action submitted).

### Tests for User Story 4 ⚠️

- [x] T022 [P] [US4] Unit test: troublemaker first click adds `.selected` class to target card, second different click triggers submission, re-clicking selected card removes `.selected`, in `tests/unit/game-view.test.ts`
- [x] T023 [P] [US4] Unit test: troublemaker cannot select own card (no `.clickable` on self), in `tests/unit/game-view.test.ts`
- [x] T024 [P] [US4] Unit test: water ghost action panel shows prompt "请点击一张水下牌进行交换" and only underwater cards have `.clickable`, in `tests/unit/game-view.test.ts`
- [x] T025 [P] [US4] Unit test: troublemaker action panel shows selection progress "已选择 1/2 名玩家，请选择第二名玩家" after first pick, in `tests/unit/game-view.test.ts`
- [x] T026 [P] [US4] E2E test: troublemaker clicks two players → both highlight → swap submits → action panel reflects completion, in `tests/e2e/three-player-game.spec.ts`
- [x] T027 [P] [US4] E2E test: water ghost clicks underwater card → card highlights → action submits, in `tests/e2e/three-player-game.spec.ts`

**Checkpoint**: Troublemaker and Water Ghost card click interactions work with selection/deselection and progress feedback. All five role skills now use card click.

---

## Phase 7: User Story 5 — 卡牌可点击视觉反馈 (Priority: P3)

**Goal**: Verify that hover/active visual feedback works correctly on clickable cards and is absent on non-clickable cards. Ensure cursor changes, scale effects, and submitted-state dimming behave as specified.

**Independent Test**: Hover over a clickable card → cursor becomes pointer, card scales up. Hover over non-clickable card → no effect. Click → card dims (.submitted). On mobile touch, card shows active press feedback.

### Tests for User Story 5 ⚠️

- [x] T028 [P] [US5] Unit test: card elements with `.clickable` class render with `cursor: pointer` (verify CSS class presence on rendered HTML), in `tests/unit/game-view.test.ts`
- [x] T029 [P] [US5] Unit test: after `actionSubmitted` is true, all card elements lack `.clickable` and instead carry `.submitted` class, in `tests/unit/game-view.test.ts`
- [x] T030 [P] [US5] E2E test: hovering over a clickable card shows cursor change and scale effect; hovering over non-clickable card shows default cursor, in `tests/e2e/three-player-game.spec.ts`

**Checkpoint**: Visual feedback works for all card click scenarios across all roles.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cross-role validation, edge cases, and final verification.

- [x] T031 [P] Unit test: phase change clears all selection state — cards rendered after phase change lack `.selected` and `.clickable`, in `tests/unit/game-view.test.ts`
- [x] T032 [P] Unit test: non-acting player during any role phase sees no `.clickable` cards and action panel shows "其他玩家行动中", in `tests/unit/game-view.test.ts`
- [x] T033 [P] E2E test: after phase transitions, previously clickable cards become non-clickable, in `tests/e2e/three-player-game.spec.ts`
- [x] T034 [P] E2E test: player disconnect + reconnect during action phase → card click still works if phase active, cards non-clickable if action already submitted, in `tests/e2e/three-player-game.spec.ts`
- [x] T035 Run `npm run build` to verify no TypeScript compilation errors
- [x] T036 Run `npm test` (Vitest unit + integration) and verify all tests pass
- [x] T037 Run `npm run test:e2e` (Playwright) and verify all E2E tests pass
- [x] T038 Verify quickstart.md checklist: `npm run dev` starts without errors, manual smoke test of all five role card-click flows

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — starts immediately. BLOCKS all user story phases.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2). Independent of US1 — tests run in separate describe blocks.
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2). Independent of US1/US2.
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2). Independent of US1/US2/US3.
- **User Story 5 (Phase 7)**: Depends on Foundational (Phase 2). CSS is already in place from Phase 2; these tests verify behavior.
- **Polish (Phase 8)**: Depends on all user stories being complete.

### User Story Dependencies

All user stories are **independent** of each other after Foundational completes. They share no per-story implementation code — only the foundational rendering pipeline. Each can be tested in isolation:

- **US1 (Wolf)**: Tests verify wolf_action click behavior only
- **US2 (Seer)**: Tests verify seer_action multi-path click behavior only
- **US3 (Robber)**: Tests verify robber_action click behavior only
- **US4 (Troublemaker/Water Ghost)**: Tests verify troublemaker_action and water_ghost_action click behavior only
- **US5 (Visual Feedback)**: Tests verify CSS class presence/absence across all phases

### Within Each User Story

- Unit tests before E2E tests
- All tests marked [P] within a story can run in parallel
- Tests validate the Phase 2 implementation; no additional implementation needed per story

### Parallel Opportunities

- **Within Phase 2**: T001, T002, T003 are independent files → all three can run in parallel. T004, T005, T006 in game.ts must be sequential but T004→T005→T006 can be done as a single cohesive edit to game.ts.
- **Within Phase 3-7**: All tasks marked [P] in these phases can run in parallel (different test files or independent test cases in the same file).
- **Across Phases 3-7**: If multiple developers are available, all five user story test phases can run in parallel after Phase 2 completes.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch independent file changes in parallel:
Task: "Add SelectionState to ClientStateSnapshot in src/client/state.ts"           # T001
Task: "Add click prompt text constants in src/client/views/util.ts"                # T002
Task: "Add card click interaction CSS in src/client/styles/main.css"              # T003

# Then sequential game.ts changes:
Task: "Replace button-based action panel in src/client/views/game.ts"             # T004
Task: "Add card clickable CSS class logic in src/client/views/game.ts"            # T005
Task: "Implement bindCardClickHandlers in src/client/views/game.ts"               # T006

# Finally wire into main.ts:
Task: "Wire card click binding into src/client/main.ts"                           # T007
```

## Parallel Example: User Story 2 (Seer)

```bash
# All seer unit tests can be written and run in parallel:
Task: "Seer underwater first click test in tests/unit/game-view.test.ts"           # T012
Task: "Seer underwater second click test in tests/unit/game-view.test.ts"          # T013
Task: "Seer player mode test in tests/unit/game-view.test.ts"                     # T014
Task: "Seer mode lock test in tests/unit/game-view.test.ts"                       # T015
Task: "Seer third card rejection test in tests/unit/game-view.test.ts"            # T016
Task: "Seer countdown expiry integration test in tests/integration/socket-flow.test.ts" # T019

# E2E tests in parallel:
Task: "Seer two underwater cards E2E in tests/e2e/three-player-game.spec.ts"      # T017
Task: "Seer player card E2E in tests/e2e/three-player-game.spec.ts"               # T018
```

---

## Implementation Strategy

### MVP First (Phase 2 + Phase 3 Only)

1. Complete Phase 2: Foundational (all client-side implementation)
2. Complete Phase 3: User Story 1 (Wolf card click)
3. **STOP and VALIDATE**: Run `npm test` and `npm run test:e2e` — wolf card click works end-to-end
4. Deploy/demo if ready — this already proves the card-click interaction model

### Incremental Delivery

1. Phase 2: Foundational → Foundation ready
2. Phase 3: US1 (Wolf) → Test independently → MVP! 🎯
3. Phase 4: US2 (Seer) → Test independently → Most complex role now works
4. Phase 5: US3 (Robber) → Test independently
5. Phase 6: US4 (Troublemaker + Water Ghost) → Test independently
6. Phase 7: US5 (Visual Feedback) → Test independently
7. Phase 8: Polish → Final validation

Each story adds value without breaking previous stories — all use the same rendering pipeline built in Phase 2.

### Single Developer Strategy

1. Complete Phase 2 (all implementation) — this is the bulk of the work
2. Run through Phase 3-7 tests sequentially, fixing any issues found
3. Complete Phase 8 polish
4. All tests pass → done

### Multi-Developer Strategy

1. Developer A completes Phase 2 (Foundational — single cohesive unit)
2. Once Phase 2 is done:
   - Developer A: US1 + US2 tests (wolf + seer)
   - Developer B: US3 + US4 tests (robber + troublemaker/water ghost)
   - Developer C: US5 tests + Phase 8 polish
3. All test phases complete independently and merge cleanly

---

## Notes

- [P] tasks = different files or independent test cases, no mutual dependencies
- [Story] label maps task to specific user story for traceability
- Server code (`src/server/`) requires **zero modifications** — all Socket.IO event names and payload schemas remain unchanged
- Shared contracts (`src/shared/`) require **zero modifications**
- The `actionSubmitted` flag on the client prevents double-clicks; the server's `ACTION_WINDOW_CLOSED` check is the authoritative guard
- Phase transitions clear selection state automatically via existing `revealedCards.length === 0` signal in `state.ts`
- All prompt text is in Chinese per the constitution principle
- Commit after each task or logical group; verify builds pass before moving on
