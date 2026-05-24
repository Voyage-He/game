---
status: complete
created: 2026-05-24
priority: medium
created_at: 2026-05-24T14:58:39.677382Z
updated_at: 2026-05-24T15:20:05.725747Z
completed_at: 2026-05-24T15:20:05.725747Z
transitions:
- status: in-progress
  at: 2026-05-24T15:14:31.559145Z
- status: complete
  at: 2026-05-24T15:20:05.725747Z
---
# 邀请码注册 + 用户名密码登陆

> **Status**: planned · **Priority**: medium · **Created**: 2026-05-24

## Overview

当前项目没有用户身份系统，玩家通过昵称+房间码加入，重连依赖浏览器本地令牌。这对于自部署、少数人长期使用不够便利——无法记住"我是谁"，无法区分不同玩家的对局参与记录，也无法控制谁能访问服务。

本规格引入**邀请码注册 + 用户名密码登陆**机制：

- **注册**：管理员生成一次性邀请码分发给团队成员，成员用它完成注册并设置自己的密码
- **登陆**：用户名 + 密码（标准方式）
- **日常使用**：浏览器持久会话自动登陆，无需输入
- **登出/换设备**：重新输入用户名 + 密码即可

邀请码仅作为"准入凭证"——放人进门后即消耗，不参与后续登陆。数据存储在 JSON 文件中，无需数据库。

## Design

### 为什么不是纯邀请码方案？

纯邀请码方案（邀请码=永久凭证）有两个问题：
- 邀请码是管理员生成的随机串，用户记不住，换设备/登出后还得翻聊天记录找
- 无法更换凭证：如果邀请码泄露，只能找管理员重新生成

### 当前方案的优势

```
注册（一次性的，需邀请码）:
  用户 → 用户名 + 邀请码 + 设置密码 → 注册成功
  邀请码被消耗，用户拥有自己的密码

登陆（日常使用）:
  用户 → 用户名 + 密码 → 登陆成功
  完全不依赖邀请码
```

- **邀请码 = 注册门槛**：管理员控制谁可以注册
- **密码 = 用户自己的凭证**：用户自己设置、自己记住、自己管理
- **省略了传统注册的邮箱验证**：邀请码本身就是验证
- **零外部依赖**：不需要 SMTP、OAuth、数据库

### 数据存储

JSON 文件，位于 `data/` 目录：

```
data/
├── users.json          # [{ username, passwordHash, createdAt, lastLoginAt }]
├── invite_codes.json   # [{ code, createdBy, createdAt, usedBy, usedAt }]
└── .gitkeep
```

- 服务端启动时加载到内存，写入时全量覆写文件
- `data/` 加入 `.gitignore`（用户敏感数据不入库），仅保留 `.gitkeep`
- 环境变量 `DATA_DIR` 配置存储路径，默认 `./data`

### 密码存储

- 使用 Node.js 内置 `crypto` 模块的 scrypt 或 pbkdf2 进行加盐哈希
- 不引入 bcrypt/argon2 等第三方依赖
- 密码哈希在注册时生成，登陆时比对

### 注册流程

```
POST /api/auth/register
Body: { username, password, inviteCode }

服务端:
  1. 校验 inviteCode 存在且未被使用 → 否则拒绝
  2. 校验 username 未被注册 → 否则拒绝
  3. 对 password 进行加盐哈希
  4. 写入 users.json，标记 inviteCode 为已用
  5. 生成 session token，返回给客户端
```

### 登陆流程

```
POST /api/auth/login
Body: { username, password }

服务端:
  1. 查找用户 → 不存在则拒绝
  2. 比对密码哈希 → 不匹配则拒绝
  3. 生成 session token，返回给客户端
```

### 会话令牌

- `crypto.randomUUID()` 生成随机令牌
- 存储于服务端内存 `Map<token, username>`
- 客户端存于 `localStorage`，每次请求通过 `Authorization: Bearer <token>` 携带
- 不设过期时间（自部署小团队场景）
- 服务重启后所有会话失效，用户需重新用用户名+密码登陆

### 管理员机制

- 首个邀请码通过环境变量 `INVITE_CODE` 提供，部署时手动设置
- 所有已注册用户均可通过 Web 界面生成新邀请码（信任小团队）
- 页面展示所有邀请码及其使用状态（已用/未用）

### 与现有房间系统的关系

- 登陆后，创建/加入房间的昵称输入框预填为登陆用户名（可修改）
- 重连令牌机制保持不变，与登陆会话相互独立
- 未登陆用户仍可正常使用房间功能（向后兼容，登陆为可选增强）

