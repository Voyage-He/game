# Quickstart: 延展行动时间至 20 秒以上

**Feature**: 006-extend-action-time
**Date**: 2026-05-23

## Overview

将技能行动阶段倒计时从 5-10 秒统一延长至 20 秒。一行代码变更（5 个数值）。

## Quick Verification

```bash
# 构建
npm run build

# 运行单元测试（验证新时长）
npm test

# 开发模式启动，观察倒计时从 20 秒开始
npm run dev
```

## Changes

| 文件 | 改动 |
|---|---|
| `src/shared/types.ts` | `DEFAULT_PHASE_DURATIONS_MS` 中 `wolf_action`、`seer_action`、`robber_action`、`troublemaker_action`、`water_ghost_action` 的值从 5000/10000 改为 20000 |
| `tests/unit/timers.test.ts` | 更新对应断言 |

## What to Verify

1. 启动游戏，进入任意技能行动阶段 → 倒计时显示 ≥ 20 秒
2. `close_eyes` 阶段仍为 5 秒
3. `voting` 阶段仍为 60 秒
4. 倒计时归零后阶段正常推进
5. 点击卡牌提交行动后倒计时继续不重置

## No Breaking Changes

- Socket.IO 事件不变
- 客户端代码不变
- API 不变
- 游戏规则不变
