# Feature Specification: 点击卡牌直接翻转揭示身份

**Feature Branch**: `005-click-to-reveal`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "玩家发动技能的时候没有获得信息，我需要的是通过点击卡牌，卡牌翻转获得信息，而不是点击选项"

## Clarifications

### Session 2026-05-23

- Q: 预言家查看水下牌是否需要两步选择（先选中再确认）？ → A: 不需要。预言家点击水下牌应当立即翻转展示身份，每张牌独立点击独立翻转，可点击最多 2 张。无中间"已选中但未翻牌"状态。
- Q: 捣蛋鬼可选目标不足（如其他玩家断线）？ → A: 断线玩家的卡牌仍然可点击，因为游戏规则要求必须交换且断线不影响身份牌存在性。若所有目标均无法通过正常点击提交，倒计时结束后由服务器自动行动规则处理。

## Constitution Alignment *(mandatory)*

- **服务端权威与规则一致性**: 卡牌是否可点击、点击后触发何种技能逻辑，始终以服务端下发的 `currentEligibleAction` 和玩家身份为准。客户端仅将点击事件转换为对应的技能行动事件（`action:wolf`、`action:seer`、`action:robber` 等），服务器负责验证行动合法性、执行身份揭示/交换逻辑，并通过 `state:private` 下发 `revealedCards`。不改变任何服务端技能规则。
- **临时数据与隐私最小化**: 客户端仅在技能阶段内维护"当前已翻开的水下牌计数"和"捣蛋鬼已选中的卡牌"等最小临时状态，用于限制可点击次数和防止重复提交。阶段切换或行动提交后立即清除。预言家查看水下牌每张独立点击并立即翻转，不保留中间"选中但未翻牌"状态。不通过卡牌点击暴露任何额外隐私，仅将点击事件映射为已有的技能行动协议。非行动玩家的卡牌始终不可点击。
- **测试先行与契约可验证**: 必须覆盖：卡牌在技能阶段内的可点击性、点击卡牌后技能事件是否正确发出、点击目标与服务器期望的 payload 是否一致、预言家连续点击两张水下牌各触发独立翻转、捣蛋鬼两步选择的中间状态和取消逻辑、非行动玩家点击卡牌无响应、阶段结束后卡牌不可点击。
- **简洁自托管架构**: 不新增外部依赖、服务或持久化存储。卡牌可点击样式使用纯 CSS `cursor: pointer` 和 `:hover` 伪类实现，不引入额外图片或动画库。点击交互通过已有的 Socket.IO 事件通道处理。
- **清晰中文体验与实时可用性**: 卡牌可点击状态的中文提示文字清晰可读；捣蛋鬼两步选择的提示语为中文；预言家每次点击水下牌立即翻转无需中间提示；点击无响应时提供合理的中文反馈（如"当前不是你的行动阶段"）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 狼人点击水下牌直接翻转查看 (Priority: P1)

作为狼人身份玩家，在我的行动阶段内，我直接点击一张水下牌即可翻转该牌查看其身份内容，无需通过按钮菜单选择目标。点击后卡牌立即执行翻转动画并展示身份结果。

**Why this priority**: 狼人的技能仅需点击一张水下牌即可完成，是最简单直接的单步交互，且狼人无法查看身份牌是报告的核心问题之一。实现此故事即可验证卡牌点击交互模型的可行性。

**Independent Test**: 开始一局三人游戏，确保一名玩家获得狼人身份。在狼人行动阶段，直接点击三张水下牌中的任意一张，验证该卡牌翻转并展示正确身份。

**Acceptance Scenarios**:

1. **Given** 狼人玩家进入狼人行动阶段、水下牌均面朝下显示，**When** 狼人点击一张水下牌，**Then** 该水下牌执行翻转动画，面朝上展示其真实身份内容，且狼人行动立即完成（不可再点击其他水下牌）。
2. **Given** 狼人玩家已在当前行动阶段点击并翻开了某张水下牌，**When** 狼人尝试点击其他水下牌或玩家卡牌，**Then** 无响应（行动已提交）。
3. **Given** 非狼人身份玩家处于狼人行动阶段（狼人是其他玩家），**When** 该玩家尝试点击任何卡牌，**Then** 卡牌不翻转，不触发任何行动。
4. **Given** 狼人行动阶段结束进入预言家行动阶段，**When** 狼人玩家（此时不再处于行动中）点击卡牌，**Then** 卡牌不可点击、无响应。

