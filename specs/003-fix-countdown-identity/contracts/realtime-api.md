# Contracts: Countdown and Identity Allocation

## Scope

This document describes the externally observable HTTP and Socket.IO contract expectations for the countdown and identity-allocation fix. It does not add accounts, persistent history, public lobbies, or spectators.

## HTTP Contracts

Existing room lifecycle HTTP endpoints remain unchanged:

- `POST /api/rooms`
- `POST /api/rooms/:roomCode/join`
- `POST /api/rooms/:roomCode/reconnect`
- `GET /api/health`

### Contract Invariants

- HTTP create/join/reconnect responses MUST NOT include identity card contents.
- Reconnect MUST restore the same seat for the matching room and reconnect token.
- Reconnect MUST NOT trigger new identity allocation.

## Socket Namespace

Namespace: `/rooms`

### Socket Authentication

Client connects with:

```json
{
  "roomCode": "ABC123",
  "reconnectToken": "browser-local-token"
}
```

Authentication rules are unchanged:

- `roomCode` must identify an active room.
- `reconnectToken` must match the original seat token hash for that room.
- Invalid auth is rejected with a Chinese user-facing error message.

## Event: `room:start`

Client-to-server payload:

```json
{}
```

Server behavior:

- Only the room owner may start.
- Room must have exactly three connected player seats.
- Server creates one fresh identity allocation for this new game.
- Server sets the first phase to `close_eyes` and sets authoritative phase timestamps.
- Server emits `state:public` and per-seat `state:private` snapshots.

Observable invariants:

- The same seat/nickname/join order MUST NOT map deterministically to the same identity across new games.
- A single game MUST contain exactly six unique identity cards: 狼人、预言家、强盗、捣蛋鬼、水鬼、平民.
- Each player receives exactly one private initial identity in `state:private`.

## Event: `state:public`

Server-to-client payload shape:

```json
{
  "roomCode": "ABC123",
  "status": "in_game",
  "version": 12,
  "players": [
    {
      "seatIndex": 0,
      "nickname": "阿明",
      "isOwner": true,
      "connectionStatus": "connected"
    }
  ],
  "phase": "wolf_action",
  "phaseStartedAt": "2026-05-22T12:00:00.000Z",
  "phaseEndsAt": "2026-05-22T12:00:10.000Z",
  "serverNow": "2026-05-22T12:00:03.000Z",
  "phaseCompletion": {
    "currentRoleCompleted": false
  },
  "voteCompletion": {
    "submittedCount": 1,
    "requiredCount": 3
  }
}
```

Required fields:

- `serverNow` MUST be present on every `state:public` emission and MUST be an ISO UTC timestamp generated at emission time.
- `phaseEndsAt` MUST be present for timed phases and MUST be omitted for `free_speech` and `settlement`.
- `phaseStartedAt` MUST be present whenever `phase` is present.

Countdown display contract:

- Clients compute estimated server time as `Date.now() + clockOffset`, where `clockOffset` is derived from the latest `serverNow`.
- Clients compute remaining seconds as `max(0, ceil((phaseEndsAt - estimatedServerTime) / 1000))`.
- Clients MUST re-render countdown text at least once per second while `phaseEndsAt` is present.
- `state:public` is emitted on room state changes, reconnection, phase changes, votes, actions, and settlement; it is not required to be emitted every second.

Privacy contract:

- `state:public` MUST NOT contain any identity role names before settlement.
- `state:public` MAY contain phase names such as `wolf_action`; this is not considered a hidden card content leak.

## Event: `state:private`

Server-to-client payload shape is unchanged except that values must remain stable after reconnect:

```json
{
  "seatIndex": 1,
  "initialRole": "预言家",
  "currentEligibleAction": {
    "phase": "seer_action",
    "options": ["view_two_underwater", "view_one_player", "skip"]
  },
  "revealedCards": [
    {
      "location": "underwater:0",
      "role": "狼人"
    }
  ],
  "submittedVote": null
}
```

Contract invariants:

- `initialRole` for a seat MUST remain the same after refresh or reconnect in the same active game.
- `currentEligibleAction` is present only for the seat whose initial role matches the current role phase.
- `revealedCards` includes only information authorized by that seat's own identity or prior rule actions.
- Other players' identities and water cards remain hidden until settlement unless specifically revealed by a rule-authorized action to this seat.

## Events: Role Actions

Existing client-to-server action event names remain unchanged:

- `action:wolf`
- `action:seer`
- `action:robber`
- `action:troublemaker`
- `action:water-ghost`

Countdown invariants after any valid action:

- The server MUST NOT reset `phaseStartedAt` or `phaseEndsAt` for the current phase.
- The next `state:public` MUST preserve the same `phaseEndsAt` if the phase is still active.
- The room timer MUST continue toward the original phase completion time.

## Event: `vote:cast`

Client-to-server payload remains:

```json
{
  "targetSeatIndex": 2
}
```

Countdown invariants:

- Voting starts with a 60-second `phaseEndsAt` unless all votes arrive earlier.
- A valid vote MUST NOT reset the voting deadline.
- If all occupied seats vote before timeout, server may immediately settle and stop the voting countdown.
- If timeout fires with missing votes, server assigns automatic valid votes once and settles once.

## Event: `settlement:shown`

Server-to-client payload remains the public settlement view:

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
    { "seatIndex": 0, "nickname": "阿明", "role": "平民" }
  ],
  "finalUnderwaterCards": [
    { "index": 0, "role": "狼人" }
  ],
  "automaticActions": [],
  "automaticVotes": []
}
```

Contract invariants:

- Settlement is the first room-wide event that may reveal all final identities and final water cards.
- Settlement MUST be emitted at most once per game.
- After settlement display, temporary room cleanup behavior remains unchanged.

## Error Events

Socket error event shape remains:

```json
{
  "code": "INVALID_PHASE",
  "message": "当前阶段不能执行该操作。"
}
```

Contract invariants:

- Late actions, duplicate actions, duplicate votes, self-votes, and invalid targets produce Chinese error messages.
- Invalid attempts MUST NOT mutate valid phase timestamps, identity allocation, votes, or card locations.
