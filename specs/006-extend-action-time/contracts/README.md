# Contracts: 延展行动时间至 20 秒以上

**Feature**: 006-extend-action-time
**Date**: 2026-05-23

## No Contract Changes

本功能不修改任何 HTTP、Socket.IO 或共享契约。所有接口保持不变：

- `state:public` / `state:private` 事件格式不变（`phaseEndsAt` 字段值自动适配新时长）
- `action:*` 事件不变
- HTTP API 不变
- Zod 验证 schema 不变
