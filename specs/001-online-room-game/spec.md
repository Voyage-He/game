# Feature Specification: 在线房间游戏

**Feature Branch**: `001-online-room-game`

**Created**: 2026-05-21

**Status**: Draft

**Input**: User description: "根据 @game_rule.md 完成一个在线游戏，拥有创建房间，加入房间等在线功能"

## Clarifications

### Session 2026-05-21

- Q: 第一版的视觉/美术投入边界应是什么？ → A: 极简文字/CSS UI：不制作自定义美术，仅用文字、颜色、基础图标/emoji 表达角色和状态
- Q: 断线重连时，系统应如何确认玩家能取回原席位？ → A: 浏览器本地重连令牌：加入房间时生成，同设备/同浏览器可取回原席位
- Q: 第一版的在线访问范围应是什么？ → A: 自部署公网使用：房间码分享给受邀朋友加入，不做公开平台
- Q: 房间和对局数据在第一版应保留多久？ → A: 临时房间：结算或全员离开后关闭并删除；不保留历史记录
- Q: 第一版的隐私/数据采集边界应是什么？ → A: 不采集个人信息：仅临时保存昵称、房间/对局状态和重连令牌

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 开房并完成一局三人在线游戏 (Priority: P1)

三名玩家可以在线创建房间、通过房间码加入、开始一局游戏，并按《game_rule.md》的完整流程从发牌、闭眼行动、自由发言、投票到结算完成一局对局。

**Why this priority**: 这是产品的核心价值；没有三人房间和完整对局流程，用户无法实际游玩该规则游戏。

**Independent Test**: 由一名玩家创建房间，另外两名玩家使用房间码加入；房间满员后开始游戏并完成所有阶段，最终所有玩家看到投票、出局结果、胜利阵营和最终身份。

**Acceptance Scenarios**:

1. **Given** 玩家尚未加入任何房间，**When** 玩家输入昵称并创建房间，**Then** 系统创建一个等待中的房间，生成可分享的房间码，并将创建者放入第一个玩家席位。
2. **Given** 房间处于等待状态且未满三人，**When** 两名玩家使用有效房间码和不重复昵称加入，**Then** 三名玩家都能看到完整玩家列表，并且游戏可被房主开始。
3. **Given** 房间内正好有三名已连接玩家，**When** 房主开始游戏，**Then** 系统随机分发 6 张身份牌中的 3 张给玩家、保留 3 张作为水下牌，并仅向每名玩家展示其自己的初始身份。
4. **Given** 游戏已进入行动流程，**When** 所有计时阶段、发言阶段和投票阶段完成，**Then** 系统按最终身份计算出局玩家和胜利阵营，并向全员展示结算结果。

---

### User Story 2 - 私密且准确地执行身份技能 (Priority: P2)

玩家在自己的身份行动阶段只能看到与自己身份相关的选择和信息；可选技能可跳过，必选技能必须完成，所有查看、交换和最终身份变化都符合游戏规则。

**Why this priority**: 身份技能和信息不对称是游戏体验的核心；任何错误泄露或错误交换都会破坏公平性。

**Independent Test**: 使用可控身份与水下牌设置分别测试狼人、预言家、强盗、捣蛋鬼、水鬼和平民；验证每个身份只能执行规则允许的动作，并检查其他玩家无法看到私密信息。

**Acceptance Scenarios**:

1. **Given** 游戏处于狼人行动阶段且玩家初始身份为狼人，**When** 玩家选择发动技能，**Then** 玩家最多查看一张水下牌，其他玩家看不到被查看内容。
2. **Given** 游戏处于预言家行动阶段且玩家初始身份为预言家，**When** 玩家发动技能，**Then** 玩家只能在“查看两张水下牌”和“查看一名玩家身份牌”之间选择一种行动。
3. **Given** 游戏处于强盗行动阶段且玩家初始身份为强盗，**When** 玩家选择查看一名玩家的身份牌，**Then** 查看完成后系统必须将该身份牌与强盗自己的身份牌交换。
4. **Given** 游戏处于捣蛋鬼或水鬼行动阶段且玩家初始身份匹配该阶段，**When** 该玩家未在限定时间内完成必选操作，**Then** 系统使用一个有效目标自动完成该必选操作并继续游戏。

---

### User Story 3 - 处理房间异常与在线中断 (Priority: P3)

玩家在加入房间、等待开局和游戏过程中遇到无效房间码、房间已满、重复昵称、掉线或错误操作时，可以得到清晰反馈，且房间状态不会被破坏。

**Why this priority**: 在线房间游戏需要可靠处理常见异常，避免玩家因为网络或误操作无法完成对局。

**Independent Test**: 分别尝试加入不存在房间、加入满员或已开始房间、使用重复昵称、在非自己行动阶段提交动作、游戏中短暂断线并重连；验证系统反馈和房间状态。

**Acceptance Scenarios**:

1. **Given** 玩家输入不存在或已失效的房间码，**When** 玩家尝试加入，**Then** 系统拒绝加入并说明房间不可用。
2. **Given** 房间已满三人或已经开始游戏，**When** 新玩家尝试加入，**Then** 系统拒绝加入并说明房间不可加入。
3. **Given** 玩家在游戏中短暂断线，**When** 玩家使用同一房间码并携带加入房间时生成的浏览器本地重连令牌重新进入，**Then** 玩家回到原席位，已分配身份、已完成动作和已提交投票保持不变。
4. **Given** 玩家在错误阶段或选择无效目标提交动作，**When** 系统接收该操作，**Then** 系统拒绝该操作、给出可理解提示，并保持当前有效游戏状态不变。

### Edge Cases

- 房间码不存在、过期、房间已满、房间已开始或已结算时，加入请求必须被拒绝并给出明确原因。
- 同一房间内昵称重复时，后加入玩家必须更换昵称才能进入。
- 角色牌在水下、没有玩家持有该初始身份时，对应行动阶段仍按规则流程经过，且不得向玩家泄露该身份是否在场。
- 可选身份未在限定时间内发动技能时，视为不发动技能；必选身份未在限定时间内选择目标时，系统自动选择一个有效目标以保证游戏继续。
- 捣蛋鬼不能选择自己作为交换目标；水鬼不能查看被交换的水下牌内容；强盗一旦查看目标玩家身份就必须交换。
- 投票最高票出现平票时，无人出局；结算仍以最终身份和“是否有人出局”判断胜负。
- 玩家在行动阶段、发言阶段或投票阶段断线时，其席位保留；计时阶段不因单个玩家断线而暂停。
- 玩家在投票阶段断线时，其席位仍参与投票；若投票超时前未重连并提交投票，系统必须为该席位自动选择一个有效投票目标并继续结算。
- 未携带匹配浏览器本地重连令牌的客户端不得取回已占用席位，即使输入相同昵称。
- 游戏结算后或所有玩家离开后，房间必须关闭并删除；第一版不保留服务端对局历史记录。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a player to create an online room by providing a display nickname and MUST return a shareable room code.
- **FR-002**: System MUST allow players to join a waiting room using a valid room code and a nickname that is unique within that room.
- **FR-003**: System MUST enforce exactly three player seats per room; a game MUST NOT start with fewer than three players and MUST NOT accept more than three players for one game.
- **FR-004**: System MUST reject joins for invalid, full, already-started, completed, or otherwise unavailable rooms with a clear user-facing reason.
- **FR-005**: System MUST initialize every game with exactly these six identity cards: 狼人、预言家、强盗、捣蛋鬼、水鬼、平民; it MUST randomly assign one card to each of three players and keep three cards as 水下的牌.
- **FR-006**: System MUST show each player only their own initial identity card at game start; other players’ identities and all 水下的牌 MUST remain hidden unless a rule-authorized action reveals them.
- **FR-007**: System MUST progress through these phases in order: all players close eyes for 5 seconds, 狼人 action for 10 seconds, 预言家 action for 10 seconds, 强盗 action for 10 seconds, 捣蛋鬼 action for 5 seconds, 水鬼 action for 5 seconds, all players open eyes, free speech, voting, settlement.
- **FR-008**: System MUST present private action choices only to players whose initial identity matches the current role phase; all other players MUST see a neutral waiting state that does not reveal private action details.
- **FR-009**: System MUST allow 狼人 to optionally view exactly one 水下的牌 during the 狼人 phase; if no choice is made before the phase ends, no 狼人 action occurs.
- **FR-010**: System MUST allow 预言家 to optionally choose exactly one of these actions during the 预言家 phase: view two 水下的牌, or view one player’s identity card; if no choice is made before the phase ends, no 预言家 action occurs.
- **FR-011**: System MUST allow 强盗 to optionally choose one other player to view during the 强盗 phase; if 强盗 chooses a target, System MUST then exchange 强盗’s own identity card with the target player’s identity card.
- **FR-012**: System MUST require 捣蛋鬼 to exchange the identity cards of the two other players without revealing either card’s content to 捣蛋鬼.
- **FR-013**: System MUST require 水鬼 to exchange their own identity card with exactly one 水下的牌 without revealing the chosen 水下的牌 content.
- **FR-014**: System MUST automatically complete a mandatory 捣蛋鬼 or 水鬼 action with a valid target if the eligible player does not choose before the phase ends, and MUST mark the action as automatically completed for settlement review.
- **FR-015**: System MUST keep track of card ownership changes and MUST use each player’s final identity card, not their initial identity card, for voting settlement.
- **FR-016**: System MUST provide an unlimited free speech phase after all action phases; no automatic countdown ends this phase, and the room owner can advance the game to voting when players are ready. The free speech phase MAY include in-room text chat, but chat messages MUST be relay-only for active room members and MUST NOT be retained as server-side match history.
- **FR-017**: System MUST allow each occupied player seat to cast exactly one vote for one other player during the voting phase. Votes MUST be counted after all occupied seats have submitted a vote, or after the voting timeout expires. If an occupied seat has not voted before timeout, System MUST automatically cast one valid vote for that seat and mark it as automatic.
- **FR-018**: System MUST determine elimination as follows: if one player has a strictly highest vote count, that player is voted out; if the highest vote count is tied, no player is voted out.
- **FR-019**: System MUST determine victory as follows: 好人 win if a final 狼人 among player seats is voted out; 好人 win if the final 狼人 is in 水下的牌 and no player is voted out; otherwise 狼人 win.
- **FR-020**: System MUST display settlement results to all players, including vote totals, voted-out player or no-out result, winning camp, final identity of each player, and final 水下的牌.
- **FR-021**: System MUST keep public room and game state synchronized for connected room members, including player list, current phase, phase completion, voting completion, and settlement result.
- **FR-022**: System MUST generate a browser-local reconnect token when a player takes a seat and MUST require the same room code plus matching token to let a disconnected player on the same device/browser reclaim that original seat before the room is closed, without changing that player’s assigned cards, completed actions, or submitted vote.
- **FR-023**: System MUST reject actions that are submitted in the wrong phase, by an ineligible player, with an invalid target, or after the relevant phase has ended, and MUST leave the current valid game state unchanged.
- **FR-024**: System MUST implement the first-version interface as a minimal text/CSS UI: roles and game states MUST be represented with text labels, colors, and simple built-in icons/emoji only, with no custom artwork, character illustrations, or nonessential animations required.
- **FR-025**: System MUST support self-hosted public-internet access for invited players using room codes, and MUST NOT include public lobby discovery, matchmaking, global user profiles, or public platform/community features in the first version.
- **FR-026**: System MUST treat rooms as temporary: after settlement is shown or all players have left, the room MUST be closed and deleted, and the first version MUST NOT retain server-side match history.
- **FR-027**: System MUST NOT collect personal information in the first version; it MAY temporarily store only room nickname, room/game state, reconnect-token data, and transient in-room chat delivery data required for active room play, and MUST delete or discard that temporary data with the room.