---

### User Story 2 - 预言家点击卡牌翻转查看 (Priority: P1)

作为预言家身份玩家，在我的行动阶段内，我可以直接点击另一名玩家的卡牌来查看其身份（单张翻转，行动立即完成），或直接点击水下牌——每次点击立即翻转该牌展示身份，最多可点击两张水下牌。每张牌的翻转独立触发，无需中间确认步骤。所有目标选择均通过点击卡牌本身完成，无需通过菜单按钮。

**Why this priority**: 预言家是报告中最核心的受阻角色。预言家有两种可选行动模式（查看一名玩家 或 查看两张水下牌），直接点击卡牌是最自然的交互方式。与狼人同为 P1 核心修复。

**Independent Test**: 开始一局三人游戏，确保一名玩家获得预言家身份。在预言家行动阶段：(a) 点击另一名玩家的卡牌 → 该卡牌立即翻转展示身份，行动完成；(b) 点击第一张水下牌 → 该牌立即翻转展示身份（消耗一次查看次数）→ 点击第二张水下牌 → 该牌立即翻转展示身份，行动完成。验证两种路径的每张牌均在点击后立即翻转并展示正确身份内容。

**Acceptance Scenarios**:

1. **Given** 预言家玩家进入预言家行动阶段，**When** 预言家直接点击另一名玩家的卡牌，**Then** 该目标玩家的身份牌立即执行翻转动画展示真实身份，预言家行动完成（不可再点击任何卡牌）。
2. **Given** 预言家玩家进入预言家行动阶段，**When** 预言家点击一张水下牌，**Then** 该水下牌立即执行翻转动画展示真实身份，界面提示"已查看 1/2 张水下牌，可再点击一张水下牌查看"。
3. **Given** 预言家已点击并翻开了第一张水下牌，**When** 预言家点击第二张不同的水下牌，**Then** 第二张水下牌立即执行翻转动画展示真实身份，界面提示"已查看 2/2 张水下牌"，行动完成。
4. **Given** 预言家已点击并翻开了第一张水下牌，**When** 预言家点击已翻开的同一张水下牌，**Then** 无响应（该牌已翻开，不可重复查看）。
5. **Given** 预言家已点击并翻开了第一张水下牌（水下牌模式已激活），**When** 预言家点击另一名玩家的卡牌，**Then** 无响应——因为预言家已通过点击水下牌进入了水下牌查看路径，不可在同一阶段内切换为查看玩家模式。
6. **Given** 预言家第一张牌点击了玩家卡牌（玩家模式已激活），**When** 预言家尝试再点击水下牌，**Then** 无响应——因为查看一名玩家后行动已完成。
7. **Given** 预言家已翻看了身份（无论水下牌或玩家），**When** 当前阶段结束进入下一阶段，**Then** 翻开的卡牌恢复面朝下状态，不再显示身份内容。

---

### User Story 3 - 强盗点击玩家卡牌翻转查看并交换 (Priority: P2)

作为强盗身份玩家，在我的行动阶段内，我直接点击另一名玩家的卡牌即可翻转查看其身份，随后系统自动执行身份交换。整个过程仅需一次卡牌点击，无需通过按钮菜单。

**Why this priority**: 强盗同样需要点击查看其他玩家的身份牌，与狼人/预言家的卡牌点击交互模式一致。P2 优先级因为强盗技能涉及查看和交换两步逻辑，但交互本身仍为简单的单次卡牌点击。

**Independent Test**: 开始一局三人游戏，确保一名玩家获得强盗身份。在强盗行动阶段，点击另一名玩家的卡牌 → 卡牌翻转展示身份 → 强盗自身身份更新为交换后的新身份。验证强盗能看到目标身份且身份交换正确执行。

**Acceptance Scenarios**:

1. **Given** 强盗玩家进入强盗行动阶段，**When** 强盗点击另一名玩家的卡牌，**Then** 该目标玩家的身份牌执行翻转动画展示真实身份，随后强盗自身卡牌的身份信息更新为交换后的新身份（目标玩家原身份）。
2. **Given** 强盗已点击并查看了目标玩家身份（身份交换已完成），**When** 强盗尝试点击其他卡牌，**Then** 无响应（行动已提交）。
3. **Given** 强盗行动阶段结束进入下一阶段，**When** 系统推进阶段，**Then** 强盗不再能看到已交换目标玩家当前的身份（因为对方已是强盗的原身份），但强盗自身的交换后身份作为其当前持有身份正常可见。

