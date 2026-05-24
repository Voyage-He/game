# Data Model: 每个身份行动时间至少 20 秒以上

**Feature**: 007-min-action-time-20s | **Date**: 2026-05-23

## Entity: 阶段时长配置 (Phase Duration Configuration)

### Definition

阶段时长配置是一个编译时常量对象 `DEFAULT_PHASE_DURATIONS_MS`，定义在 `src/shared/types.ts` 中，为每个有限时游戏阶段指定默认持续时间（毫秒）。

### Fields

| Field | Type | Value | Description |
|-------|------|-------|-------------|
| `close_eyes` | `number` | **5000** (5s) | 闭眼准备阶段 — 非技能阶段，保持不变 |
| `wolf_action` | `number` | **20000** (20s) | 狼人行动阶段 — ≥ 20s ✅ |
| `seer_action` | `number` | **20000** (20s) | 预言家行动阶段 — ≥ 20s ✅ |
| `robber_action` | `number` | **20000** (20s) | 强盗行动阶段 — ≥ 20s ✅ |
| `troublemaker_action` | `number` | **20000** (20s) | 捣蛋鬼行动阶段 — ≥ 20s ✅ |
| `water_ghost_action` | `number` | **20000** (20s) | 水鬼行动阶段 — ≥ 20s ✅ |
| `open_eyes` | `number` | **1000** (1s) | 睁眼过渡阶段 — 非技能阶段，保持不变 |
| `voting` | `number` | **60000** (60s) | 投票阶段 — 非技能阶段，保持不变 |

### TypeScript Type

```typescript
export const DEFAULT_PHASE_DURATIONS_MS: Record<Exclude<Phase, 'free_speech' | 'settlement'>, number> = {
  close_eyes: 5000,
  wolf_action: 20000,
  seer_action: 20000,
  robber_action: 20000,
  troublemaker_action: 20000,
  water_ghost_action: 20000,
  open_eyes: 1000,
  voting: 60000
};
```

### Validation Rules

1. **FR-001 ~ FR-005**: 5 个技能行动阶段（wolf_action, seer_action, robber_action, troublemaker_action, water_ghost_action）的值 MUST ≥ 20000
2. **FR-006**: 非技能阶段（close_eyes, open_eyes, voting）的值 MUST 保持不变（5000, 1000, 60000）
3. **测试断言**: `tests/unit/timers.test.ts` T001（精确值 20000）、T002（≥ 20000）、T004（非行动阶段不变）

### State Transitions

阶段时长配置本身是只读常量，运行时不变。其值通过以下路径影响游戏状态：

```
DEFAULT_PHASE_DURATIONS_MS
  → engine.getPhaseDurationMs(phase)          # 查询阶段时长
    → engine.setPhase(room, phase)             # 设置 phaseEndsAt = now + durationMs
      → Room.phaseEndsAt (ISO timestamp)      # 写入房间状态
        → PublicRoomView.phaseEndsAt          # 通过 Socket.IO 下发给客户端
          → client.remainingSecondsForDeadline() # 客户端计算剩余秒数
            → UI: "剩余 XX 秒"                # 玩家可见
```

### Relationship to PHASE_TIME_SCALE

运行时相位时长 = `DEFAULT_PHASE_DURATIONS_MS[phase] * PHASE_TIME_SCALE`（由 `RoomTimerService.engineOptions()` 应用）。`PHASE_TIME_SCALE` 默认为 1（不缩放），仅在测试环境中设为小数值以加速测试流程。

### 007 vs 006 Semantics

| Aspect | Spec 006 | Spec 007 |
|--------|----------|----------|
| Requirement | 设置为 ≥ 20000ms | 确保 ≥ 20000ms（最低保障） |
| Precision | Exact (20000ms) | At-least (≥ 20000ms) |
| Code value | 20000ms | 20000ms (satisfies ≥ constraint) |
| Future flexibility | 无明确指导 | 允许未来独立调高各阶段时长 |

**Result**: 当前 20000ms 实现完全满足两版规格。
