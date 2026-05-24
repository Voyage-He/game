# Quickstart: 每个身份行动时间至少 20 秒以上

**Feature**: 007-min-action-time-20s | **Date**: 2026-05-23

## 前置条件

- Node.js 20+
- npm install
- 已通过 Spec 006 实现代码变更（`DEFAULT_PHASE_DURATIONS_MS` 已为 20000ms）

## 快速验证

### 1. 运行单元测试

```bash
npm test
```

预期输出：83 个测试全部通过，包括：
- `DEFAULT_PHASE_DURATIONS_MS > sets wolf_action, seer_action, robber_action, troublemaker_action, water_ghost_action to 20000ms` ✅
- `DEFAULT_PHASE_DURATIONS_MS > returns at least 20000ms for all action phases` ✅
- `DEFAULT_PHASE_DURATIONS_MS > keeps non-action-phase values unchanged` ✅

### 2. 启动服务并手动验证

```bash
npm run dev
```

1. 浏览器打开 `http://localhost:5173`（三个窗口模拟三名玩家）
2. 创建房间，三名玩家加入
3. 开始游戏，观察各阶段倒计时：
   - **close_eyes**: 5 秒 ✅
   - **wolf_action（狼人）**: 20 秒 ✅
   - **seer_action（预言家）**: 20 秒 ✅
   - **robber_action（强盗）**: 20 秒 ✅
   - **troublemaker_action（捣蛋鬼）**: 20 秒 ✅
   - **water_ghost_action（水鬼）**: 20 秒 ✅
   - **open_eyes**: 1 秒 ✅
   - **voting**: 60 秒 ✅

### 3. 验证边界情况

- **提前提交**：在倒计时 3 秒时完成卡牌点击提交，倒计时继续但不重置，归零后阶段正常推进
- **断线重连**：关闭一个浏览器标签页，重新打开并重连，倒计时显示与其他玩家一致
- **倒计时归零自动推进**：不进行任何操作等待倒计时归零，阶段自动切换

### 4. E2E 测试（可选）

```bash
npm run test:e2e
```

## 无代码变更说明

本功能（Spec 007）不需要任何代码变更。所有代码修改已在 Spec 006 中完成：

- `src/shared/types.ts`：`DEFAULT_PHASE_DURATIONS_MS` 中 5 个技能阶段值 = 20000ms
- `tests/unit/timers.test.ts`：断言包含 ≥ 20000ms 验证

Spec 007 的语义细化（从 "exactly 20s" → "at least 20s"）已通过现有测试 T002（`toBeGreaterThanOrEqual(20000)`）覆盖。