---

### User Story 4 - 捣蛋鬼和水鬼点击卡牌选择交换目标 (Priority: P2)

作为捣蛋鬼或水鬼身份的玩家，在我的行动阶段内，我通过直接点击卡牌来选择交换目标：捣蛋鬼依次点击两名其他玩家的卡牌完成选择；水鬼点击一张水下牌完成选择。选择过程中卡牌显示选中状态，选满后自动提交行动。无需通过按钮菜单。

**Why this priority**: 捣蛋鬼和水鬼的技能不涉及身份查看（无翻转揭示），但同样需要选择目标。统一使用卡牌点击交互模型可以给所有技能角色提供一致的体验。P2 优先级因为不影响信息揭示的核心问题。

**Independent Test**: 开始一局三人游戏，确保一名玩家获得捣蛋鬼/水鬼身份。在其行动阶段：(a) 捣蛋鬼依次点击两名其他玩家卡牌，验证两张卡牌显示选中状态并最终提交；(b) 水鬼点击一张水下牌，验证该水下牌显示选中状态并提交。

**Acceptance Scenarios**:

1. **Given** 捣蛋鬼玩家进入捣蛋鬼行动阶段、且必须交换两名其他玩家的身份，**When** 捣蛋鬼点击第一名其他玩家的卡牌，**Then** 该卡牌进入选中高亮状态，界面提示"请选择第二名玩家"。
2. **Given** 捣蛋鬼已选中第一名玩家，**When** 捣蛋鬼点击第二名其他玩家卡牌，**Then** 两张卡牌均显示选中状态，自动提交交换行动。
3. **Given** 捣蛋鬼已选中第一名玩家，**When** 捣蛋鬼再次点击已选中的卡牌，**Then** 取消选中该玩家，可重新选择。
4. **Given** 水鬼玩家进入水鬼行动阶段、且必须选择一张水下牌交换，**When** 水鬼点击一张水下牌，**Then** 该水下牌进入选中高亮状态，自动提交交换行动。
5. **Given** 捣蛋鬼或水鬼行动阶段结束，**When** 系统推进阶段，**Then** 选中状态清除，卡牌恢复不可点击。

---

### User Story 5 - 卡牌可点击视觉反馈 (Priority: P3)

作为处于行动阶段中的技能持有者玩家，当我将鼠标悬停或触摸可点击的卡牌时，卡牌显示明显的可交互视觉提示（如光标变为手型、卡牌轻微放大或发光边框），让我清楚知道可以点击该卡牌。非可点击的卡牌无此反馈。

**Why this priority**: 视觉反馈是良好 UX 的增强要素，让玩家直观识别哪些卡牌可点击、哪些不可点击，减少操作困惑。P3 优先级作为体验优化，核心点击功能在 P1/P2 已覆盖。

**Independent Test**: 在狼人/预言家/强盗行动阶段，将鼠标悬停在水下牌（狼人、预言家、水鬼）或玩家卡牌（预言家、强盗、捣蛋鬼）上，验证卡牌显示可交互视觉提示。将鼠标悬停在非可点击卡牌上，验证无视觉提示。

**Acceptance Scenarios**:

1. **Given** 玩家处于自己的技能行动阶段，**When** 鼠标悬停在一张可点击的卡牌上，**Then** 光标变为手型（`cursor: pointer`），卡牌显示悬停效果（如轻微缩放、边框高亮或阴影加深）。
2. **Given** 玩家处于自己的技能行动阶段，**When** 鼠标悬停在一张不可点击的卡牌上（如自己的卡牌被强盗选择时、或非目标的卡牌），**Then** 光标保持默认箭头，卡牌无悬停效果变化。
3. **Given** 玩家不处于任何技能行动阶段（如等待他人行动、自由发言、投票），**When** 鼠标悬停在任何卡牌上，**Then** 无卡牌可点击视觉反馈。
4. **Given** 玩家在移动端触摸设备上游玩，**When** 点击可点击卡牌，**Then** 卡牌提供即时的触摸反馈（如按下状态或短暂的高亮闪烁），随后执行对应行动。

### Edge Cases

