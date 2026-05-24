# Feature Specification: 修复倒计时与身份分配

**Feature Branch**: `003-fix-countdown-identity`

**Created**: 2026-05-22

**Status**: Draft

**Input**: User description: "两个问题：1.倒计时不连续。2.每次都是同一个身份"

## Constitution Alignment *(mandatory)*

- **服务端权威与规则一致性**: 对局阶段、剩余时间、身份洗牌与发牌结果必须以房间的权威对局状态为准；倒计时遵循既有规则时长，身份分配遵循六张身份牌随机发给三名玩家、三张作为水下牌的规则。
- **临时数据与隐私最小化**: 本修复不新增持久数据；仅在活动房间中临时保存倒计时状态、玩家席位、初始身份、最终身份和水下牌位置，并在结算或房间清理时删除。
- **测试先行与契约可验证**: 必须覆盖倒计时连续性、阶段切换、断线重连后的剩余时间、重复开局的身份分配多样性、同局身份稳定性和隐藏信息边界。
- **简洁自托管架构**: 本修复不新增账号、公开大厅、匹配、旁观者、持久化历史、外部服务、自定义美术或非必要动画。
- **清晰中文体验与实时可用性**: 玩家看到的阶段名称、剩余秒数、等待提示和异常反馈必须使用清晰中文；倒计时显示应每秒更新并在同一房间内保持一致。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 连续显示对局倒计时 (Priority: P1)

作为正在参与对局的玩家，我希望所有限时阶段的倒计时按秒连续变化，并且和其他玩家看到的阶段进度一致，以便知道何时需要行动、等待或准备进入下一阶段。

**Why this priority**: 倒计时是闭眼、身份行动和投票阶段的主要节奏提示；如果倒计时跳变、冻结或不一致，玩家无法可靠完成行动，对局会显得卡顿或不公平。

**Independent Test**: 开始一局三人游戏，观察闭眼、各身份行动和投票阶段；验证每个限时阶段的剩余秒数按规则时长逐秒递减，所有在线玩家看到的阶段和剩余时间一致，阶段结束后只进入一次下一阶段。

**Acceptance Scenarios**:

1. **Given** 三名玩家已经开始游戏，**When** 游戏进入“所有玩家闭眼（5秒）”阶段，**Then** 所有在线玩家看到的倒计时从 5 秒按秒递减到 0，并在结束后进入狼人阶段。
2. **Given** 游戏进入任一 10 秒身份行动阶段，**When** 玩家持续观察倒计时，**Then** 剩余秒数每秒减少一次，不冻结、不跳回更大的数值，也不跳过中间秒数。
3. **Given** 游戏处于投票阶段，**When** 部分玩家尚未投票，**Then** 所有在线玩家持续看到同一个 60 秒投票窗口的剩余时间，直到全员完成投票或倒计时结束。
4. **Given** 玩家在限时阶段中刷新页面或断线重连，**When** 玩家回到原房间席位，**Then** 玩家看到当前阶段真实剩余时间，而不是重新从阶段起始秒数开始。

---

### User Story 2 - 每局重新公平分配身份 (Priority: P2)

作为玩家，我希望每次新开一局时身份都重新随机分配，而不是同一个席位、昵称或玩家每次都拿到固定身份，以保证游戏有悬念和公平性。

**Why this priority**: 身份随机性是隐藏身份游戏的核心。如果玩家每次都是同一个身份，游戏会失去推理价值，也会让玩家认为发牌不可信。

**Independent Test**: 使用相同三名玩家、相同昵称和相同加入顺序连续创建并开始多局新游戏；验证每局都从完整六张身份牌中重新分配，玩家席位不会被固定到同一个身份，且同一局内刷新或重连不会错误改变该局身份。

**Acceptance Scenarios**:

1. **Given** 三名玩家以相同顺序创建并加入新房间，**When** 连续开始多局独立新游戏，**Then** 身份分配表现为新一局的重新抽取，不会每一局都给同一玩家相同身份。
2. **Given** 一局新游戏刚开始，**When** 系统完成发牌，**Then** 三名玩家各获得一张不同身份牌，剩余三张不同身份牌成为水下牌，六张身份牌在本局中各出现一次。
3. **Given** 玩家已经在本局看到自己的初始身份，**When** 玩家刷新页面或断线重连，**Then** 该玩家回到原席位并看到同一张本局初始身份牌，除非后续规则行动导致最终身份发生交换。
4. **Given** 某个身份在自然随机下偶尔连续出现，**When** 玩家开始下一局，**Then** 系统仍按新一局重新分配处理；允许偶发重复，但不得形成固定、可预测的席位身份。

---

### User Story 3 - 玩家理解修复后的等待与身份结果 (Priority: P3)

作为玩家，我希望界面用中文清楚说明当前是倒计时等待、本人行动、他人行动还是投票等待，并在结算时看到最终身份结果，以便确认对局按规则推进。

**Why this priority**: 仅修复底层节奏和随机性还不够；玩家需要能从界面确认倒计时正在推进、身份没有提前泄露、最终结果可核对。

**Independent Test**: 完成一局包含身份行动、重连和投票超时的游戏；验证每个阶段的中文提示明确，非行动玩家不会看到私密身份内容，结算时所有玩家可以查看最终身份和水下牌结果。

**Acceptance Scenarios**:

1. **Given** 当前阶段不允许某玩家行动，**When** 该玩家查看游戏界面，**Then** 玩家看到中文等待提示和连续倒计时，而不会看到其他玩家的私密身份或行动结果。
2. **Given** 玩家在自己的身份阶段拥有可执行动作，**When** 倒计时仍未结束，**Then** 玩家看到中文行动提示、可选目标和剩余时间。
3. **Given** 游戏完成结算，**When** 所有玩家查看结果，**Then** 他们能看到每名玩家最终身份、水下牌、投票结果和胜负阵营，用于核对本局身份分配与交换结果。

### Edge Cases

- 玩家在限时阶段中途加入重连时，倒计时不得重启，也不得导致其他玩家的倒计时跳变。
- 玩家在倒计时结束瞬间提交身份行动或投票时，系统必须只采用一个明确结果，并避免重复提交或重复阶段切换。
- 身份行动阶段对应身份不在玩家席位上时，阶段仍按规则经过并显示中性等待倒计时，不得泄露该身份是否在水下牌中。
- 可选身份未在倒计时结束前行动时，不自动执行可选动作；必选身份未行动时，按既有规则使用有效自动选择以继续游戏。
- 自由发言阶段不限时，不应显示会自动结束的倒计时。
- 投票阶段在所有玩家完成投票前必须持续显示剩余时间；若所有玩家提前投票完成，可立即进入结算并停止投票倒计时。
- 同一局内刷新、断线重连或短暂网络波动不得重新分配初始身份。
- 新开多局时允许玩家因真实随机性偶尔连续获得相同身份，但不得出现席位、昵称、浏览器或房间创建顺序固定映射为同一身份的现象。
- 多个房间同时进行时，每个房间的倒计时和身份分配彼此独立，互不影响。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a visible countdown for every timed game phase using the phase duration defined by the existing game rules: 5 seconds for all players closing eyes, 10 seconds for 狼人、预言家、强盗 phases, 5 seconds for 捣蛋鬼、水鬼 phases, and 60 seconds for voting.
- **FR-002**: System MUST update the visible countdown once per second during an active timed phase so players see a continuous sequence from the phase duration down to completion.
- **FR-003**: System MUST keep all connected players in the same room aligned to the same current phase and the same remaining second, with no visible freeze, backward jump, duplicate phase restart, or skipped middle seconds during normal connectivity.
- **FR-004**: System MUST transition from a timed phase to the next valid phase exactly once when that phase completes, and MUST NOT allow countdown completion to trigger duplicate phase changes or duplicate automatic actions.
- **FR-005**: System MUST show a reconnected player the current phase and current remaining time for the active room rather than restarting that phase for that player.
- **FR-006**: System MUST ensure valid player actions submitted during a timed phase do not reset, pause, or desynchronize the countdown for other players in the room.
- **FR-007**: System MUST treat the free speech phase as untimed and MUST NOT display a countdown that implies automatic phase completion for free speech.
- **FR-008**: System MUST create each new game from exactly these six identity cards: 狼人、预言家、强盗、捣蛋鬼、水鬼、平民.
- **FR-009**: System MUST assign exactly one identity card to each of the three player seats and exactly three identity cards to 水下的牌 at the start of each new game, with no duplicate or missing card within a single game.
- **FR-010**: System MUST perform a fresh identity allocation for every new game and MUST NOT deterministically bind a player seat, nickname, browser, room creator, join order, reconnect token, or previous game result to the same identity across games.
- **FR-011**: System MUST allow natural random repetition of a player identity across separate games, but repeated validation runs MUST demonstrate that identity allocation is not fixed or predictable by seat or nickname.
- **FR-012**: System MUST keep a player's initial identity stable within the same active game across page refresh, disconnect, and reconnect; identity changes within a game may occur only through rule-authorized card exchanges and are reflected as final identities.
- **FR-013**: System MUST preserve hidden-information boundaries while fixing identity assignment: before settlement, each player sees only their own initial identity and any private card information explicitly allowed by their role action.
- **FR-014**: System MUST present player-facing phase names, countdown labels, waiting states, action prompts, and relevant error messages in clear Chinese.
- **FR-015**: System MUST show settlement information that lets players verify the completed game outcome, including final identity of each player, final 水下的牌, vote totals, eliminated or no-out result, and winning camp.

