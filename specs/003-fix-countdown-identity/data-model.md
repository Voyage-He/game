# Data Model: 修复倒计时与身份分配

## Entity: Timed Phase

**Purpose**: 表示一个会自动结束的游戏阶段及其权威时间窗口。

**Fields**:

- `phase`: 当前阶段名称；限时阶段包括 `close_eyes`、五个身份行动阶段、`open_eyes`、`voting`。
- `phaseStartedAt`: 服务端记录的阶段开始时间，ISO UTC 字符串。
- `phaseEndsAt`: 服务端记录的阶段结束时间，ISO UTC 字符串；`free_speech` 和 `settlement` 不设置该字段。
- `durationMs`: 由规则定义或测试配置推导的阶段时长；不是客户端可修改状态。
- `serverNow`: 服务端发送公共状态时的当前时间，用于客户端校准倒计时显示。

**Validation Rules**:

- 限时阶段必须有 `phaseStartedAt` 和 `phaseEndsAt`，且 `phaseEndsAt >= phaseStartedAt`。
- 自由发言阶段不得设置会让玩家误解为自动结束的倒计时。
- 玩家行动、投票、重连和状态广播不得重置当前阶段的 `phaseStartedAt` 或 `phaseEndsAt`。
- 阶段完成只能推进到规则定义的下一个阶段，且每个阶段完成最多触发一次自动行动或结算。

**State Transitions**:

```text
waiting
  -> close_eyes
  -> wolf_action
  -> seer_action
  -> robber_action
  -> troublemaker_action
  -> water_ghost_action
  -> open_eyes
  -> free_speech
  -> voting
  -> settlement
  -> room cleanup/deletion
```

## Entity: Phase Timer

**Purpose**: 服务端用于在限时阶段结束时推进房间的临时调度记录。

**Fields**:

- `roomCode`: 所属房间。
- `expectedPhase`: 安排定时器时的阶段。
- `expectedPhaseEndsAt`: 安排定时器时的阶段结束时间。
- `timeoutHandle`: 运行时定时器句柄；不写入共享契约，不持久化。

**Validation Rules**:

- 触发时必须重新读取房间，并且当前 `phase` 与 `expectedPhase`、当前 `phaseEndsAt` 与 `expectedPhaseEndsAt` 同时匹配，才允许推进。
- 房间进入 `free_speech`、`settlement`、`closed` 或被删除时必须清理对应定时器。
- 同一房间同一时刻只能保留一个有效定时器。

## Entity: Countdown Display

**Purpose**: 玩家界面中可见的剩余时间和阶段提示。

**Fields**:

- `phaseLabel`: 中文阶段名称。
- `remainingSeconds`: 基于 `phaseEndsAt`、`serverNow` 和本地渲染节拍计算出的非负整数秒。
- `isTimed`: 当前阶段是否应显示倒计时。
- `connectionStatus`: 用于显示在线/离线或重连后的状态反馈。

**Validation Rules**:

- 限时阶段显示必须每秒更新一次，且不得跳回更大的剩余秒数。
- `remainingSeconds` 最小为 0；阶段完成后由服务端状态切换控制下一阶段显示。
- 非行动玩家在身份阶段只能看到中性等待文案和倒计时，不得看到私密身份内容。

## Entity: Identity Allocation

**Purpose**: 表示一局游戏开始时六张身份牌到三个玩家席位和三张水下牌的分配结果。

**Fields**:

- `deck`: 六张 `Identity Card`，每张牌出现一次。
- `playerCardIds`: 三个玩家席位对应的初始身份牌 ID。
- `underwaterCardIds`: 三个水下位置对应的身份牌 ID。
- `allocatedAt`: 服务端发牌时间。
- `allocationScope`: 当前活动房间的一局游戏；不跨房间或跨局复用。

**Validation Rules**:

- 每局必须包含且仅包含 `狼人`、`预言家`、`强盗`、`捣蛋鬼`、`水鬼`、`平民` 六张身份牌。
- 每个玩家席位恰好获得一张初始身份牌，三个水下位置恰好各有一张牌。
- 新游戏必须重新洗牌并分配，不得由席位、昵称、浏览器、加入顺序、重连令牌或上一局结果决定固定身份。
- 同一局内不得在刷新、断线重连、状态广播或界面重绘时重新分配身份。

## Entity: Player Seat

**Purpose**: 表示房间内一名玩家的位置及其本局身份引用。

**Fields**:

- `seatId`: 服务端席位标识。
- `seatIndex`: 玩家可见席位序号，0 到 2。
- `nickname`: 房间内临时昵称。
- `connectionStatus`: `connected` 或 `disconnected`。
- `reconnectTokenHash`: 服务端保存的重连令牌哈希。
- `initialCardId`: 本局开始时分配给该席位的身份牌 ID。
- `currentCardId`: 当前位于该席位的身份牌 ID，可能因规则行动交换而变化。
- `voteSubmitted`: 该席位是否已提交本轮投票。

**Validation Rules**:

- `initialCardId` 在同一局内保持不变。
- `currentCardId` 只能因规则授权的强盗、捣蛋鬼或水鬼行动变化。
- 重连必须通过同房间匹配的重连令牌取回原席位，不能创建新身份分配。

## Entity: Identity Card

**Purpose**: 表示一张唯一身份牌及其当前位置与可见性。

**Fields**:

- `cardId`: 本局内唯一牌 ID。
- `role`: `狼人`、`预言家`、`强盗`、`捣蛋鬼`、`水鬼` 或 `平民`。
- `initialLocation`: 本局初始位置，玩家席位或水下位置。
- `currentLocation`: 当前所在位置，可能因规则行动交换。
- `visibleToSeatIds`: 结算前被规则授权看过该牌内容的席位。

**Validation Rules**:

- 结算前公共状态不得包含 `role` 内容。
- 私密状态只能向拥有者或被规则行动授权的席位显示相关 `role`。
- 结算时公开最终玩家身份和最终水下牌。

## Entity: Public Room View

**Purpose**: Socket.IO `state:public` 事件中广播给房间成员的公共状态快照。

**Fields**:

- `roomCode`, `status`, `version`, `players`。
- `phase`, `phaseStartedAt`, `phaseEndsAt`。
- `serverNow`: 服务端发送该状态快照的时间。
- `phaseCompletion`: 当前身份阶段是否已完成。
- `voteCompletion`: 投票阶段或结算时的投票提交进度。

**Validation Rules**:

- 不包含任何未公开身份牌内容。
- 每次广播都必须设置新的 `serverNow`。
- 重连成功后必须发送当前房间真实阶段和真实结束时间。

## Entity Relationships

- `Room` owns one active `Timed Phase`, zero or one active `Phase Timer`, one `Identity Allocation`, three `Player Seat` entries, six `Identity Card` entries, actions, votes, and optional settlement.
- `Countdown Display` is derived from `Public Room View`;它不是服务端持久状态。
- `Player Seat.initialCardId` and `Player Seat.currentCardId` reference `Identity Card.cardId`.
- `Identity Allocation` determines initial card locations; role actions update `Identity Card.currentLocation` and `Player Seat.currentCardId`.
