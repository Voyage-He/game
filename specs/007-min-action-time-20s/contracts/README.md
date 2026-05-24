# Contracts: 每个身份行动时间至少 20 秒以上

**Feature**: 007-min-action-time-20s | **Date**: 2026-05-23

## Zero Interface Changes

本功能不引入任何新的 HTTP 端点、Socket.IO 事件、Zod schema 或契约变更。

### Unchanged Contracts

| Contract | Location | Status |
|----------|----------|--------|
| `public:state` event | Socket.IO → `PublicRoomView` | Unchanged — `phaseEndsAt` field already carries new duration-derived timestamps |
| `private:state` event | Socket.IO → `PrivateRoomView` | Unchanged — no phase duration fields in private view |
| `state:public` event | Socket.IO → `PublicRoomView` | Unchanged |
| `state:private` event | Socket.IO → `PrivateRoomView` | Unchanged |
| `POST /api/rooms` | HTTP → `CreateRoomResponse` | Unchanged |
| `POST /api/rooms/:code/join` | HTTP → `JoinRoomResponse` | Unchanged |
| `POST /api/rooms/:code/reconnect` | HTTP → `ReconnectResponse` | Unchanged |
| `Room` type | `src/shared/types.ts` | Unchanged — `phaseEndsAt?: string` field unchanged |
| `PublicRoomView` type | `src/shared/types.ts` | Unchanged |
| `PrivateRoomView` type | `src/shared/types.ts` | Unchanged |
| All Zod schemas | `src/shared/contracts.ts` | Unchanged |

### How Phase Duration Propagates Without Contract Changes

1. 服务端 `engine.setPhase()` 使用新的 `DEFAULT_PHASE_DURATIONS_MS` 值计算 `phaseEndsAt`
2. `phaseEndsAt` 作为 `Room.phaseEndsAt` 写入房间状态（已有字段）
3. `PublicRoomView.phaseEndsAt` 通过 Socket.IO `public:state` 事件下发给客户端（已有字段）
4. 客户端 `remainingSecondsForDeadline(phaseEndsAt, offset)` 计算剩余秒数
5. UI 展示 "剩余 XX 秒"（XX 从原来的 5/10 变为 20）

整个过程无需任何契约签名变更 — `phaseEndsAt` 始终是 ISO 时间戳字符串，客户端仅解析其值，不关心其来源逻辑。
