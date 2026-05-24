# Data Model: 延展行动时间至 20 秒以上

**Feature**: 006-extend-action-time
**Date**: 2026-05-23

## Overview

本功能不引入新数据实体、不修改现有实体结构。唯一的变更是 `DEFAULT_PHASE_DURATIONS_MS` 常量中的 5 个数值。

## Existing Entity: DEFAULT_PHASE_DURATIONS_MS

这是一个静态常量对象，定义在 `src/shared/types.ts` 中，映射每个计时阶段到其默认毫秒数。

### Before

```typescript
export const DEFAULT_PHASE_DURATIONS_MS: Record<Exclude<Phase, 'free_speech' | 'settlement'>, number> = {
  close_eyes: 5000,
  wolf_action: 10000,
  seer_action: 10000,
  robber_action: 10000,
  troublemaker_action: 5000,
  water_ghost_action: 5000,
  open_eyes: 1000,
  voting: 60000
};
```

### After

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

### Usage

该常量在 `src/server/game/engine.ts` 的 `setPhase()` 函数中使用：

```typescript
const duration = DEFAULT_PHASE_DURATIONS_MS[phase];
room.phaseEndsAt = new Date(Date.now() + duration).toISOString();
```

客户端仅将其作为类型参考，不参与运行时计时。

## No New Entities

无需新增任何数据实体、接口或类型。
