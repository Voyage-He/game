# Card Click Interaction Contract

**Feature**: 005-click-to-reveal
**Date**: 2026-05-23

## Summary

This feature replaces button-based action submission with card-click interaction. The Socket.IO event names, payload schemas, and server-side handling remain **exactly as they are**. The only change is the client-side trigger mechanism: button clicks → card clicks.

No new events are introduced. No existing events are modified. This document defines the precise mapping between card click targets and the Socket.IO events they emit.

---

## Event Mapping

### `action:wolf`

| When | Payload |
|---|---|
| Acting wolf player clicks an underwater card (`.underwater-card`) | `{ underwaterIndex: number }` |

**Client behavior**: On click, immediately emit `action:wolf` with the `data-underwater-index` value (parsed as integer). Set `actionSubmitted = true`.

**Server**: Existing `WolfActionSchema` validates `underwaterIndex` as `z.number().int().min(0).max(2)`.

---

### `action:seer` (view one player)

| When | Payload |
|---|---|
| Acting seer player clicks another player's card (`.player-card`) as first action | `{ mode: 'view_one_player', targetSeatIndex: SeatIndex }` |

**Client behavior**: On click, immediately emit `action:seer`. Set `actionSubmitted = true`, `seerActionMode = 'player'`.

**Server**: Existing `SeerActionSchema` discriminates `mode: 'view_one_player'` and validates `targetSeatIndex` as `SeatIndexSchema`.

---

### `action:seer` (view two underwater)

| When | Payload |
|---|---|
| Acting seer player clicks a **second distinct** underwater card after the first | `{ mode: 'view_two_underwater', underwaterIndexes: [number, number] }` |

**Client behavior**: On first underwater click, record index in `seerUnderwaterClicked`, set `seerActionMode = 'underwater'`. On second distinct underwater click, emit `action:seer` with both indexes (sorted or in click order — server does not care about order). Set `actionSubmitted = true`.

**Server**: Existing `SeerActionSchema` validates `underwaterIndexes` as `z.array(UnderwaterIndexSchema).length(2)`.

---

### `action:robber`

| When | Payload |
|---|---|
| Acting robber player clicks another player's card (`.player-card`) | `{ targetSeatIndex: SeatIndex }` |

**Client behavior**: On click, immediately emit `action:robber`. Set `actionSubmitted = true`.

**Server**: Existing `RobberActionSchema` validates `targetSeatIndex` as `SeatIndexSchema`.

---

### `action:troublemaker`

| When | Payload |
|---|---|
| Acting troublemaker player clicks a **second distinct** other player's card after the first | `{ targetSeatIndexes: [SeatIndex, SeatIndex] }` |

**Client behavior**: On first click, record seat index in `troublemakerSelected`, apply selected styling. On second click of a different player, emit `action:troublemaker` with both indexes. Set `actionSubmitted = true`. On clicking an already-selected card, deselect it (`troublemakerSelected` reset to empty). On clicking own card, ignore.

**Server**: Existing `TroublemakerActionSchema` validates `targetSeatIndexes` as `z.array(SeatIndexSchema).length(2)`.

---

### `action:water-ghost`

| When | Payload |
|---|---|
| Acting water ghost player clicks an underwater card (`.underwater-card`) | `{ underwaterIndex: number }` |

**Client behavior**: On click, immediately emit `action:water-ghost`. Set `actionSubmitted = true`.

**Server**: Existing `WaterGhostActionSchema` validates `underwaterIndex` as `UnderwaterIndexSchema`.

---

## Error Responses (Unchanged)

All existing server-side error responses remain valid. The client handles them exactly as before (via `socket.on('error', ...)` in `state.ts`):

| Error Code | Trigger | Client Effect |
|---|---|---|
| `INVALID_PHASE` | Click during wrong phase | Error message shown in UI |
| `INELIGIBLE_PLAYER` | Click by non-acting player (server-side validation) | Error message shown in UI |
| `ACTION_WINDOW_CLOSED` | Click after action already submitted or phase expired | Error message shown in UI |
| `INVALID_TARGET` | Invalid target index | Error message shown in UI |
| `VALIDATION_ERROR` | Malformed payload | Error message shown in UI |

---

## State Updates After Action (Unchanged)

After server processes the action:
1. Server emits `action:result` to the acting player's socket (acknowledgment)
2. Server broadcasts `state:public` and `state:private` to all relevant sockets
3. `state:private.revealedCards` contains the newly revealed card(s)
4. Client's `state.ts` processes these and triggers re-render with card flip animation

---

## Client-Side Guard Contract

Before emitting any `action:*` event, the client MUST verify:

```
guard(action_event, target_index):
  if currentEligibleAction === null → NO-OP (not your turn)
  if actionSubmitted === true → NO-OP (already acted)
  if target is self (player card only) → NO-OP (can't target self)
  if target already clicked (seer underwater, same index) → NO-OP
  if mode mismatch (seer clicked player after underwater) → NO-OP
  → EMIT event
  → SET actionSubmitted = true
```

This is purely client-side defensive programming. The server will also reject invalid actions, but client-side guards provide immediate visual feedback and prevent unnecessary network traffic.

---

## DOM Structure Contract

The card click handler depends on these data attributes being present on card containers:

| Element | Required Attributes | Value |
|---|---|---|
| `.player-card` | `data-seat-index` | `"0"`, `"1"`, or `"2"` |
| `.underwater-card` | `data-underwater-index` | `"0"`, `"1"`, or `"2"` |
| `.card` (inside any card container) | `data-flipped` | `"true"` or `"false"` |
| `.card` (inside any card container) | `data-location` | e.g. `"underwater:0"`, `"playerSeat:1"` |

These attributes already exist in the current rendering code (from spec 004). No changes required to DOM structure — only the CSS classes applied to them change (`.clickable`, `.selected`, `.submitted` added).
