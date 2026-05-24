# Data Model: 在线房间游戏

## Enumerations

### Role

Allowed values: `狼人`, `预言家`, `强盗`, `捣蛋鬼`, `水鬼`, `平民`.

Validation rules:
- A game deck always contains exactly one card for each allowed role.
- Exactly 3 cards are assigned to player seats and exactly 3 cards remain as 水下的牌.

### RoomStatus

Allowed values: `waiting`, `in_game`, `settled`, `closed`.

State transitions:
- `waiting` → `in_game` when the owner starts with exactly 3 occupied, connected seats.
- `in_game` → `settled` after all votes are submitted and settlement is calculated.
- `waiting` → `closed` when all players leave.
- `settled` → `closed` after settlement has been delivered or all players leave.

### Phase

Allowed values in order:
1. `close_eyes`
2. `wolf_action`
3. `seer_action`
4. `robber_action`
5. `troublemaker_action`
6. `water_ghost_action`
7. `open_eyes`
8. `free_speech`
9. `voting`
10. `settlement`

Validation rules:
- Server is authoritative for phase order and timed transitions.
- `free_speech` has no automatic countdown and advances only by room owner action.
- Disconnects do not pause timed phases.

## Entity: Room

Represents one temporary online game space.

Fields:
- `roomCode`: human-shareable unique room identifier.
- `ownerSeatId`: seat controlled by the room creator.
- `status`: `RoomStatus`.
- `seats`: exactly 3 `PlayerSeat` slots.
- `deck`: six `IdentityCard` records after game initialization.
- `underwaterCardIds`: exactly 3 card ids currently in the 水下 area.
- `phase`: current `Phase`, present after game starts.
- `phaseStartedAt`: timestamp for timed phases.
- `phaseEndsAt`: timestamp for timed phases; absent for unlimited free speech.
- `actions`: ordered list of `RoleAction` records.
- `votes`: map of voter seat id to `Vote`.
- `settlement`: `Settlement`, present only after voting completes.
- `createdAt`, `updatedAt`, `closedAt`: lifecycle timestamps.
- `version`: monotonically increasing state version used for client synchronization.

Relationships:
- Owns 3 `PlayerSeat` slots.
- Owns all 6 `IdentityCard` records for one game.
- Owns zero or more `RoleAction` records.
- Owns zero to 3 `Vote` records.
- Owns at most one `Settlement`.

Validation rules:
- No more than 3 occupied seats.
- A game cannot start with fewer than 3 occupied connected seats.
- New joins are rejected unless status is `waiting` and at least one seat is empty.
- Room is deleted after settlement delivery or after all players leave.
- No server-side room or match history remains after deletion.

## Entity: PlayerSeat

Represents one participant's seat in a room.

Fields:
- `seatId`: stable internal seat id.
- `seatIndex`: `0`, `1`, or `2` for display ordering.
- `nickname`: room-scoped display name.
- `isOwner`: whether this seat can start the game and advance free speech to voting.
- `connectionStatus`: `connected` or `disconnected`.
- `socketIds`: current active socket connections for this seat.
- `reconnectTokenHash`: server-side hash of browser-local reconnect token.
- `initialCardId`: card assigned at game start.
- `currentCardId`: card currently held after swaps.
- `hasCompletedCurrentAction`: phase-specific completion marker.
- `voteSubmitted`: whether this seat has cast its one vote in the voting phase.
- `joinedAt`, `lastSeenAt`: temporary lifecycle timestamps.

Relationships:
- Belongs to one `Room`.
- References one initial `IdentityCard` after game start.
- References one current `IdentityCard` after game start.
- May own one action for its eligible initial-role phase.
- May own one `Vote`.

Validation rules:
- Nickname must be non-empty, display-safe text, and unique within the room while the room exists.
- Seat reclamation requires matching room code plus reconnect token before room deletion.
- Reconnection never changes assigned cards, completed actions, or submitted vote.
- Disconnected seats remain active during timed phases and voting counts.

## Entity: IdentityCard

Represents a physical role card within one game.

Fields:
- `cardId`: stable id within the room.
- `role`: one of the six `Role` values.
- `initialLocation`: initial `playerSeat:<seatId>` or `underwater:<index>`.
- `currentLocation`: current `playerSeat:<seatId>` or `underwater:<index>`.
- `visibleToSeatIds`: seats that are allowed to know this card's role because of initial assignment, authorized reveal, or settlement.