- 预言家翻开了第一张水下牌后倒计时结束：已翻开的第一张水下牌保持翻开（身份可见），未使用的第二次查看机会按既有自动行动规则处理（自动选择第二张或跳过）。
- 捣蛋鬼点击自己（或两名其他玩家中有人断线）：断线玩家的卡牌仍然可点击作为有效交换目标。游戏规则要求捣蛋鬼必须交换两名其他玩家的身份牌，断线不影响该玩家身份牌的存在性。断线玩家的卡牌保持可点击但带有离线视觉标识（灰暗），点击后正常进入选中状态。若两名其他玩家均断线，倒计时结束后按服务器自动行动规则处理。
- 玩家快速连续点击多张卡牌：系统应以服务器首次收到的行动为准，后续点击忽略（服务端权威）。客户端在发出第一次行动后立即将其他卡牌设置为不可点击。
- 网络延迟导致点击后卡牌翻转有延迟：客户端应在点击后立即显示卡牌"加载中"或"等待"状态（如轻微透明度变化），待服务端返回 `state:private` 后执行翻转动画。
- 玩家点击了已被之前技能揭示过的卡牌（如同一个水下牌在狼人阶段已被翻过）：仍需支持点击并正确展示当前身份（可能已被交换改变）。如果当前阶段该牌已被翻开（如预言家已翻开了第一张水下牌后又点击同一张），则无响应。
- 预言家阶段内，第一张点击水下牌（进入水下牌路径）后不可再点击玩家卡牌切换模式；第一张点击玩家卡牌（进入玩家路径）后行动即完成。首张点击即锁定模式。
- 预言家选择查看一名玩家时，若该玩家是水鬼且已与水下水鬼交换：预言家查看到的应是该玩家当前实际身份（服务端权威），而非其初始身份。
- 捣蛋鬼/水鬼在选择目标阶段被取消（如断线重连）：重连后若技能尚未提交，选中状态应重置为空，玩家需重新选择。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST remove all per-target selection buttons from the action panel (e.g., "选择水下 1/2/3", "查看水下 1+2", "选择 玩家X", "交换另外两名玩家") and replace them with direct card-click interaction.
- **FR-002**: System MUST make underwater cards clickable for the acting player during the wolf_action phase; clicking an underwater card triggers the `action:wolf` event with the clicked card's underwater index as payload.
- **FR-003**: System MUST make all other players' cards clickable for the acting player during the seer_action phase; clicking a player card immediately triggers `action:seer` with `mode: 'view_one_player'` and the clicked player's seat index as target.
- **FR-004**: System MUST allow the seer to click underwater cards individually during seer_action phase: each click on an unflipped underwater card immediately flips it to reveal its identity. The seer may click up to 2 different underwater cards; the action completes when either 2 underwater cards have been flipped or the seer clicks a player card (which completes the action immediately without allowing further underwater views).
- **FR-005**: System MUST prevent the seer from clicking a third underwater card after 2 have already been flipped, or clicking any card after the action is complete.
- **FR-006**: System MUST make all other players' cards clickable for the acting player during the robber_action phase; clicking a player card triggers `action:robber` with the clicked player's seat index as target.
- **FR-007**: System MUST make all other players' cards clickable for the acting player during the troublemaker_action phase; clicking the first player highlights it, clicking the second (different) player triggers `action:troublemaker` with both seat indexes as targets. Re-clicking a selected card deselects it.
- **FR-008**: System MUST make underwater cards clickable for the acting player during the water_ghost_action phase; clicking an underwater card triggers `action:water-ghost` with the clicked card's underwater index as payload.
- **FR-009**: System MUST disable all card click interactions for players who are NOT the current acting player; clicking any card as a non-acting player produces no effect.
- **FR-010**: System MUST disable all card click interactions once the acting player has submitted their action (no further clicks accepted until action result is received).
- **FR-011**: System MUST provide visual feedback (cursor: pointer, hover highlight/scale effect) on clickable cards during the acting player's skill phase.
- **FR-012**: System MUST clear all intermediate selection states (highlighted cards, pending selections) when the skill phase ends or the server returns a new `state:private`.
- **FR-013**: System MUST display a Chinese prompt text in the action panel indicating the current selection status (e.g., "请点击一张水下牌查看身份" for wolf/water-ghost, "请点击一张水下牌查看身份，最多可查看两张" followed by "已查看 1/2 张水下牌" for seer, "请选择两名其他玩家进行交换" for troublemaker).
- **FR-014**: System MUST handle the case where the countdown expires during a partially-completed selection (e.g., seer has flipped 1 of 2 underwater cards, troublemaker has selected 1 of 2 players): the partial selection/result is preserved as-is and the server's automatic action result is respected for any remaining selections not made.
- **FR-015**: System MUST NOT allow clicking on one's own player card during any skill phase (no skill requires the acting player to target themselves).
- **FR-016**: System MUST preserve the card flip animation and identity display defined in spec 004 (0.3–0.8s CSS 3D flip) when a card is revealed through direct click.

