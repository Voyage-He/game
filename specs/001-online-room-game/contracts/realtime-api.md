# Contracts: HTTP + Socket.IO Room Gameplay API

This contract defines the first-version public interface exposed by the self-hosted game service. All payloads are JSON. Error responses must use stable `code` values plus user-facing Chinese `message` text.

## Common Types

```ts
type RoomCode = string;
type SeatIndex = 0 | 1 | 2;
type Role = '狼人' | '预言家' | '强盗' | '捣蛋鬼' | '水鬼' | '平民';
type RoomStatus = 'waiting' | 'in_game' | 'settled' | 'closed';
type Phase =
  | 'close_eyes'
  | 'wolf_action'
  | 'seer_action'
  | 'robber_action'
  | 'troublemaker_action'
  | 'water_ghost_action'
  | 'open_eyes'
  | 'free_speech'
  | 'voting'
  | 'settlement';

type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_UNAVAILABLE'
  | 'ROOM_FULL'
  | 'DUPLICATE_NICKNAME'
  | 'INVALID_NICKNAME'
  | 'INVALID_RECONNECT_TOKEN'
  | 'NOT_ROOM_OWNER'
  | 'INVALID_PHASE'
  | 'INELIGIBLE_PLAYER'
  | 'INVALID_TARGET'
  | 'ACTION_WINDOW_CLOSED'
  | 'VOTE_ALREADY_SUBMITTED'
  | 'VALIDATION_ERROR';
```

## HTTP Endpoints

### POST `/api/rooms`

Create a waiting room and seat the creator as owner.

Request:

```json
{
  "nickname": "阿明"
}
```

Response `201`:

```json
{
  "roomCode": "AB12CD",
  "seatIndex": 0,
  "isOwner": true,
  "reconnectToken": "high-entropy-token-returned-once"
}
```

Validation:
- `nickname` must be non-empty display-safe text.
- Returned `reconnectToken` is stored by the browser and is not returned again by public state events.

### POST `/api/rooms/{roomCode}/join`

Join an existing waiting room.

Request:

```json
{
  "nickname": "小红"
}
```

Response `201`:

```json
{
  "roomCode": "AB12CD",
  "seatIndex": 1,
  "isOwner": false,
  "reconnectToken": "high-entropy-token-returned-once"
}
```

Errors:
- `ROOM_NOT_FOUND` for nonexistent or deleted room code.
- `ROOM_UNAVAILABLE` for started, settled, closed, or otherwise unavailable rooms.
- `ROOM_FULL` when all three seats are occupied.
- `DUPLICATE_NICKNAME` when nickname already exists in the room.
- `INVALID_NICKNAME` when nickname fails validation.

### POST `/api/rooms/{roomCode}/reconnect`

Reclaim an existing seat from the same browser/device before room deletion.

Request:

```json
{
  "reconnectToken": "token-from-localStorage"
}
```

Response `200`:

```json
{
  "roomCode": "AB12CD",
  "seatIndex": 1,
  "isOwner": false
}
```

Errors:
- `ROOM_NOT_FOUND` for nonexistent or deleted room code.
- `INVALID_RECONNECT_TOKEN` when token does not match any occupied seat in the room.

### Error Response Format

```json
{
  "error": {
    "code": "ROOM_FULL",
    "message": "房间已满，无法加入。"
  }
}
```

## Socket.IO Connection

Namespace: `/rooms`

Client auth payload:

```json
{
  "roomCode": "AB12CD",
  "reconnectToken": "token-from-localStorage"
}
```

Connection behavior:
- Server accepts only seated players with a valid reconnect token.
- A connected socket joins the Socket.IO room for `roomCode` and is associated with the reclaimed seat.
- On successful connection, server emits `state:public` to the room and `state:private` to the connected seat.

## Server-to-Client Events

### `state:public`

Public room/game view safe for every seated player.

```json
{
  "roomCode": "AB12CD",
  "status": "in_game",
  "version": 12,
  "players": [
    { "seatIndex": 0, "nickname": "阿明", "isOwner": true, "connectionStatus": "connected" },
    { "seatIndex": 1, "nickname": "小红", "isOwner": false, "connectionStatus": "connected" },
    { "seatIndex": 2, "nickname": "小李", "isOwner": false, "connectionStatus": "disconnected" }
  ],
  "phase": "seer_action",
  "phaseEndsAt": "2026-05-21T12:00:10.000Z",
  "phaseCompletion": {
    "currentRoleCompleted": false
  },
  "voteCompletion": {
    "submittedCount": 0,
    "requiredCount": 3
  }
}
```

Rules:
- Must not include hidden card identities or private action details before settlement.
- During role phases, ineligible players receive only neutral phase/waiting information.

### `state:private`

Private view for exactly one connected seat.

```json
{
  "seatIndex": 1,
  "initialRole": "预言家",
  "currentEligibleAction": {
    "phase": "seer_action",
    "options": ["view_two_underwater", "view_one_player", "skip"]
  },
  "revealedCards": [
    { "location": "underwater:0", "role": "狼人" }
  ],
  "submittedVote": null
}
```

