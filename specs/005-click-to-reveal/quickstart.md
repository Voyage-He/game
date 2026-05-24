# Quickstart: 点击卡牌直接翻转揭示身份

**Feature**: 005-click-to-reveal
**Date**: 2026-05-23

## Overview

将技能行动面板中的按钮选择替换为直接点击卡牌交互。玩家在自己的技能行动阶段点击水下牌或玩家卡牌即可触发对应技能，无需通过按钮菜单。

## Prerequisites

- Node.js 20+
- 项目已按 spec 004 完成卡牌化 UI（`.player-card`、`.underwater-card`、CSS 3D 翻转动画）
- 运行 `npm install`

## Quick Verification

```bash
# 运行所有测试（含新增的卡牌点击测试）
npm test

# 运行端到端测试（需要三个浏览器上下文）
npm run test:e2e

# 开发模式启动
npm run dev
```

## Key Changes

### 文件修改清单

| 文件 | 改动 |
|---|---|
| `src/client/state.ts` | 新增 `SelectionState` 字段到 `ClientStateSnapshot` |
| `src/client/views/game.ts` | 移除按钮式 `renderActionPanel()`，新增基于 prompt 的行动面板；添加卡牌点击事件委托 |
| `src/client/views/util.ts` | 新增点击提示文案辅助函数 |
| `src/client/styles/main.css` | 新增 `.card.clickable`、`.card.selected`、`.card.submitted` 样式 |
| `src/client/main.ts` | 在 `bindGameControls()` 中调用卡牌点击绑定 |

### 服务端无需修改

`src/server/game/engine.ts`、`src/server/realtime/event-handlers.ts`、`src/server/game/visibility.ts`、`src/shared/contracts.ts` 均无变化。

## 玩家交互流程

### 狼人（单步点击）
1. 进入狼人行动阶段 → 水下牌显示 `cursor: pointer`，悬停时有放大效果
2. 点击任意一张水下牌 → 牌翻转，显示身份，行动完成
3. 其他卡牌不再可点击

### 预言家（双模式点击）
- **查看水下牌路径**：
  1. 点击第一张水下牌 → 立即翻转显示身份，面板显示"已查看 1/2 张水下牌"
  2. 点击第二张不同的水下牌 → 立即翻转显示身份，面板显示"已查看 2/2 张水下牌"，行动完成
- **查看玩家路径**：
  1. 点击任意其他玩家的卡牌 → 立即翻转显示该玩家身份，行动完成

> 首张点击即锁定模式。点击水下牌后不可再切换为查看玩家，反之亦然。

### 强盗（单步点击）
1. 点击其他任意玩家的卡牌 → 牌翻转展示该玩家身份
2. 身份交换在服务端自动完成，强盗自身卡牌身份更新

### 捣蛋鬼（两步选择）
1. 点击第一名其他玩家 → 该卡牌边框高亮，面板显示"已选择 1/2 名玩家"
2. 点击第二名其他玩家 → 两张卡牌均高亮，自动提交交换行动
3. 可再次点击已选中的卡牌取消选择

### 水鬼（单步点击）
1. 点击任意一张水下牌 → 该水下牌高亮，自动提交交换行动

## 视觉反馈说明

- **可点击卡牌**：悬停时 `cursor: pointer`，卡牌轻微放大（`scale(1.03)`）
- **选中卡牌**（捣蛋鬼/预言家水下）：蓝色发光边框
- **已提交**（点击后）：所有卡牌变暗，不可再点击
- **非行动阶段**：所有卡牌无悬停效果，`cursor: default`

## Reconnect Behavior

重连后：
- 若技能尚未提交 → 选择状态重置，可重新操作
- 若技能已完成 → 卡牌不可点击，已揭示的身份牌保持可见（当前阶段内）
- 阶段切换后 → 所有揭示状态清除

## Test Coverage

新增测试覆盖：
- 各技能卡牌点击触发正确事件（6个技能 × 正常路径）
- 非行动玩家点击无响应
- 点击后防重复提交
- 预言家两步水下选择（独立翻转 + 计数）
- 预言家模式锁定
- 捣蛋鬼两步选择 + 取消
- 阶段结束清空选择状态
- 悬停视觉反馈存在性
- E2E 完整点击交互流程
