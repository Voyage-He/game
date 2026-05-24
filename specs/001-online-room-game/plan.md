# Implementation Plan: 在线房间游戏

**Branch**: `001-online-room-game` | **Date**: 2026-05-21 | **Spec**: `specs/001-online-room-game/spec.md`

**Input**: Feature specification from `/specs/001-online-room-game/spec.md`

## Summary

Build a self-hosted, invite-only browser game for exactly three players using the rules in `game_rule.md`: room creation/join by room code, browser-local reconnect tokens, server-authoritative role phases/timers, private role actions, free speech, voting, and settlement. The technical approach is a single TypeScript web application with a Node.js backend, Socket.IO real-time synchronization, an in-memory temporary room store, and a minimal text/CSS Vite frontend.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ LTS-compatible runtime; browser client targets modern evergreen browsers.

**Primary Dependencies**: Express for HTTP/static serving; Socket.IO for room-scoped real-time events; Vite for minimal frontend bundling; Zod for runtime payload validation and shared contract schemas.

**Storage**: In-memory server-side room store only. Rooms, nicknames, game state, reconnect-token hashes, and any transient chat delivery data are temporary and deleted or discarded after settlement or when all players leave. Browser-local reconnect tokens are stored client-side in `localStorage` for active rooms only. No server-side match history or chat transcript is retained.

**Testing**: Vitest for deterministic game-engine unit tests and backend integration tests; Playwright for three-browser room-flow end-to-end tests; contract tests for HTTP and Socket.IO event payloads.

**Target Platform**: Self-hosted public-internet Node.js service on a Linux host, usually behind HTTPS reverse proxy; browser clients on desktop and mobile web.

**Project Type**: Web application with one backend service, one browser frontend, and shared TypeScript types/contracts.

**Performance Goals**: Meet SC-002 by delivering at least 95% of visible room/game state updates to affected connected clients within 2 seconds; server-side room actions should complete within 500 ms on the target self-hosted deployment under expected invite-only load.

**Constraints**: Exactly 3 seats per game; no spectators, accounts, matchmaking, public lobby, public profiles, persistent match history, custom artwork, or nonessential animations. Timed role phases continue during disconnects. Private card information must only be sent to authorized clients. No personal information beyond temporary nicknames, active room/game state, reconnect-token data, and transient chat delivery data; no server-side match or chat history may be retained.

**Scale/Scope**: First version targets small self-hosted friend groups: many independent one-game rooms, with an initial engineering target of up to 100 concurrent rooms / 300 connected players on a modest VPS. Data model remains intentionally non-persistent to satisfy temporary-room requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Gate

- **服务端权威与规则一致性**: PASS — the plan assigns dealing, role actions, swaps, timers, voting, settlement, and cleanup to the Node.js server and shared contracts.
- **临时数据与隐私最小化**: PASS — storage is explicitly in-memory and limited to active room/game data, reconnect-token hashes, nicknames, connection state, and transient chat delivery.
- **测试先行与契约可验证**: PASS — Vitest unit/integration, Socket.IO/HTTP contract coverage, and Playwright three-browser flow tests are required before implementation tasks.
- **简洁自托管架构**: PASS — one TypeScript web app with Express, Socket.IO, Vite, Zod, and no persistent database or public-platform features.
- **清晰中文体验与实时可用性**: PASS — player-facing flows use Chinese copy and SC-002 sets the 95% within 2 seconds visible-update target.

**Initial Gate Result**: PASS — no constitution violations or complexity exceptions required.

### Post-Design Gate

Phase 0 and Phase 1 artifacts keep the single-service architecture, in-memory temporary storage, privacy-preserving visibility projections, Chinese user-facing errors, and HTTP/Socket.IO contracts. The design includes tests for rule correctness, hidden-information boundaries, reconnect, invalid operations, and end-to-end three-player play.

**Post-Design Gate Result**: PASS — design remains aligned with all five ratified constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/001-online-room-game/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── realtime-api.md  # HTTP + Socket.IO contract for room gameplay
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
package.json
src/
├── server/
│   ├── app.ts                 # Express app, static frontend serving, HTTP routes
│   ├── index.ts               # Node server entrypoint
│   ├── room-store.ts          # In-memory room lifecycle and cleanup
│   ├── realtime/
│   │   ├── socket-server.ts   # Socket.IO setup, auth, room event routing
│   │   └── event-handlers.ts  # Validated game/action/vote/chat handlers
│   └── game/
│       ├── engine.ts          # Pure game rules, phase progression, settlement
│       ├── timers.ts          # Server-authoritative phase timers
│       └── visibility.ts      # Public/private player views and reveal rules
├── client/
│   ├── main.ts                # Minimal browser app bootstrap
│   ├── state.ts               # Client-side room state and reconnect token handling
│   ├── views/
│   │   ├── lobby.ts           # Create/join/waiting room UI
│   │   ├── game.ts            # Phase/action/vote/settlement UI
│   │   └── chat.ts            # Free-speech text communication UI
│   └── styles/
│       └── main.css           # Minimal text/CSS roles and statuses
└── shared/
    ├── types.ts               # Shared domain types and enums
    ├── contracts.ts           # Zod schemas for HTTP and Socket.IO payloads
    └── errors.ts              # User-facing error codes/messages

tests/
├── unit/
│   ├── game-engine.test.ts    # Deterministic role action and settlement coverage
│   └── visibility.test.ts     # Private/public information filtering
├── integration/
│   ├── room-api.test.ts       # HTTP create/join/reconnect contracts
│   └── socket-flow.test.ts    # Multi-client phase/action/vote flows
└── e2e/
    └── three-player-game.spec.ts # Browser-level full-game flow with Playwright
```

**Structure Decision**: Use one TypeScript web application with server, client, shared contracts, and tests in a single repository. This avoids premature microservices or persistent infrastructure while still isolating the pure game engine for deterministic unit testing and keeping frontend/backend payloads synchronized through shared schemas.

## Complexity Tracking

No constitution violations or complexity exceptions are required.
