# Implementation Plan: 延展行动时间至 20 秒以上

**Branch**: `001-online-room-game` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-extend-action-time/spec.md`

## Summary

将 5 个技能行动阶段的默认倒计时从 5-10 秒统一延长至 20 秒（20000ms）：修改 `src/shared/types.ts` 中 `DEFAULT_PHASE_DURATIONS_MS` 常量的 5 个数值（`wolf_action`、`seer_action`、`robber_action`、`troublemaker_action`、`water_ghost_action` 从 5000/10000 → 20000）。服务端自动使用新值计算 `phaseEndsAt`，客户端通过已有的 `remainingSecondsForDeadline()` 展示倒计时。零新文件、零新依赖、零逻辑变更。

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ LTS-compatible runtime; browser client targets modern evergreen browsers.

**Primary Dependencies**: Express for HTTP/static serving; Socket.IO for room-scoped real-time events; Vite for frontend bundling; Zod for runtime payload validation and shared contract schemas.

**Storage**: In-memory room store only. Active rooms, nicknames, game state, reconnect-token hashes, and transient chat delivery data are temporary and deleted or discarded after settlement or all players leaving. No schema or data migration needed.

**Testing**: Vitest for deterministic unit and integration tests (`tests/unit/timers.test.ts` updated with new 20000ms assertions); Playwright E2E tests (`tests/e2e/three-player-game.spec.ts`) continue to pass with extended phases — countdown assertions use server-provided timestamps, adapting automatically.

**Target Platform**: Self-hosted public-internet Node.js service on Linux, normally behind an HTTPS reverse proxy; browser clients on desktop and mobile web.

**Project Type**: Single TypeScript web application with one backend service, one browser frontend, and shared TypeScript contracts.

**Performance Goals**: No change from baseline. 2-second state update target unaffected — longer phases mean more idle time between phases, not more server work. Timer scheduling unchanged.

**Constraints**: Server-authoritative game state; three-player invite-only rooms; no accounts, public lobby, matchmaking, spectators, persistent history, custom artwork, or nonessential animations. All constraints maintained.

**Scale/Scope**: Same as existing — small self-hosted friend groups with many independent one-game rooms. No load increase from this change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Required Gates

- **服务端权威与规则一致性**: ✅ PASS — `DEFAULT_PHASE_DURATIONS_MS` 是服务端共享常量，所有阶段计时由服务端 `setPhase()` 基于此值计算 `phaseEndsAt`。客户端只能展示服务端下发的时间戳，不自行决定阶段时长。修改常量仅影响服务端计时行为，客户端零修改。权威性无变化。

- **临时数据与隐私最小化**: ✅ PASS — 本次变更不引入新数据。倒计时是已有的纯计算属性（`phaseStartedAt` + duration），不在数据库中持久化。无隐私数据变更。结算或全员离开后数据清理行为不变。

- **测试先行与契约可验证**: ✅ PASS — 测试更新：(1) `tests/unit/timers.test.ts` 断言 5 个行动阶段 = 20000ms 且非行动阶段值不变，(2) E2E `three-player-game.spec.ts` 的 `expectCountdownDecreases()` 和阶段等待时间基于服务端时间戳自动适配。所有测试在当前代码状态下通过。

- **简洁自托管架构**: ✅ PASS — 零新依赖、零新服务、零新存储、零新文件。仅修改一个常量对象中的 5 个数值（约 5 行代码变更）和对应的测试断言（约 15 行）。

- **清晰中文体验与实时可用性**: ✅ PASS — 倒计时中文提示（"剩余 XX 秒"）保持不变。玩家获得更充裕的操作时间配合卡牌点击交互（spec 005）。实时状态更新频率和延迟目标不受影响 — `state:public`/`state:private` 事件格式不变，`phaseEndsAt` 值自动适配新时长。

### Initial Gate

| Gate | Status |
|------|--------|
| 服务端权威与规则一致性 | ✅ PASS |
| 临时数据与隐私最小化 | ✅ PASS |
| 测试先行与契约可验证 | ✅ PASS |
| 简洁自托管架构 | ✅ PASS |
| 清晰中文体验与实时可用性 | ✅ PASS |

**Result**: All five gates PASS. No Complexity Tracking entries needed.

### Post-Design Gate

Re-evaluated after Phase 1 design (research.md, data-model.md, contracts/, quickstart.md):

- **服务端权威与规则一致性**: ✅ PASS — 唯一变更点 `DEFAULT_PHASE_DURATIONS_MS` 位于 `src/shared/types.ts`，由服务端和客户端共同导入。服务端在 `engine.ts` 的 `setPhase()` 中使用它计算 `phaseEndsAt`，客户端仅用它做类型约束，实际倒计时展示基于服务端下发的 `phaseEndsAt` 时间戳。权威性不变。

- **临时数据与隐私最小化**: ✅ PASS — 无新增数据实体。所有现有清理逻辑不变。

- **测试先行与契约可验证**: ✅ PASS — `timers.test.ts` 已更新为 20000ms 断言；E2E 测试覆盖完整三人流程；`PHASE_TIME_SCALE` 环境变量机制不变。

- **简洁自托管架构**: ✅ PASS — 无架构变更。5 行常量修改 + 测试断言更新。

- **清晰中文体验与实时可用性**: ✅ PASS — 无 UI 文案变更。中文提示保持 "剩余 XX 秒"，仅 XX 起始值从 5/10 变为 20。

**Post-Design Gate Result**: All five gates PASS. No regressions introduced.

## Project Structure

### Documentation (this feature)

```text
specs/006-extend-action-time/
├── plan.md              # This file
├── research.md          # Phase 0 output — phase duration values and impact analysis
├── data-model.md        # Phase 1 output — before/after constant values
├── quickstart.md        # Phase 1 output — verification steps
├── contracts/           # Phase 1 output — no contract changes (README.md)
│   └── README.md        # Confirms zero interface changes
├── checklists/
│   └── requirements.md  # Spec quality validation (all pass)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/shared/types.ts           # [MODIFY] 5 values in DEFAULT_PHASE_DURATIONS_MS
tests/unit/timers.test.ts     # [MODIFY] Update expected duration assertions
```

**Structure Decision**: Zero new files. Only one line-change per phase duration (5 lines) plus test assertion updates (~15 lines). No contract changes, no new types, no API modifications.

## Complexity Tracking

> No violations — this section intentionally left empty.