### Key Entities *(include if feature involves data)*

- **Room**: Represents one temporary online game space; includes room code, owner, status, player seats, current phase, whether the game has been settled, and deletion eligibility after settlement or all players leaving.
- **Player**: Represents one participant in a room; includes nickname, seat, browser-local reconnect token reference, connection status, initial identity, final identity, action completion state, and vote state.
- **Identity Card**: Represents one of the six role cards; includes role name, current location, allowed action, whether the action is optional or mandatory, and what information the role may reveal.
- **水下的牌**: Represents the three unassigned identity cards placed in the center; cards remain hidden except when viewed or exchanged by authorized role actions.
- **Role Action**: Represents a role-phase decision or automatic mandatory action; includes acting role, selected targets, action outcome, visibility of revealed information, and whether the action was manual or automatic.
- **Vote**: Represents one player’s accusation during the voting phase; includes voter, selected target, and submission status.
- **Settlement**: Represents the final outcome; includes final card positions, vote totals, eliminated player if any, and winning camp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing, a new room owner can create a room, share the room code, have two players join, and start the game within 2 minutes.
- **SC-002**: 95% of visible room or game state changes are shown to all affected connected players within 2 seconds.
- **SC-003**: In 100 controlled game-rule test runs covering all six identities, role actions, swaps, tie votes, and wolf-underwater cases, the final identities and winning camp match this specification 100% of the time.
- **SC-004**: In privacy validation tests, unauthorized players see zero private card contents or private action results during hidden role phases.
- **SC-005**: At least 90% of three-player test groups complete a full game from room creation to settlement without moderator assistance or support intervention.
- **SC-006**: 100% of tested invalid actions and invalid join attempts produce clear feedback and do not change valid room or game state.
- **SC-007**: Privacy validation confirms that the first version stores no personal information beyond temporary nicknames, active room/game state, reconnect token data, and transient in-room chat delivery data, and that this temporary data is deleted or discarded when the room is deleted.

## Assumptions

- The first version supports self-hosted, invite-only room-based games with exactly three players and no spectators.
- Players identify themselves by room nickname plus browser-local reconnect token for seat recovery; persistent user accounts and personal information collection are not required for this feature.
- The role deck is fixed to the six cards listed in `game_rule.md`: 狼人、预言家、强盗、捣蛋鬼、水鬼、平民.
- A room represents one completed game; starting another game requires creating a new room, and completed or abandoned rooms are deleted without server-side history.
- The free speech phase includes in-room text communication as the default online communication method; voice and video chat are outside the first-version scope.
- The room owner controls starting the game and advancing from unlimited free speech to voting.
- Mandatory role actions use an automatic valid target when the player does not choose before timeout so the game cannot stall indefinitely.
- Any tied highest vote count means no player is voted out; if a final 狼人 is among player seats and no 狼人 is voted out, 狼人 win.
- Player disconnection does not pause timed phases; the player may rejoin the original seat before the room closes.
