# Implementation Plan: 每个身份行动时间至少 20 秒以上

**Branch**: `001-online-room-game` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-min-action-time-20s/spec.md`

## Summary

确保 5 个技能行动阶段（狼人、预言家、强盗、捣蛋鬼、水鬼）的默认倒计时不低于 20 秒（≥ 20000ms），非技能阶段（close_eyes 5s、open_eyes 1s、voting 60s）保持不变。该需求由 Spec 006 实现，当前代码已满足全部要求：`DEFAULT_PHASE_DURATIONS_MS` 中 5 个技能阶段均为 20000ms，客户端通过服务端 `phaseEndsAt` 时间戳展示倒计时。

Spec 007 在 006 的基础上将语义从"精确 20s"细化为"至少 20s"（≥），强调最低保障而非固定值，为未来差异化调高时长留出空间。当前实现完全满足两版规格。

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ LTS-compatible runtime; browser client targets modern evergreen browsers.

**Primary Dependencies**: Express for HTTP/static serving; Socket.IO for room-scoped real-time events; Vite for frontend bundling; Zod for runtime payload validation and shared contract schemas.

**Storage**: In-memory room store only. Active rooms, nicknames, game state, reconnect-token hashes, and transient chat delivery data are temporary and deleted or discarded after settlement or all players leaving. Phase durations are compile-time constants, not persisted.

**Testing**: Vitest for deterministic unit and integration tests; Playwright for three-browser end-to-end room flows. All 83 tests pass with current 20000ms configuration.

**Target Platform**: Self-hosted public-internet Node.js service on Linux, normally behind an HTTPS reverse proxy; browser clients on desktop and mobile web.

**Project Type**: Single TypeScript web application with one backend service, one browser frontend, and shared TypeScript contracts.

**Performance Goals**: No change from baseline. 2-second state update target unaffected — longer phases mean more idle time between phases, not more server work.

**Constraints**: Server-authoritative game state; three-player invite-only rooms; no accounts, public lobby, matchmaking, spectators, persistent history, custom artwork, or nonessential animations. All constraints maintained.

**Scale/Scope**: Same as existing — small self-hosted friend groups with many independent one-game rooms.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Required Gates

- **服务端权威与规则一致性**: ✅ PASS — `DEFAULT_PHASE_DURATIONS_MS` 是服务端共享常量，所有阶段计时由服务端 `engine.setPhase()` 基于此值计算 `phaseEndsAt`。客户端通过 `remainingSecondsForDeadline()` 基于服务端时间戳展示倒计时，不自行决定阶段时长。当前 20000ms 值满足 ≥ 20s 要求，权威性不变。

- **临时数据与隐私最小化**: ✅ PASS — 本次变更不引入新数据。倒计时是已有的纯计算属性（`phaseStartedAt` + duration），不在数据库或文件中持久化。无隐私数据变更。结算或全员离开后数据清理行为不变。

- **测试先行与契约可验证**: ✅ PASS — `tests/unit/timers.test.ts` 已包含 ≥ 20000ms 断言（T001、T002）及非行动阶段值不变断言（T004）。E2E `three-player-game.spec.ts` 基于服务端时间戳自动适配。所有 83 个测试通过。

- **简洁自托管架构**: ✅ PASS — 零新依赖、零新服务、零新存储、零新文件。仅共享常量中的一个对象值（由 Spec 006 完成修改）。无架构变更。

- **清晰中文体验与实时可用性**: ✅ PASS — 倒计时中文提示（"剩余 XX 秒"）保持不变。实时状态更新频率和延迟目标不受影响。玩家获得更充裕的操作时间。

### Initial Gate

| Gate | Status |
|------|--------|
| 服务端权威与规则一致性 | ✅ PASS |
| 临时数据与隐私最小化 | ✅ PASS |
| 测试先行与契约可验证 | ✅ PASS |
| 简洁自托管架构 | ✅ PASS |
| 清晰中文体验与实时可用性 | ✅ PASS |

**Result**: All five gates PASS. No Complexity Tracking entries needed. Implementation already complete (inherited from Spec 006).

### Post-Design Gate

Re-evaluated after Phase 1 design (research.md, data-model.md, contracts/, quickstart.md):

- **服务端权威与规则一致性**: ✅ PASS — 唯一权威点 `DEFAULT_PHASE_DURATIONS_MS`（`src/shared/types.ts`）已包含 20000ms 值。服务端 `engine.ts:setPhase()` 使用它计算 `phaseEndsAt`。客户端 `client/state.ts:remainingSecondsForDeadline()` 基于 `phaseEndsAt` 展示。权威性明确。

- **临时数据与隐私最小化**: ✅ PASS — 无新增数据实体。阶段时长是纯编译时常量。

- **测试先行与契约可验证**: ✅ PASS — `timers.test.ts` 覆盖 T001（精确 20000ms）、T002（≥ 20000ms）、T004（非行动阶段不变）。E2E 完整三人流程覆盖。`PHASE_TIME_SCALE` 缩放机制不变。

- **简洁自托管架构**: ✅ PASS — 无架构变更。

- **清晰中文体验与实时可用性**: ✅ PASS — 无 UI 文案变更。中文 "剩余 XX 秒" 格式不变。

**Post-Design Gate Result**: All five gates PASS. Design artifacts consistent with implementation.

## Project Structure

### Documentation (this feature)

```text
specs/007-min-action-time-20s/
├── plan.md              # This file
├── research.md          # Phase 0 output — current implementation state
├── data-model.md        # Phase 1 output — DEFAULT_PHASE_DURATIONS_MS values
├── quickstart.md        # Phase 1 output — verification steps
├── contracts/           # Phase 1 output — zero interface changes
│   └── README.md        # Confirms no contract changes
├── checklists/
│   └── requirements.md  # Spec quality validation (all pass)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/shared/types.ts           # [ALREADY MODIFIED by Spec 006] DEFAULT_PHASE_DURATIONS_MS = 20000ms
tests/unit/timers.test.ts     # [ALREADY MODIFIED by Spec 006] ≥ 20000ms assertions
```

**Structure Decision**: Zero new files. Implementation already complete. Spec 007 refines requirement semantics from "exactly 20s" to "at least 20s", which the current 20000ms value satisfies. No code changes required.

## Complexity Tracking

> No violations — this section intentionally left empty.
