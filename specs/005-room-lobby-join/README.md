---
status: complete
created: 2026-05-24
priority: high
tags:
- lobby
- room
- ui
- auth
created_at: 2026-05-24T16:25:16.864787Z
updated_at: 2026-05-24T16:40:05.001874Z
completed_at: 2026-05-24T16:40:05.001874Z
transitions:
- status: in-progress
  at: 2026-05-24T16:27:18.544225Z
- status: complete
  at: 2026-05-24T16:40:05.001874Z
---
# Room Lobby Join

> **Status**: planned · **Priority**: high · **Created**: 2026-05-24

## Overview

登录系统（004-invite-code-login）已完成，玩家通过用户名密码登录后即可识别身份。当前房间系统仍然依赖 **房间码（roomCode）** 来创建和加入房间，玩家需要手动输入 6 位字母数字码才能加入。这在有登录系统后变得冗余且不必要。

本规格彻底移除房间码作为入房入口，改为 **房间大厅（Room Lobby）** 模式：登录后的玩家看到一个大厅界面，其中列出所有可加入的等待房间，点击即可加入。创建房间仍然保留，但结果不再是显示房间码，而是直接进入自己创建的房间。

### 动机

1. **已有登录身份**，无需再用房间码区分玩家。
2. **降低入房门槛**，不需要口头分享房间码，点选即可。
3. **为后续扩展**（房间名、密码房、观战位等）打好大厅基础。

## Design

### 整体流程变更

```
BEFORE:
  登录 → 大厅（输入房间码/创建房间） → 输入 6 位码加入 → 等待开局
  创建房间 → 显示房间码 → 把码告诉朋友

AFTER:
  登录 → 房间大厅（列出所有等待房间 + 创建按钮） → 点击某房间 → 加入 → 等待开局
  创建房间 → 直接进入自己创建的房间
```

### 后端变更

#### 1. 新增大厅 API：`GET /api/rooms/lobby`

返回当前所有 `status === 'waiting'` 且未满员的房间列表（不含已开始、已结算的房间）。列表中的每个条目包含：

- `roomCode`（仍作为内部唯一标识保留）
- `playerCount`（当前人数）
- `maxPlayers`（最大人数，固定 3）
- `players`（简要玩家信息：seatIndex, nickname）
- `hasPassword`（预留字段，本期始终 false）
- `createdAt`（创建时间）

**不返回** reconnectToken 等敏感信息。

**认证要求**：必须携带有效的 Bearer token 才能访问此接口（已有登录系统则强制鉴权）。未登录或 token 过期返回 401。

#### 2. 加入接口变更：`POST /api/rooms/:roomCode/join`

- **移除**请求体中的 `nickname` 字段。昵称改为直接从登录 token 中的用户身份获取。
- 加入时自动使用当前登录用户的 `username` 作为房间内昵称。
- 如果该用户已经在某个等待房间中，应返回错误提示"你已在其他房间中，请先退出"（防止重复占用席位）。

#### 3. 创建接口变更：`POST /api/rooms`

- **移除**请求体中的 `nickname` 字段。同样从登录 token 获取 username。
- 创建成功后直接在响应中返回房间信息，但客户端不再展示房间码。

#### 4. 房间列表管理

`RoomStore` 新增 `listWaitingRooms()` 方法，返回所有 `status === 'waiting'` 且未满员的房间。已有 `listRooms()` 方法但返回全部房间（包括 in_game 和已过期的），本规格新增更精确的方法。

#### 5. 防止重复加入

在 `joinRoom` 中加入检查：遍历所有 waiting 房间的 seats，如果某个 seat 的 nickname 与当前登录用户名相同，则拒绝加入并提示"你已在其他房间中"。

#### 6. 移除手动重连 API

`POST /api/rooms/:roomCode/reconnect` 路由移除。重连由 socket 层自动处理——socket 连接时通过 `auth.roomCode + auth.reconnectToken` 鉴权，无需用户手动输入房间码。

### 前端变更

#### 1. 房间大厅视图（替换原有的「输入房间码/昵称」双表单）

登录后直接展示大厅界面：

- 标题："🃏 房间大厅"
- 用户欢迎语："你好，{username}"
- 房间列表区域
  - 每个房间显示：房间序号/标识、人数进度（2/3）、简要玩家昵称列表
  - 点击房间列表项 → 加入该房间
  - 空状态："当前没有可加入的房间。创建一个房间开始游戏吧。"
- 底部操作栏
  - **创建房间** 按钮（无需输入昵称，自动使用登录名）
  - **刷新列表** 按钮
  - **退出登录** 按钮

大厅数据可通过以下方式更新：
1. 进入大厅时立即加载
2. 用户手动点击"刷新"按钮
3. （可选）WebSocket 大厅频道实时推送

#### 2. 等待房间界面（保留现有 UI 但移除房间码）

加入/创建成功后，从大厅跳转到等待房间界面（基本复用现有 `renderWaitingRoomCard`），但 **不再显示房间码**。

- 移除顶部"房间码 XXXXXX" 显示
- 标题改为"等待开局"
- 保留：人员列表、席位数、开始按钮、退出按钮

#### 3. 状态管理更新

`ClientState` 中变更：