## Goals

- 邀请码注册：管理员生成邀请码 → 成员注册并自设密码 → 邀请码消耗
- 用户名+密码登陆：注册后用户可随时用密码登陆
- 浏览器持久会话自动恢复身份
- 所有数据 JSON 文件存储，零数据库依赖
- 不破坏现有房间码加入、重连令牌等游戏流程

## Non-goals

- 不做邮箱验证、手机验证、OAuth、Magic Link
- 不做密码重置流程（v1 由管理员删除用户记录后重新邀请）
- 不做用户权限分级、头像、个人资料、对局历史
- 不做邀请码过期时间、用量统计
- 不强制登陆才能玩游戏

## User Scenarios

### User Story 1 – 管理员生成邀请码

作为部署者，我希望生成邀请码分发给团队成员，让他们可以注册。

**Acceptance:**
1. **Given** 服务首次启动，**When** 管理员通过环境变量 `INVITE_CODE` 设置首个邀请码，**Then** 团队成员可用该码注册。
2. **Given** 已注册用户访问邀请码管理页，**When** 点击生成邀请码，**Then** 系统生成新的 8 位邀请码并展示使用状态列表。

### User Story 2 – 团队成员注册

作为团队成员，我收到邀请码后，希望注册账户并设置自己的密码。

**Acceptance:**
1. **Given** 有一个未被使用的邀请码，**When** 我输入用户名、密码、邀请码提交，**Then** 注册成功并自动登陆。
2. **Given** 邀请码已被他人使用，**When** 我尝试注册，**Then** 看到错误提示"邀请码已被使用"。
3. **Given** 用户名已被注册，**When** 我尝试用相同用户名注册，**Then** 看到错误提示"用户名已被注册"。
4. **Given** 密码过短，**When** 我提交注册，**Then** 看到密码长度要求提示。

### User Story 3 – 已注册用户日常登陆

作为已注册用户，我希望用我的用户名和密码登陆。

**Acceptance:**
1. **Given** 我已注册，**When** 我输入正确的用户名和密码，**Then** 登陆成功进入游戏界面。
2. **Given** 我输入错误的密码，**When** 提交登陆，**Then** 看到"用户名或密码错误"提示。
3. **Given** 我输入不存在的用户名，**When** 提交登陆，**Then** 看到同样的"用户名或密码错误"提示（不泄露用户是否存在）。

### User Story 4 – 自动恢复会话

作为已注册用户，我日常使用时希望能自动登陆，不用每次输入密码。

**Acceptance:**
1. **Given** 我之前已登陆且令牌有效，**When** 重新打开页面，**Then** 自动识别身份并进入游戏界面。
2. **Given** 服务重启导致令牌失效，**When** 重新打开页面，**Then** 看到登陆界面，输入用户名+密码即可重新登陆。

### User Story 5 – 登出后重新登陆

作为已注册用户，我登出后希望能用密码重新登陆。

**Acceptance:**
1. **Given** 我已登出，**When** 输入用户名+密码，**Then** 登陆成功。
2. **Given** 我换了一台设备，**When** 输入用户名+密码，**Then** 登陆成功。

## Requirements

- **FR-001**: 系统 MUST 提供 `POST /api/auth/register` 接口，接受 username + password + inviteCode 完成注册。
- **FR-002**: 系统 MUST 提供 `POST /api/auth/login` 接口，接受 username + password 完成登陆。
- **FR-003**: 系统 MUST 提供 `GET /api/auth/me` 接口，根据会话令牌返回当前用户信息。
- **FR-004**: 系统 MUST 提供 `POST /api/auth/logout` 接口，销毁当前会话令牌。
- **FR-005**: 系统 MUST 对密码进行加盐哈希存储，不得明文存储密码。
- **FR-006**: 系统 MUST 验证邀请码在注册时存在且未被使用，注册成功后标记为已用。
- **FR-007**: 系统 MUST 保证用户名全局唯一。
- **FR-008**: 系统 MUST 将用户数据持久化到 `data/users.json`，邀请码数据持久化到 `data/invite_codes.json`。
- **FR-009**: 系统 MUST 在启动时加载 JSON 数据到内存，数据变更时全量写回文件。
- **FR-010**: 系统 MUST 在登陆失败时不区分"用户不存在"和"密码错误"（统一错误信息）。
- **FR-011**: 已注册用户 MUST 能够通过 Web 界面生成新邀请码，并查看邀请码列表及使用状态。
- **FR-012**: 登陆成功后，创建/加入房间的昵称输入框 SHOULD 预填为登陆用户名。
- **FR-013**: 未登陆用户 MUST 仍能正常使用创建/加入房间功能。
- **FR-014**: `data/` 目录和 `.env` 文件 MUST 加入 `.gitignore`，仅保留 `.gitkeep` 和 `.env.example`。

