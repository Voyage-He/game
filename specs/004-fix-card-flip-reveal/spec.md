# Feature Specification: 修复身份牌翻转展示与技能查看

**Feature Branch**: `004-fix-card-flip-reveal`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "虽然不需要特别的美术投入，但是目前的呈现和操作很差。问题如下：预言家和狼人发动技能的显示逻辑不清晰，游戏开始后应该用一张属竖直的长方形表示一名玩家，【水下的牌】显示三张牌形状，当发动技能的时候，牌翻转动画，显示身份。同时存在bug，预言家和狼人发动技能后无法查看到身份牌。"

## Clarifications

### Session 2026-05-23

- Q: 狼人技能的实际行为（只有一张狼人牌，不存在另一名狼人同伴） → A: 狼人查看水下牌中的一张牌（任选一张翻开查看身份）。
- Q: 强盗技能查看身份牌是否需要纳入范围（game_rule.md 规定强盗查看一名玩家身份后交换） → A: 纳入范围，使用相同的卡牌翻转动画展示身份，查看后执行交换。

## Constitution Alignment *(mandatory)*

- **服务端权威与规则一致性**: 身份牌内容和技能查看结果始终以服务器返回的身份数据为准；牌翻转动画仅为客户端视觉效果，不改变服务器端的身份状态。技能触发逻辑遵循既有规则（预言家查看任意一名玩家的身份或两张水下牌、狼人查看水下牌中的一张牌、强盗查看一名玩家的身份后必须交换）。
- **临时数据与隐私最小化**: 本修复不新增持久数据；技能查看结果仅在当前对局的当前阶段内临时展示，阶段结束后不再保留在客户端可访问区域。水下牌内容仅对有权查看的玩家角色（预言家、狼人）在技能阶段临时可见。强盗查看的目标玩家身份在查看后因交换而成为强盗的新身份，该信息在技能阶段结束后随身份持有状态自然延续。
- **测试先行与契约可验证**: 必须覆盖：预言家技能查看身份牌的可见性、狼人技能查看水下牌身份的可见性、强盗技能查看玩家身份的可见性及交换后状态、牌翻转动画的触发时机、水下牌三张卡牌形状的正确展示、技能阶段结束后身份牌重新隐藏。
- **简洁自托管架构**: 本修复不新增账号、公开大厅、匹配、旁观者、持久化历史、外部服务或自定义美术资产。牌翻转效果使用简单几何图形变换实现，不依赖外部动画库或图片资源。
- **清晰中文体验与实时可用性**: 身份牌的名称、技能阶段的提示文字、水下牌的标签必须使用清晰中文；牌翻转动画应在技能触发后立即执行，延迟不超过用户可感知范围。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 预言家技能查看身份牌 (Priority: P1)

作为获得预言家身份的玩家，我在自己的行动阶段选择一个目标（另一名玩家或两张水下牌）发动技能后，能够清晰看到目标身份牌翻转展示身份内容，以便做出后续推理和决策。

**Why this priority**: 预言家无法查看身份牌是一个阻塞性 Bug，导致该角色的核心玩法完全失效。这是影响游戏可玩性的最高优先级问题。

**Independent Test**: 开始一局游戏，确保至少一名玩家获得预言家身份。在预言家行动阶段选择查看目标，验证身份牌以翻转动画展示身份内容，且身份内容正确显示。

**Acceptance Scenarios**:

1. **Given** 预言家玩家进入自己的行动阶段，**When** 预言家选择查看另一名玩家的身份，**Then** 该目标玩家的身份牌执行翻转动画，展示真实身份内容（狼人、强盗、捣蛋鬼、水鬼、平民之一），且身份内容在技能阶段内保持可见。
2. **Given** 预言家玩家进入自己的行动阶段，**When** 预言家选择查看两张水下牌，**Then** 两张被选中的水下牌执行翻转动画，展示各自的身份内容，且身份内容在技能阶段内保持可见。
3. **Given** 预言家技能已发动并查看了身份，**When** 当前身份技能阶段结束进入下一阶段，**Then** 被翻开的身份牌恢复为面朝下状态，不再显示身份内容。
4. **Given** 预言家玩家已查看身份，**When** 玩家刷新页面或断线重连且仍在同一技能阶段内，**Then** 技能查看结果（已翻开的目标身份牌）仍然可见。

---

### User Story 2 - 狼人技能查看水下牌 (Priority: P1)