- `createRoom()` — 不再接受 `nickname` 参数（从 `authUser.username` 获取）
- `joinRoom(roomCode)` — 改为只接受 `roomCode` 参数（不再接受 `nickname`）
- 新增 `fetchLobbyRooms()` — 调用 `GET /api/rooms/lobby`，更新大厅列表
- `ClientStateSnapshot` 新增 `lobbyRooms: LobbyRoomEntry[]` 字段
- 移除 `reconnect(roomCode)` 方法（重连由 socket 层自动处理）
- 移除所有与 nickname 输入相关的表单逻辑

#### 4. 移除或废弃的 UI 元素

| 元素 | 文件 | 原因 |
|---|---|---|
| `#create-form` 中的昵称输入 | `lobby.ts` | 昵称从 token 获取 |
| `#join-form` 整个表单 | `lobby.ts` | 改为点击房间加入 |
| `#reconnect-form` 整个表单 | `lobby.ts` | 重连自动处理 |
| 房间码显示 (`<strong class="room-code">`) | `lobby.ts` | 不再对用户展示 |
| 提示语"使用昵称和房间码开始一局临时游戏" | `lobby.ts` | 不再需要 |

### 保留房间码作为内部标识

房间码（roomCode）在服务端数据库中仍作为唯一键使用，socket 连接也依赖 roomCode 进行 namespace 路由。**不对用户展示即可**，不需要修改底层数据模型。

### 登录依赖

- **已登录用户**：进入大厅，可浏览房间列表、创建/加入房间。
- **未登录用户**：仍然显示登录/注册页，登录成功后才进入大厅。
- 如果 token 过期，退出到登录页。

## Plan

- [x] **Phase 1 — 后端：大厅 API 和加入逻辑改造**
  - `RoomStore` 新增 `listWaitingRooms()` 方法，过滤 status === 'waiting' 且未满员的房间
  - 新增 `GET /api/rooms/lobby` 路由，返回大厅房间列表（需 Bearer token 鉴权）
  - 改造 `POST /api/rooms` 创建接口：从 token 取 username 作为昵称
  - 改造 `POST /api/rooms/:roomCode/join` 加入接口：从 token 取 username，检查重复加入
  - 移除 `POST /api/rooms/:roomCode/reconnect` 接口
  - 更新 `contracts.ts`：修改 `CreateRoomRequestSchema`、`JoinRoomRequestSchema`，移除 `nickname` 字段
  - 确保单元测试覆盖新逻辑

- [x] **Phase 2 — 前端：房间大厅视图**
  - `ClientState` 新增 `fetchLobbyRooms()` 方法 + `lobbyRooms` 字段
  - 重写 `renderLobby()` 为房间大厅视图（房间列表 + 创建按钮 + 刷新按钮）
  - 移除旧表单（创建/加入/重连表单）
  - 点击房间列表项触发 `joinRoom(roomCode)`
  - 点击创建按钮触发 `createRoom()`
  - 大厅自动刷新（定时轮询或 socket 推送）

- [x] **Phase 3 — 前端：等待房间不再展示房间码**
  - 修改 `renderWaitingRoomCard`：移除房间码显示
  - 调整 UI 标题为"等待开局"，不再强调房间码
  - 人员信息、开始按钮等保持不变

- [x] **Phase 4 — 清理与测试**
  - 移除所有与昵称输入、房间码输入相关的 UI 和逻辑代码
  - 更新 E2E 测试：新流程不再需要输入昵称和房间码
  - 更新单元测试
  - 更新集成测试
  - 验证全流程：登录 → 大厅 → 创建/加入 → 等待 → 开始游戏

## Test

### 单元测试

- [ ] `RoomStore.listWaitingRooms()` 只返回 waiting 且未满员的房间
- [ ] `createRoom` 使用 token 中的 username 作为昵称（在 app 层测试）
- [ ] `joinRoom` 拒绝已经在其他 waiting 房间中的用户
- [ ] `joinRoom` 拒绝满员房间
- [ ] `joinRoom` 拒绝已开始的房间

### 集成测试

- [ ] `GET /api/rooms/lobby` 返回正确的房间列表，包含简要玩家信息
- [ ] 无 token 访问 `/api/rooms/lobby` 返回 401
- [ ] `POST /api/rooms`（带 token）创建房间后直接加入，响应中包含 seatIndex
- [ ] `POST /api/rooms/:roomCode/join`（带 token）加入后响应 seatIndex

### E2E 测试

- [ ] 用户 A 登录 → 创建房间 → 进入等待界面（看不到房间码）
- [ ] 用户 B 登录 → 大厅看到 A 的房间 → 点击加入 → 进入等待界面
- [ ] 用户 C 登录 → 大厅看到房间 → 点击加入 → 开始游戏
- [ ] 用户尝试加入已满员房间 → 提示房间已满
- [ ] 用户在已加入房间中再次尝试加入 → 提示已在房间中

## Notes

- 房间码作为内部标识保留，仅不对用户展示；socket 底层仍基于 roomCode 路由，无架构风险。
- 如果将来需要"密码房"功能，可以在 waiting 房间上增加 `passwordHash` 字段，加入时要求输入密码，这与本规格不冲突。
- 重连逻辑仍然基于 reconnectToken，只是不再提供手动输入房间码的 UI 入口。服务端 socket 中间件已自动处理重连（基于 auth 中的 roomCode + reconnectToken），玩家断线后会自动重连到上次的房间。
- 本规格与 004-invite-code-login 是前后依赖关系：必须先有登录系统才能用 token 代替昵称输入。004 已完成，现在可以推进本规格。
- 考虑在大厅页面加入简单的轮询机制（如每 10 秒刷新一次房间列表），确保新创建的房间和满员房间及时更新。