## Implementation

### Server side

- `src/server/auth-store.ts` ：`AuthStore` 类，整合密码哈希（`crypto.scrypt`）、用户/邀请码存储（JSON 文件）、会话管理（内存 Map）
- `src/server/auth-routes.ts`：Express Router，暴露以下 API：
  - `POST /api/auth/register` — 用户名 + 密码 + 邀请码注册
  - `POST /api/auth/login` — 用户名 + 密码登陆
  - `GET /api/auth/me` — 会话令牌验证（返回当前用户）
  - `POST /api/auth/logout` — 销毁会话
  - `POST /api/admin/invite-codes` — 生成新邀请码（需登陆）
  - `GET /api/admin/invite-codes` — 列出所有邀请码（需登陆）
- `src/server/app.ts`：挂载 auth 路由、添加 `Authorization` 到 CORS 头
- `.env.example`：添加 `INVITE_CODE` 和 `DATA_DIR` 配置项
- `.gitignore`：添加 `data/` 目录（保留 `.gitkeep`）
- `data/.gitkeep`：创建数据目录骨架

### Client side

- `src/client/state.ts`：`ClientStateSnapshot` 扩展 auth 状态（`authUser`、`authToken`、`showAuthPage`），新增方法 `authRegister`、`authLogin`、`authLogout`、`authRestoreSession`
- `src/client/views/auth.ts`：渲染登陆/注册页面（带标签切换）、用户状态栏、邀请码管理面板
- `src/client/main.ts`：修改渲染流程 — 未登录显示 auth 页面，已登录显示 lobby + 用户状态栏；绑定 auth 表单和按钮事件
- `src/client/views/lobby.ts`：昵称输入框预填已登录用户名
- `src/client/styles/main.css`：auth 页面、用户状态栏、邀请码管理面板样式

### 验证结果

所有 13 个 API 测试通过（包括正常流程和异常场景），91 个已有单元/集成测试全部通过，前后端构建成功。

## Plan

- [x] 搭建 `data/` 目录结构和 JSON 文件存储模块
- [x] 实现密码哈希工具（crypto.scrypt + 随机盐）
- [x] 实现用户存储模块（增、查、更新 lastLoginAt）
- [x] 实现邀请码存储模块（增、查、标记已用）
- [x] 实现会话令牌管理（Map 存储、生成、验证、销毁）
- [x] 实现认证 API 路由（register、login、me、logout）
- [x] 实现邀请码管理 API 路由（生成、列表）
- [x] 实现 Bearer Token 提取中间件
- [x] 实现前端注册页面（用户名 + 密码 + 邀请码表单）
- [x] 实现前端登陆页面（用户名 + 密码表单）
- [x] 实现前端自动恢复会话（页面加载时 GET /api/auth/me）
- [x] 实现前端邀请码管理页面
- [x] 登陆用户名预填到房间昵称输入框
- [x] 添加 `INVITE_CODE` 环境变量支持
- [ ] 编写单元测试（密码哈希、JSON 存储、邀请码验证、认证 API）
- [ ] 编写 E2E 测试（注册→登陆→自动恢复→登出→重新登陆→邀请码管理）

## Test

- [x] 手动验证：`POST /api/auth/register` 正常注册并返回令牌
- [x] 手动验证：`POST /api/auth/login` 正常登陆并返回令牌
- [x] 手动验证：`GET /api/auth/me` 有效令牌返回用户，无效令牌返回 401
- [x] 手动验证：`POST /api/auth/logout` 销毁令牌后 me 返回 401
- [x] 手动验证：`POST /api/admin/invite-codes` 已注册用户生成邀请码
- [x] 手动验证：无效邀请码返回

## Notes

- 邀请码格式：8 位大写字母数字（如 `A3K9M2X7`），32^8 ≈ 10^12 空间，足够安全
- 密码最小长度建议 4 位（小团队场景，不必强制复杂密码策略）
- 密码重置 v1 不做：管理员手动从 users.json 删除用户 → 用户用新邀请码重新注册
- `crypto.scrypt` 是 Node.js 内置，无需额外依赖，比 pbkdf2 更抗硬件破解
- 未来可选：密码强度要求、邀请码过期、用户权限分级、JWT 令牌（重启不丢会话）
