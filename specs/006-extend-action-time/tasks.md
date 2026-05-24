# Tasks: 延展行动时间至 20 秒以上

**Input**: Design documents from `/specs/006-extend-action-time/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are REQUIRED for timer/phase changes. Tests touch the constitution gates: 服务端权威与规则一致性, 测试先行与契约可验证.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

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
- Runtime docs: `README.md`, feature quickstarts under `specs/006-extend-action-time/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify baseline — project builds and existing tests pass before any changes

- [x] T001 Run `npm run build` to confirm project compiles cleanly from current state
- [x] T002 Run `npm test` to confirm all existing unit tests pass (baseline snapshot)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No new infrastructure needed. This feature changes only an existing constant. Confirm understanding of current values.

- [x] T003 Review current `DEFAULT_PHASE_DURATIONS_MS` values in `src/shared/types.ts` and note the 5 action-phase values to change (wolf_action: 10000, seer_action: 10000, robber_action: 10000, troublemaker_action: 5000, water_ghost_action: 5000)
- [x] T004 [P] Review `tests/unit/timers.test.ts` existing test cases for timer stale-timeout guards — confirm these are not affected by duration changes

**Checkpoint**: Current state understood. Ready to begin user story work.

---

## Phase 3: User Story 1 - 技能行动阶段有充足时间操作 (Priority: P1) 🎯 MVP

**Goal**: All 5 skill action phases (wolf_action, seer_action, robber_action, troublemaker_action, water_ghost_action) have a default countdown of ≥ 20000ms (20 seconds).

**Independent Test**: Run `npm test` — unit tests assert each action phase = 20000ms. Start a game with `npm run dev` and observe countdown starts at 20s for each action phase, decrements each second, and auto-advances at zero.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST. They MUST fail (expecting 20000, but current values are 5000/10000) before implementation.**

- [x] T005 [P] [US1] Add unit test asserting wolf_action, seer_action, robber_action, troublemaker_action, water_ghost_action each equal 20000 in `tests/unit/timers.test.ts`
- [x] T006 [P] [US1] Add unit test asserting all 5 action phases return ≥ 20000ms via loop in `tests/unit/timers.test.ts`
- [x] T007 [US1] Run `npm test` and verify T005/T006 FAIL (current values are 5000 or 10000, not 20000)

### Implementation for User Story 1

- [x] T008 [US1] Update `wolf_action` from 10000 to 20000 in `DEFAULT_PHASE_DURATIONS_MS` in `src/shared/types.ts`
- [x] T009 [US1] Update `seer_action` from 10000 to 20000 in `DEFAULT_PHASE_DURATIONS_MS` in `src/shared/types.ts`
- [x] T010 [US1] Update `robber_action` from 10000 to 20000 in `DEFAULT_PHASE_DURATIONS_MS` in `src/shared/types.ts`
- [x] T011 [US1] Update `troublemaker_action` from 5000 to 20000 in `DEFAULT_PHASE_DURATIONS_MS` in `src/shared/types.ts`
- [x] T012 [US1] Update `water_ghost_action` from 5000 to 20000 in `DEFAULT_PHASE_DURATIONS_MS` in `src/shared/types.ts`
- [x] T013 [US1] Run `npm test` and verify T005/T006 now PASS (all 5 action phases = 20000ms)

**Checkpoint**: User Story 1 complete — all 5 action phases now have 20s default countdown. Unit tests pass.

---

## Phase 4: User Story 2 - 非行动阶段时长不受影响 (Priority: P2)

**Goal**: Non-action phases (close_eyes: 5s, open_eyes: 1s, voting: 60s, free_speech: unlimited, settlement: unlimited) remain unchanged after the US1 constant modifications.

**Independent Test**: Run `npm test` — unit test asserts close_eyes=5000, open_eyes=1000, voting=60000. Visually verify in `npm run dev` that close_eyes shows 5s and voting shows 60s.

### Tests for User Story 2 ⚠️

- [x] T014 [P] [US2] Add unit test asserting close_eyes = 5000, open_eyes = 1000, voting = 60000 in `tests/unit/timers.test.ts`
- [x] T015 [US2] Run `npm test` and verify T014 PASSES (non-action phase values are unchanged)

### Implementation for User Story 2

- [x] T016 [US2] Verify `close_eyes` is still 5000 in `DEFAULT_PHASE_DURATIONS_MS` in `src/shared/types.ts` (no change needed — confirmation only)
- [x] T017 [US2] Verify `open_eyes` is still 1000 in `DEFAULT_PHASE_DURATIONS_MS` in `src/shared/types.ts` (no change needed — confirmation only)
- [x] T018 [US2] Verify `voting` is still 60000 in `DEFAULT_PHASE_DURATIONS_MS` in `src/shared/types.ts` (no change needed — confirmation only)

