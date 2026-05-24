# Feature Specification: Clarify MVP Role Actions and Voting Timeout

**Feature Branch**: `002-clarify-mvp-timeout`

**Created**: 2026-05-22

**Status**: Draft

**Input**: User description: "to clarify MVP role-action scope and voting timeout."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - MVP includes complete role actions (Priority: P1)

Players can complete the first playable online room game without skipping or deferring any identity-card role behavior. The MVP game flow includes every role phase, all allowed role choices, required exchanges, automatic fallback for mandatory actions, private information handling, voting, and settlement using final identities.

**Why this priority**: A game labeled as MVP must be a complete playable version of the rules. If role actions are deferred, the MVP cannot validate the core hidden-information gameplay.

**Independent Test**: Run controlled games covering each initial identity and underwater-card arrangement; verify that each role phase appears, eligible players can perform the correct action, required exchanges happen, skipped optional actions remain skipped, and settlement uses final identities.

**Acceptance Scenarios**:

1. **Given** a three-player MVP game has started, **When** the game reaches each identity phase, **Then** the game presents the phase in rules order even if that identity is not currently held by a player.
2. **Given** a player holds 狼人, 预言家, or 强盗 as their initial identity, **When** their matching phase is active, **Then** the player can choose only that role's allowed optional action or allow the phase to end with no optional action.
3. **Given** a player holds 捣蛋鬼 or 水鬼 as their initial identity, **When** their matching phase is active, **Then** the player must complete the required exchange or the game completes a valid automatic exchange when the phase ends.
4. **Given** any role action reveals or changes card locations, **When** other players observe the game state before settlement, **Then** they do not see private card contents or private action results that the rules do not authorize.
5. **Given** role actions have changed card ownership, **When** the game reaches settlement, **Then** elimination and winning camp are calculated from final identities rather than initial identities.

---

### User Story 2 - Voting has a clear fixed timeout (Priority: P2)

Players entering voting see a fixed voting window and understand that the game will continue automatically if any player does not vote in time. Submitted votes are counted as soon as all occupied seats vote, or automatically completed when the timeout expires.

**Why this priority**: Voting must not stall an online game, especially when a player disconnects or becomes inactive. A fixed timeout makes behavior predictable for players and testable for acceptance.

**Independent Test**: Start voting with three occupied seats, submit zero, one, two, and three votes before the timeout, and verify that counting occurs immediately after all votes or after automatic valid votes are assigned at timeout.

**Acceptance Scenarios**:

1. **Given** the game enters voting, **When** the voting phase opens, **Then** all players are told that the voting window lasts 60 seconds.
2. **Given** all occupied seats cast one valid vote before 60 seconds elapse, **When** the final vote is submitted, **Then** votes are counted immediately without waiting for the remaining time.
3. **Given** one or more occupied seats have not voted when 60 seconds elapse, **When** the voting window ends, **Then** the game automatically assigns one valid vote for each non-voting seat, marks those votes as automatic, and proceeds to settlement.
4. **Given** a player tries to vote twice, vote for themselves, vote after voting is closed, or vote for an invalid target, **When** the game receives the vote attempt, **Then** the game rejects it with clear feedback and keeps the valid voting state unchanged.

---

### User Story 3 - MVP boundaries are unambiguous for planning and testing (Priority: P3)

Product stakeholders, testers, and implementers can determine whether a proposed MVP slice is complete by checking one agreed boundary: MVP completion requires full role-action rules and the fixed 60-second voting timeout.

**Why this priority**: Clear scope prevents a planning mismatch where a demo is called MVP even though core role behavior or voting completion is missing.

**Independent Test**: Review the MVP acceptance checklist for a build or plan and confirm that no complete-game milestone excludes role actions, private-role visibility, automatic mandatory actions, final-identity settlement, or the fixed voting timeout.

**Acceptance Scenarios**:

1. **Given** an MVP plan or release candidate claims to support a full game, **When** stakeholders review MVP scope, **Then** all six identity cards and their role effects are included in the same MVP scope.
2. **Given** an MVP plan or release candidate defines voting, **When** stakeholders review voting behavior, **Then** the 60-second voting window, immediate all-votes counting, automatic valid votes, and automatic-vote marking are included.
3. **Given** a plan separates happy-path room flow from role actions, **When** it labels the happy path as a complete playable MVP, **Then** the label is rejected until complete role-action behavior is included or the milestone is renamed as a non-complete internal slice.

### Edge Cases