Relationships:
- Belongs to one `Room`.
- May be referenced by a `PlayerSeat` as initial/current card.
- May be referenced by a `RoleAction` as revealed or exchanged card.

Validation rules:
- Card roles never change; only card locations change.
- Private role values are only included in per-seat private views when authorized.
- Settlement reveals all final player identities and final 水下牌 identities to all players.

## Entity: RoleAction

Represents a role-phase decision or automatic mandatory action.

Fields:
- `actionId`: stable id.
- `phase`: role phase in which action occurred.
- `actingSeatId`: seat whose initial role is eligible; absent if no player held that initial role.
- `role`: `狼人`, `预言家`, `强盗`, `捣蛋鬼`, or `水鬼`.
- `isMandatory`: true for `捣蛋鬼` and `水鬼`, false for `狼人`, `预言家`, and `强盗`.
- `isAutomatic`: true when server selected valid targets for a missed mandatory action.
- `selectedTargets`: selected player seat ids and/or underwater indexes.
- `revealedCardIds`: cards revealed to the acting seat only.
- `exchangedCardIds`: cards whose locations were swapped.
- `completedAt`: timestamp.

Relationships:
- Belongs to one `Room`.
- May reference an acting `PlayerSeat`.
- References selected `IdentityCard` records through targets and outcomes.

Validation rules:
- Actions are accepted only during the matching phase, only from the eligible player, and only before phase end.
- Eligibility is based on initial identity, not current identity.
- Optional roles may produce no action when skipped or timed out.
- Mandatory roles must produce a valid manual or automatic action.
- Invalid/late/ineligible actions do not mutate room state.

Role-specific validation:
- `狼人`: may reveal exactly one 水下 card or skip.
- `预言家`: may reveal exactly two 水下 cards, or exactly one player card, but not both.
- `强盗`: may reveal exactly one other player's card; if revealed, must exchange it with the robber's own card.
- `捣蛋鬼`: must exchange the two other players' cards; cannot choose self and cannot reveal either card.
- `水鬼`: must exchange own card with exactly one 水下 card; cannot reveal the chosen 水下 card.

## Entity: Vote

Represents one player's accusation during voting.

Fields:
- `voterSeatId`: seat casting the vote.
- `targetSeatId`: seat selected as suspected 狼人.
- `submittedAt`: timestamp.

Relationships:
- Belongs to one `Room`.
- References voter and target `PlayerSeat` records.

Validation rules:
- Each active seat casts exactly one vote.
- Vote target must be one of the three player seats.
- Votes are counted only after all active seats have submitted.
- Submitted votes cannot be changed in the first version unless a future requirement explicitly adds vote changes.

## Entity: Settlement

Represents final outcome after voting.

Fields:
- `voteTotals`: count by target seat id.
- `eliminatedSeatId`: seat with strictly highest vote count, or `null` for tied highest count.
- `winningCamp`: `好人` or `狼人`.
- `finalPlayerCards`: role by seat id after all swaps.
- `finalUnderwaterCards`: role by underwater index after all swaps.
- `roleActionsSummary`: manual/automatic action summary for review, without leaking private phase data before settlement.
- `settledAt`: timestamp.

Relationships:
- Belongs to one `Room`.
- Derived from final `IdentityCard` locations and all `Vote` records.

Validation rules:
- If one player has a strictly highest vote count, that player is eliminated.
- If the highest vote count is tied, no player is eliminated.
- 好人 win if a final 狼人 among player seats is eliminated.
- 好人 win if the final 狼人 is in 水下的牌 and no player is eliminated.
- Otherwise 狼人 win.

## Entity: ChatMessage

Represents free-speech text communication within the room.

Fields:
- `messageId`: stable id.
- `roomCode`: room identifier.
- `senderSeatId`: sending seat.
- `text`: display-safe message body.
- `sentAt`: timestamp.

Relationships:
- Belongs to one `Room`.
- References one `PlayerSeat`.

Validation rules:
- Accepted only from seated players in the room.
- Intended for free-speech support; no long-term chat history is retained after room deletion.
- Message text length is capped and escaped/sanitized before display.