**Checkpoint**: User Story 2 complete — non-action phase durations confirmed unchanged. All unit tests pass.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation — build, full test suite, E2E, edge case verification

- [x] T019 Run `npm run build` to confirm clean compilation after all constant changes
- [x] T020 Run `npm test` to confirm all unit tests pass (action phase assertions + non-action phase assertions + stale-timeout guards)
- [x] T021 [P] Run `npm run test:e2e` to verify three-player game flows still complete successfully with extended phase durations
- [x] T022 [P] Verify edge case: countdown reaches zero and phase auto-advances (already covered by stale-timeout tests in T004)
- [x] T023 [P] Verify edge case: `PHASE_TIME_SCALE` environment variable still applies correctly to all phases (set `PHASE_TIME_SCALE=0.1` and verify action phases become 2s, not 0.5s/1s)
- [x] T024 Verify Chinese countdown display "剩余 XX 秒" shows correct values in browser (open `npm run dev` and observe countdown during each action phase)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify baseline immediately
- **Foundational (Phase 2)**: Depends on Setup completion — confirms current state
- **User Story 1 (Phase 3)**: Depends on Foundational — actual constant changes
- **User Story 2 (Phase 4)**: Depends on US1 completion (must verify after values are changed)
- **Polish (Phase 5)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on US2.
- **User Story 2 (P2)**: Depends on US1 completion (verification that non-action phases survived the US1 constant changes).

### Within Each User Story

- Constitution-required tests MUST be written and FAIL before implementation (US1: T005-T007)
- Constants updated after tests confirmed failing (US1: T008-T012)
- Tests rerun and verified passing after implementation (US1: T013)
- For US2: tests confirm no regression (T014-T015), then verification-only tasks (T016-T018)

### Parallel Opportunities

- T001 and T002 can run in parallel (build + test baseline)
- T003 and T004 can run in parallel (review types + review existing tests)
- T005 and T006 can run in parallel (both add test cases to same file — but note: same file conflicts; consider sequential or careful merge)
- T008 through T012 are separate lines in the same file — can be done as a single edit
- T014 can run in parallel with T008-T012 (different test block)
- T021, T022, T023 can run in parallel (different verification commands/tests)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch both test additions for User Story 1 (same file — write both test blocks together):
# Task T005: "Add unit test asserting 5 action phases = 20000 in tests/unit/timers.test.ts"
# Task T006: "Add unit test asserting all 5 action phases ≥ 20000ms via loop in tests/unit/timers.test.ts"

# After tests written (and confirmed failing), apply all 5 constant changes as one edit:
# Task T008-T012: "Update all 5 action phase values to 20000 in src/shared/types.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002) — baseline verification
2. Complete Phase 2: Foundational (T003-T004) — review current state
3. Complete Phase 3: User Story 1 (T005-T013) — tests + constant changes
4. **STOP and VALIDATE**: `npm test` passes, countdown shows ≥20s in browser
5. MVP is ready — deploy if desired

### Incremental Delivery

1. Setup + Foundational → Baseline confirmed
2. Add User Story 1 (T005-T013) → Action phases now 20s → Test → **MVP!**
3. Add User Story 2 (T014-T018) → Verify non-action phases unchanged → Test
4. Polish (T019-T024) → Full build, E2E, edge cases → **GA Ready**

### Single Developer Strategy

With one developer (the typical case for this minimal feature):

1. T001-T004: Setup and review (sequential, ~2 min)
2. T005-T006: Write failing tests (one file, write both test blocks together)
3. T007: `npm test` — confirm tests fail
4. T008-T012: Edit `DEFAULT_PHASE_DURATIONS_MS` (one edit, 5 lines)
5. T013: `npm test` — confirm tests pass
6. T014: Add non-action phase test assertions
7. T015-T018: Verify and confirm non-action phases unchanged
8. T019-T024: Final build + E2E + edge case verification

**Total estimated effort**: ~15 minutes for a developer familiar with the codebase.

---

## Notes

- All changes are to existing files only — zero new files created
- T008-T012 are conceptually one edit (5 lines in the same constant object); they're listed separately for traceability to FR-001 through FR-005
- US2 is verification-only (the spec requires non-action phases stay unchanged, which they do by default since only action phase values are modified)
- E2E tests (T021) may take longer to run than unit tests, but the behavioral change is automatic — countdown assertions use server-provided timestamps
- [P] tasks marked as parallelizable are on different concerns (different test blocks, different verification steps) — but since this is a 2-file change, most tasks run sequentially in practice
- Commit after T013 (US1 complete) and again after T024 (all phases complete)