- Role identity cards may be underwater or absent from player seats; their phases still occur and must not reveal whether the role is present.
- Optional role actors may take no action before their phase ends; no optional fallback action is performed.
- Mandatory role actors may disconnect or remain inactive; a valid automatic exchange is performed when the phase ends.
- The final player vote may arrive exactly as the 60-second voting window expires; the game must count one valid vote per occupied seat and must not count duplicates.
- A disconnected player's seat remains occupied for voting; if the seat has not voted by timeout, it receives one valid automatic vote.
- Settlement must distinguish manually submitted votes from automatic votes for player review.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Any milestone described as a complete playable MVP MUST include all identity-card role phases and role effects for 狼人、预言家、强盗、捣蛋鬼、水鬼、平民.
- **FR-002**: The MVP MUST NOT defer role-action validation, private role information handling, card exchanges, automatic mandatory actions, or final-identity settlement to a later post-MVP milestone.
- **FR-003**: The game MUST progress through all role phases in rules order, including phases for identities that are underwater or not initially held by any player, without revealing role presence to ineligible players.
- **FR-004**: During optional role phases, eligible players MUST be able to perform only the rule-authorized optional action for their initial identity, and no optional action MUST occur if the eligible player makes no valid choice before that phase ends.
- **FR-005**: During mandatory role phases, eligible players MUST complete the required exchange, and the game MUST complete a valid automatic exchange if the eligible player does not choose in time.
- **FR-006**: Role actions MUST preserve hidden-information rules: players only see private card contents or action results that the rules explicitly authorize before settlement.
- **FR-007**: The game MUST track card ownership changes caused by role actions and MUST use final identities for elimination and winning-camp settlement.
- **FR-008**: The voting phase MUST use a fixed 60-second voting window starting when voting opens.
- **FR-009**: Each occupied player seat MUST be allowed exactly one valid vote for another occupied player during the voting window.
- **FR-010**: If all occupied seats submit valid votes before the 60-second window ends, the game MUST count votes immediately and proceed to settlement.
- **FR-011**: If the 60-second window ends with one or more occupied seats missing a valid vote, the game MUST assign one valid automatic vote for each missing seat, mark each automatic vote, count votes, and proceed to settlement.
- **FR-012**: The game MUST reject duplicate, self-targeted, late, or otherwise invalid vote attempts with understandable feedback and without changing the valid voting state.
- **FR-013**: Settlement results MUST show vote totals and identify which votes, if any, were automatic.
- **FR-014**: Planning, acceptance testing, and release readiness materials MUST treat complete role actions and the fixed 60-second voting timeout as required MVP acceptance criteria.

### Key Entities *(include if feature involves data)*

- **MVP Scope Boundary**: The agreed set of capabilities required before the online room game may be called a complete playable MVP.
- **Role Action**: A rule-authorized action tied to an initial identity, including optional views, required or optional exchanges, automatic fallback status, and visibility limits.
- **Voting Window**: The 60-second period in which occupied player seats may submit one valid vote before automatic completion.
- **Automatic Vote**: A system-selected valid vote assigned to an occupied seat that did not submit a valid vote before the voting window ended.
- **Settlement Review**: The final player-facing outcome that includes vote totals, automatic-vote markings, eliminated or no-out result, winning camp, and final identities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of controlled MVP rule tests covering all six identities verify correct action availability, card changes, privacy behavior, and final-identity settlement.
- **SC-002**: 100% of voting tests with zero, partial, and complete manual votes settle correctly using the 60-second voting window and automatic valid votes when required.
- **SC-003**: In player testing, at least 95% of participants can identify the remaining voting time and whether their vote was submitted without moderator assistance.
- **SC-004**: Privacy validation finds zero unauthorized private card contents or private role-action results visible before settlement.
- **SC-005**: 100% of MVP readiness reviews confirm that complete role actions and fixed voting timeout behavior are included before a build is labeled as a complete playable MVP.

## Assumptions

- The existing online room game rules remain authoritative for the exact role effects, allowed targets, victory conditions, and hidden-information boundaries.
- "Complete playable MVP" means the first externally demoable version that lets three players complete a full rules-accurate game, not an internal technical slice.
- The voting timeout default is 60 seconds because it is long enough for three invited players to choose while preventing stalled games.
- The game continues to use exactly three occupied player seats and no spectators for this MVP clarification.
- Disconnect and inactivity behavior should favor continuing the game with valid automatic choices rather than pausing indefinitely.
