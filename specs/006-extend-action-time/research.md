# Research: 延展行动时间至 20 秒以上

**Feature**: 006-extend-action-time
**Date**: 2026-05-23

## 1. Phase Duration Configuration

### Decision
修改 `src/shared/types.ts` 中 `DEFAULT_PHASE_DURATIONS_MS` 常量，将 5 个技能行动阶段的值改为 20000ms。

### Current Values

| 阶段 | 当前值 (ms) | 新值 (ms) |
|---|---|---|
| `close_eyes` | 5000 | 5000（不变） |
| `wolf_action` | 10000 | **20000** |
| `seer_action` | 10000 | **20000** |
| `robber_action` | 10000 | **20000** |
| `troublemaker_action` | 5000 | **20000** |
| `water_ghost_action` | 5000 | **20000** |
| `open_eyes` | 1000 | 1000（不变） |
| `voting` | 60000 | 60000（不变） |

### Rationale
- 用户要求 20 秒以上，20000ms 是满足 "≥ 20 秒" 的最小整数。
- 所有技能行动阶段统一设置为相同值，避免玩家对不同角色产生时长困惑。
- 非行动阶段（close_eyes, open_eyes, voting）的现有时长已经合理，无需调整。
- 客户端倒计时展示逻辑（`remainingSecondsForDeadline()` in `state.ts`）基于服务端下发的 `phaseEndsAt` 时间戳计算，与常量值无关，不需要任何修改。

### Alternatives Considered
- **差异化时长（狼人 25s、捣蛋鬼 15s 等）**: 增加玩家认知负担，且 spec 明确要求统一 20s+。
- **可配置环境变量**: 增加复杂度但当前无此需求。`PHASE_TIME_SCALE` 环境变量已存在用于测试缩放，可覆盖所有阶段。

## 2. Impact Analysis

### Server Impact
- `setPhase()` in `engine.ts` 使用 `DEFAULT_PHASE_DURATIONS_MS[phase]` 计算 `phaseEndsAt = Date.now() + duration`。新值自动生效。
- 倒计时到期逻辑（`checkPhaseTimeout()`）不变。
- 自动行动逻辑（`handleAutoAction()`）不变。
- Socket.IO 事件（`state:public`, `state:private`）不变。

### Client Impact
- 客户端通过 `phaseEndsAt` 计算剩余秒数，与新时长无关。无需修改。
- 倒计时展示 "剩余 XX 秒" 不变，仅 XX 的起始值变大。
- 卡牌点击交互（spec 005）有更充裕的操作时间。

### Test Impact
- `tests/unit/timers.test.ts`: 更新期望的阶段时长值。
- `tests/e2e/three-player-game.spec.ts`: `expectCountdownDecreases()` 和阶段等待时间直接利用服务端下发的倒计时，数值自动适配。

## 3. No External Dependencies

此变更为纯常量修改，不需要：
- 新 npm 包
- 新环境变量
- 配置文件
- 数据库迁移
- API 变更

## Summary of Changes

| File | Change | Lines |
|---|---|---|
| `src/shared/types.ts` | Update 5 values in `DEFAULT_PHASE_DURATIONS_MS` | 5 |
| `tests/unit/timers.test.ts` | Update expected duration assertions | ~10 |
| **Total** | | ~15 |