### Key Entities

- **Card Click Target**: A clickable card element (player card or underwater card) during a skill action phase. Carries metadata: card type (player/underwater), target identifier (seat index for player cards, underwater index for underwater cards), and clickable state (enabled/disabled).
- **Selection State**: Client-side temporary state tracking the current progress of multi-step card selections. For the seer: tracks how many underwater cards have been flipped (0, 1, or 2 of 2) and whether the action mode is locked to "underwater" or "player" after the first click. For the troublemaker: tracks which players have been selected (0, 1, or 2 of 2). Cleared on phase change or action completion.
- **Skill Action Event**: The Socket.IO event emitted when card click selection is complete. Mirrors the existing event names and payload schemas (`action:wolf`, `action:seer`, `action:robber`, `action:troublemaker`, `action:water-ghost`), maintaining backward compatibility with the server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 10 tests of 狼人 skill activation by clicking a card, 100% of clicks result in the correct underwater card flipping and showing its identity within 1 second of click.
- **SC-002**: In 10 tests of 预言家 skill activation by clicking a player card, 100% of clicks result in the target player's card flipping and showing the correct identity.
- **SC-003**: In 10 tests of 预言家 skill activation by clicking two underwater cards (each click immediately flips), 100% of attempts result in both cards flipping within 1 second of their respective clicks and showing correct identities. Clicking a third underwater card correctly produces no response in 100% of tests.
- **SC-004**: In 10 tests of 强盗 skill activation by clicking a player card, 100% of activations result in the target card flipping and showing the correct identity, and the identity swap executes correctly (强盗 gets target's original role).
- **SC-005**: In 10 tests of 捣蛋鬼 skill activation by clicking two player cards, 100% of attempts result in the correct two players being selected for swap.
- **SC-006**: In 10 tests of 水鬼 skill activation by clicking an underwater card, 100% of clicks result in the correct underwater card being selected for swap.
- **SC-007**: In all skill-activation tests, non-acting players experience zero card clicks triggering any action, and zero instances of seeing another player's identity exposed.
- **SC-008**: 100% of card click interactions produce a visual feedback (cursor change, hover effect) within 50ms for acting players on clickable cards.
- **SC-009**: After an action is submitted, subsequent card clicks produce zero additional actions (click-once protection) in 100% of tests.

## Assumptions

- The existing card rendering from spec 004 (player cards as `.player-card`, underwater cards as `.underwater-card`, with `.card-inner` flip structure) is in place and stable. This feature adds click handlers on top of that rendered structure.
- The server-side Socket.IO event handlers (`action:wolf`, `action:seer`, `action:robber`, `action:troublemaker`, `action:water-ghost`) and their payload schemas remain unchanged. The card click interaction simply emits the same events with the same payload format.
- The server responds to skill actions with `state:private` containing `revealedCards` (as implemented in spec 004), which drives the card flip state after a click.
- Players have a pointing device (mouse or touch) to interact with card elements. Mobile touch support is included via standard `click` / `pointer` event handling.
- The action panel still exists but shows only: the role action title, a prompt describing what to click, and the countdown timer — no target selection buttons.
- For the troublemaker's mandatory swap: since they must swap the two other players, the UI may auto-select both targets (since there are only two other players). The click interaction primarily benefits the 3+ player scenario, but for 3-player games clicking the two available targets individually still works.
- The 捣蛋鬼 phase with only one other player available (due to disconnect) is an edge case handled by existing server timeout/auto-action logic; the client UI will still render both other player cards as clickable regardless of connection status.
- Disconnected players' cards remain clickable as valid skill targets. The game must continue regardless of connection status; the disconnected player's identity card still exists in the game and must be valid for swaps/reveals. The visual disconnection indicator (dimmed card) distinguishes the state but does not prevent selection.