作为获得狼人身份的玩家，我在自己的行动阶段发动技能后，能够从三张水下牌中选择一张翻开查看其身份内容，以便获取隐藏信息辅助后续推理和伪装。

**Why this priority**: 狼人无法查看身份牌是一个阻塞性 Bug，导致狼人角色的核心信息获取完全失效。与预言家 Bug 同等优先级。

**Independent Test**: 开始一局游戏，确保一名玩家获得狼人身份。在狼人行动阶段，狼人从三张水下牌中选择一张，验证该水下牌以翻转动画展示身份内容。

**Acceptance Scenarios**:

1. **Given** 狼人玩家进入自己的行动阶段，**When** 狼人从三张水下牌中选择一张翻开，**Then** 被选中的水下牌执行翻转动画，展示真实身份内容（预言家、强盗、捣蛋鬼、水鬼、平民之一，或确认狼人牌不在水下牌中*），且身份内容在技能阶段内保持可见。
2. **Given** 狼人技能已发动并查看了水下牌身份，**When** 当前狼人技能阶段结束进入下一阶段，**Then** 被翻开的水下牌恢复为面朝下状态，不再显示身份内容。
3. **Given** 狼人玩家已查看水下牌，**When** 玩家刷新页面或断线重连且仍在同一技能阶段内，**Then** 技能查看结果（已翻开的水下牌）仍然可见。

> *注：由于每张身份牌仅有一张，若狼人身份在玩家席位中，水下牌中不存在狼人牌；狼人翻开的水下牌必为其他五种身份之一。

---

### User Story 3 - 强盗技能查看并交换身份牌 (Priority: P2)

作为获得强盗身份的玩家，我在自己的行动阶段选择一名目标玩家发动技能后，能够清晰看到该玩家的身份牌翻转展示身份内容，随后系统执行身份交换，以便我获取对方身份并完成规则要求的交换操作。

**Why this priority**: 强盗同样需要查看其他玩家的身份牌，game_rule.md 明确规定了此技能。虽然用户原始报告未单独提及强盗，但其卡牌查看机制与预言家一致，纳入本次修复可避免重复工作且确保完整性。

**Independent Test**: 开始一局游戏，确保一名玩家获得强盗身份。在强盗行动阶段选择一名目标玩家，验证该玩家的身份牌以翻转动画展示身份内容，随后强盗的自身身份牌更新为交换后的身份。

**Acceptance Scenarios**:

1. **Given** 强盗玩家进入自己的行动阶段，**When** 强盗选择一名目标玩家查看身份，**Then** 目标玩家的身份牌执行翻转动画，展示真实身份内容，且身份内容在强盗端可见。
2. **Given** 强盗已查看目标玩家身份，**When** 系统执行身份交换（强盗身份与目标玩家身份互换），**Then** 强盗玩家的自身卡牌身份内容更新为交换后的新身份（原目标玩家身份），目标玩家的卡牌身份内容更新为强盗原身份。
3. **Given** 强盗技能已完成查看和交换，**When** 当前强盗技能阶段结束进入下一阶段，**Then** 被翻开的他人身份牌恢复为面朝下状态（强盗不再能看到目标玩家当前身份），但强盗自身因交换获得的身份牌在后续游戏中按持有者可见规则正常显示。
4. **Given** 强盗已查看并交换身份，**When** 玩家刷新页面或断线重连且仍在同一技能阶段内，**Then** 技能查看结果（已翻开的目标身份牌）和交换后的新身份状态仍然可见。

---

### User Story 4 - 竖直卡牌展示玩家与水下牌 (Priority: P2)

作为任意玩家，我在游戏开始后看到每名玩家以竖直长方形卡牌的形式呈现在游戏界面上，同时看到三张水下牌以面朝下的卡牌形状展示，以便清晰辨认场上玩家身份位置和水下牌区域。

**Why this priority**: 清晰的视觉呈现是技能查看功能的基础。卡牌化展示提升了整体界面的可理解性，但不是阻塞性修复，可以在 P1 Bug 修复之后实施。

**Independent Test**: 开始一局三人游戏，验证游戏界面显示三名玩家各自对应一张竖直长方形卡牌，以及三张面朝下的水下牌卡牌形状。

**Acceptance Scenarios**:

1. **Given** 一局新游戏开始，**When** 玩家查看游戏主界面，**Then** 每名在线玩家（含自己）各由一个竖直长方形卡牌元素表示，卡牌上显示玩家昵称。
2. **Given** 一局新游戏开始，**When** 玩家查看游戏主界面，**Then** 水下牌区域显示三张面朝下的卡牌形状，标注"水下的牌"中文标签。
3. **Given** 游戏进行中某玩家断线，**When** 其他玩家查看界面，**Then** 该断线玩家的卡牌仍然显示但带有断线标识（如灰暗或断线文字提示），不影响卡牌布局。
4. **Given** 玩家以不同设备或窗口大小查看游戏，**When** 界面渲染，**Then** 卡牌保持合理的竖直长方形比例，不会严重变形或重叠。

---

### User Story 5 - 身份牌翻转动画效果 (Priority: P3)

作为发动技能的预言家、狼人或强盗玩家，我在技能触发时看到目标身份牌从面朝下状态平滑翻转为面朝上状态，展示身份内容，从而清楚感知技能已成功执行并且结果已呈现。

**Why this priority**: 翻转动画是锦上添花的体验优化，让技能查看结果更直观。核心功能（身份内容可查看）在 P1 已覆盖，动画效果是提升操作反馈清晰度的增强。

**Independent Test**: 在预言家、狼人或强盗技能发动时，观察目标身份牌是否从面朝下状态执行视觉翻转变为面朝上状态，动画完成后展示身份内容。

**Acceptance Scenarios**:

1. **Given** 一张面朝下的身份牌（玩家卡牌或水下牌），**When** 有权查看的玩家技能触发该牌翻转，**Then** 身份牌在 0.3–0.8 秒内执行视觉翻转效果（沿竖直中轴旋转或类似变换），最终显示面朝上的身份内容。
2. **Given** 身份牌翻转动画正在进行中，**When** 动画完成，**Then** 身份内容（身份中文名称）立即可读，无闪烁或显示错误。
3. **Given** 玩家在技能阶段内多次查看同一身份（如重连后），**When** 身份牌需要再次展示，**Then** 不重复执行翻转动画（牌已处于面朝上状态），直接显示身份内容。

### Edge Cases

- 预言家选择查看水下牌时，仅被选中的两张牌翻转展示，第三张未被选中的水下牌保持面朝下状态。
- 狼人选择翻开一张水下牌时，仅被选中的那张牌翻转展示，其余两张水下牌保持面朝下状态。
- 强盗查看目标玩家身份后必须执行身份交换：强盗自身卡牌身份更新为目标玩家原身份，目标玩家卡牌身份更新为强盗原身份。交换完成后，强盗仍能看到自己交换后的身份（因为这是其当前持有身份），但不能再看到目标玩家交换后的身份。
- 预言家或狼人技能发动后，非技能发动者（其他玩家）不应看到任何身份牌翻转或身份内容。
- 技能阶段倒计时结束而玩家未选择目标时，按既有规则处理（如自动选择或跳过），不得强制触发牌翻转动画。
- 玩家在牌翻转动画进行中刷新页面或断线，重连后若仍在同一技能阶段且技能已发动，应直接显示面朝上的身份牌（跳过动画）。
- 多局连续游戏中，上一局的牌翻转状态不得残留到新一局的界面。
- 如果预言家在技能阶段开始前已通过狼人技能（原狼人身份后来被强盗交换）或其他方式知道某身份，仍应能通过卡牌翻转正常查看技能目标身份。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST ensure that when a 预言家 player activates their skill and selects a target (another player or two 水下牌 cards), the target identity card(s) become visible to the 预言家 with the correct identity content.
- **FR-002**: System MUST ensure that when a 狼人 player activates their skill, the 狼人 can select one of the three 水下牌 cards to flip and view its identity content, with the correct identity displayed after the flip.
- **FR-003**: System MUST ensure that when a 强盗 player activates their skill and selects a target player, the target player's identity card flips and displays the correct identity content to the 强盗, and the system then executes the mandatory identity swap between the 强盗 and the target player.
- **FR-004**: System MUST render each player (including self) as a vertical rectangular card element after the game starts, displaying the player's nickname on the card.
- **FR-005**: System MUST render the three 水下牌 as three face-down card shapes in a designated area with a Chinese label "水下的牌".
- **FR-006**: System MUST execute a card-flip visual transition (rotation or equivalent transform) when an identity card changes from face-down to face-up as a result of a skill activation, completing within 0.3–0.8 seconds.
- **FR-007**: System MUST display the identity content (Chinese role name) on the face-up side of a flipped card after the flip animation completes.
- **FR-008**: System MUST revert flipped identity cards back to face-down state when the current skill phase ends and the game advances to the next phase.
- **FR-009**: System MUST NOT repeat the flip animation for a card that is already in the face-up state within the same skill phase (e.g., after reconnect).
- **FR-010**: System MUST preserve skill-view results: if a player reconnects during the same skill phase after their skill has been activated, the previously revealed identity card(s) must still be shown face-up.
- **FR-011**: System MUST NOT expose any flipped identity content to players who are not the skill activator (other players see only face-down cards throughout).
- **FR-012**: System MUST handle the 水下的牌 selection for 预言家 correctly: when the 预言家 chooses to view two 水下牌 cards, only the two selected cards flip; the third unselected card remains face-down.
- **FR-013**: System MUST indicate a disconnected player's card with a distinguishable visual state (e.g., dimmed or labeled) while maintaining the vertical card layout.
- **FR-014**: System MUST clear all flipped card states when a new game starts, ensuring no residual card-face data from the previous game appears.
- **FR-015**: System MUST display all role names, phase prompts, card labels, and status messages in clear Chinese.