Rules:
- `initialRole` is visible to that player after game start.
- `revealedCards` contains only cards this seat is authorized to know.
- Ineligible seats receive no private action target details for the current role phase.

### `action:result`

Private result for an authorized role action.

```json
{
  "phase": "seer_action",
  "revealedCards": [
    { "location": "underwater:0", "role": "狼人" },
    { "location": "underwater:2", "role": "平民" }
  ],
  "exchangePerformed": false
}
```

### `phase:changed`

```json
{
  "phase": "robber_action",
  "phaseStartedAt": "2026-05-21T12:00:10.000Z",
  "phaseEndsAt": "2026-05-21T12:00:20.000Z"
}
```

### `vote:progress`

```json
{
  "submittedCount": 2,
  "requiredCount": 3
}
```

### `settlement:shown`

```json
{
  "voteTotals": [
    { "seatIndex": 0, "votes": 1 },
    { "seatIndex": 1, "votes": 1 },
    { "seatIndex": 2, "votes": 1 }
  ],
  "eliminatedSeatIndex": null,
  "winningCamp": "好人",
  "finalPlayerCards": [
    { "seatIndex": 0, "nickname": "阿明", "role": "预言家" },
    { "seatIndex": 1, "nickname": "小红", "role": "平民" },
    { "seatIndex": 2, "nickname": "小李", "role": "强盗" }
  ],
  "finalUnderwaterCards": [
    { "index": 0, "role": "狼人" },
    { "index": 1, "role": "捣蛋鬼" },
    { "index": 2, "role": "水鬼" }
  ],
  "automaticActions": [
    { "phase": "water_ghost_action", "seatIndex": 2 }
  ]
}
```

### `chat:message`

```json
{
  "messageId": "msg_123",
  "seatIndex": 0,
  "nickname": "阿明",
  "text": "我觉得狼人不在场。",
  "sentAt": "2026-05-21T12:02:00.000Z"
}
```

### `error`

```json
{
  "code": "INVALID_PHASE",
  "message": "当前阶段不能执行该操作。"
}
```

## Client-to-Server Events

All client-to-server events require a valid connected seat. Server validates phase, actor eligibility, targets, and timing before mutating state.

### `room:start`

Start the game from waiting room.

Payload:

```json
{}
```

Validation:
- Sender must be room owner.
- Room must be `waiting`.
- Exactly three seats must be occupied and connected.

### `phase:advance-to-vote`

Advance unlimited free speech to voting.

Payload:

```json
{}
```

Validation:
- Sender must be room owner.
- Current phase must be `free_speech`.

### `action:wolf`

```json
{
  "underwaterIndex": 0
}
```

Validation:
- Current phase must be `wolf_action`.
- Sender's initial role must be `狼人`.
- `underwaterIndex` must be `0`, `1`, or `2`.
- Omitted action before timeout means no 狼人 action occurs.

### `action:seer`

View two underwater cards:

```json
{
  "mode": "view_two_underwater",
  "underwaterIndexes": [0, 2]
}
```

View one player card:

```json
{
  "mode": "view_one_player",
  "targetSeatIndex": 2
}
```

Validation:
- Current phase must be `seer_action`.
- Sender's initial role must be `预言家`.
- Exactly one mode is allowed.
- Underwater mode requires exactly two distinct underwater indexes.
- Player mode requires one valid player seat.
- Omitted action before timeout means no 预言家 action occurs.

### `action:robber`

```json
{
  "targetSeatIndex": 0
}
```

Validation:
- Current phase must be `robber_action`.
- Sender's initial role must be `强盗`.
- Target must be one other player.
- Successful reveal must immediately exchange the robber's own card with the target card.
- Omitted action before timeout means no 强盗 action occurs.

### `action:troublemaker`

```json
{
  "targetSeatIndexes": [0, 2]
}
```

Validation:
- Current phase must be `troublemaker_action`.
- Sender's initial role must be `捣蛋鬼`.
- Targets must be exactly the two other players.
- No target card roles are revealed.
- If omitted before timeout, server automatically completes a valid exchange and records it as automatic.

### `action:water-ghost`

```json
{
  "underwaterIndex": 1
}
```

Validation:
- Current phase must be `water_ghost_action`.
- Sender's initial role must be `水鬼`.
- Target must be exactly one underwater card.
- Target card role is not revealed.
- If omitted before timeout, server automatically selects a valid underwater card, exchanges it, and records it as automatic.

### `vote:cast`

```json
{
  "targetSeatIndex": 2
}
```

Validation:
- Current phase must be `voting`.
- Sender must not have already voted.
- Target must be one of the three player seats.
- Settlement is calculated only after all three votes are submitted.

### `chat:send`

```json
{
  "text": "这里输入自由发言内容。"
}
```

Validation:
- Sender must be seated in the room.
- Text must be non-empty display-safe text within configured length limit.
- Chat history is temporary and deleted with the room.

### `room:leave`

```json
{}
```

Behavior:
- Marks the socket disconnected from the seat.
- If all seats have left before game completion, room becomes closed and is deleted.
- If a game is in progress, timed phases continue and the seat may be reclaimed with room code plus reconnect token until room deletion.