### Key Entities *(include if feature involves data)*

- **Timed Phase**: A game phase with a defined duration, current remaining time, start state, completion state, and next phase.
- **Countdown Display**: The player-visible remaining seconds and phase label shown during a timed phase.
- **Identity Allocation**: The per-game result of distributing the six identity cards into three player seats and three 水下的牌 positions.
- **Player Seat**: A participant position in a room; includes nickname, connection status, initial identity for the active game, final identity after exchanges, and reconnect eligibility.
- **Identity Card**: One of 狼人、预言家、强盗、捣蛋鬼、水鬼、平民; each card appears exactly once per game and has a current location.
- **水下的牌**: The three identity cards not initially assigned to players; they remain hidden except when viewed or exchanged by rule-authorized actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 30 tested timed phases across multiple rooms, 100% of players observe countdowns that decrease once per second from the configured phase duration to completion without freezing, jumping backward, or restarting.
- **SC-002**: In 30 tested timed phases, 100% of phase completions advance to the next valid phase exactly once, with no duplicate automatic actions or duplicate settlement.
- **SC-003**: In reconnection testing during at least 10 active timed phases, 100% of reconnected players see the current remaining time within 2 seconds of the other connected players.
- **SC-004**: In 100 consecutive new-game starts using the same three nicknames and same join order, no player receives the same identity in every game, and at least five of the six identities appear in player seats across the test set.
- **SC-005**: In 100 tested new-game starts, 100% of games contain exactly three player identity cards and three 水下的牌 drawn from the six-card deck with no duplicate or missing card.
- **SC-006**: In 20 refresh or reconnect tests after identities are dealt, 100% of players return to the same active-game initial identity unless a later rule-authorized exchange changes their final identity.
- **SC-007**: In privacy validation, unauthorized players see zero other-player identity contents or 水下牌 contents before settlement, while 100% of settlement screens show final identities and final 水下牌 for review.
- **SC-008**: In player-facing review, 100% of countdown labels, phase labels, action prompts, waiting messages, and relevant errors for this fix are understandable Chinese text.

## Assumptions

- This feature is a bug-fix specification for the existing three-player online room game rather than a new game mode.
- Existing game rules, role list, phase order, phase durations, voting behavior, victory conditions, and temporary-room cleanup remain authoritative unless explicitly listed in this specification.
- “每次都是同一个身份” is interpreted as an unintended fixed or predictable identity assignment across new games; the fix should not forbid legitimate random repetition in occasional games.
- A “new game” means a newly started room/game instance after the previous game is completed or a separate room is created.
- Players use the existing room nickname and reconnect behavior; this feature does not add persistent accounts or player profiles.
- Network latency may cause minor visual delay, but the player-facing countdown should resynchronize quickly and remain consistent within normal connectivity.