### Key Entities *(include if feature involves data)*

- **Player Card**: Visual representation of a player seat; displays nickname, has a face-down default state, and can flip to face-up to reveal identity content when a skill targets that player. Each game has exactly three player cards.
- **水下牌 Card**: Visual representation of one of the three undealt identity cards; always shown face-down to non-privileged players, can flip to face-up when the 预言家 skill targets it. Exactly three per game.
- **Card Flip Animation**: The visual transition effect from face-down to face-up state, triggered by skill activation. Duration: 0.3–0.8 seconds.
- **Skill View Result**: Temporary data holding which identity cards have been revealed to which player during the current skill phase; cleared when the phase ends.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 20 tests of 预言家 skill activation (10 viewing a player, 10 viewing two 水下牌 cards), 100% of activations result in the 预言家 seeing the correct target identity content on flipped cards.
- **SC-002**: In 10 tests of 狼人 skill activation, 100% of activations result in the 狼人 seeing the correct identity content of the selected 水下牌 card after flip, and the unselected two 水下牌 cards remain face-down.
- **SC-003**: In 10 tests of 强盗 skill activation, 100% of activations result in the 强盗 seeing the correct target player identity on a flipped card, and the identity swap executes correctly (强盗's card shows the target's original identity, target's card shows 强盗's original identity).
- **SC-004**: In all skill-activation tests, non-activating players observe zero instances of another player's identity being exposed through card flips before settlement.
- **SC-005**: Card flip animation completes within 0.3–0.8 seconds in 100% of skill-activation tests under normal conditions.
- **SC-006**: In 10 reconnect tests during an active skill phase after skill activation, 100% of reconnecting players see the previously revealed cards still face-up with correct identity content.
- **SC-007**: In 5 new-game-start tests after a completed game, 100% of games show all cards face-down with no residual identity content from the previous game.
- **SC-008**: Three player cards and three 水下牌 cards are rendered in correct vertical rectangular proportions in 100% of game starts, with no overlapping or severe distortion across common window sizes.
- **SC-009**: All card labels, role names, action prompts, and status messages on the game interface are displayed in correct, understandable Chinese in 100% of manual review checks.

## Assumptions

- This feature builds on the existing three-player Werewolf game (specs 001, 002, 003), including the countdown fix and identity allocation from spec 003.
- Card flip animation uses simple geometric visual transitions (rotation around the vertical axis or equivalent two-state transform) without external animation libraries or custom image assets, consistent with the user's statement that no special art investment is needed.
- "Vertical rectangular card" means a card shape taller than it is wide, with a standard playing-card-like aspect ratio (approximately 2:3 or 3:4), displayed as a simple colored rectangle with text overlay.
- Face-down state is represented by a solid-color card back (e.g., a pattern or neutral color) covering the identity content.
- The 狼人 skill requires the player to select one of the three 水下牌 cards to flip and view its identity; the wolf cannot view player cards during this phase (only 水下牌).
- The 强盗 skill requires the player to select a target player, view that player's identity card with flip animation, then execute the mandatory swap. After swap, the 强盗's own card reflects the new (swapped) identity; the flipped target player card returns to face-down at phase end.
- The 预言家 skill requires the player to choose between viewing another player's identity or viewing two 水下牌 cards, consistent with the game's existing rule set.
- Player cards maintain their position and association with player seats; card positions do not need to be rearranged during the game.
- The interface adapts to different screen sizes by scaling card elements proportionally, not by changing layout structure.
