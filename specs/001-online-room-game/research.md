# Phase 0 Research: 在线房间游戏

## Decision 1: Use a single TypeScript web application

**Decision**: Implement the first version as one TypeScript project containing a Node.js backend, minimal browser frontend, and shared schemas/types.

**Rationale**: The feature needs real-time browser gameplay, room code flows, and deterministic game rules. A single TypeScript project keeps frontend/backend contracts aligned, reduces deployment complexity for self-hosting, and allows pure game-rule logic to be unit tested independently.

**Alternatives considered**:
- Separate frontend and backend repositories: rejected because the first version is small and contract drift would add overhead.
- Backend-only server-rendered pages: rejected because role phases and synchronized state changes need responsive real-time client updates.
- Python/FastAPI stack: viable, but adds separate frontend typing concerns and no advantage for Socket.IO-heavy browser synchronization.

## Decision 2: Express + Socket.IO for HTTP and real-time room synchronization

**Decision**: Use Express for room creation/join/reconnect HTTP endpoints and static frontend delivery; use Socket.IO for authenticated, room-scoped real-time state, action, vote, settlement, and chat events.

**Rationale**: The spec requires connected room members to see room/game state changes quickly and supports disconnection/reconnection. Socket.IO provides room broadcasting, reconnect-aware client libraries, acknowledgements, and fallback transports that fit small self-hosted games. HTTP remains simple for create/join/reconnect flows that return a reconnect token.

**Alternatives considered**:
- Raw WebSocket: rejected for first version because reconnection, acknowledgements, and room management would require more custom code.
- Polling-only HTTP: rejected because SC-002 requires timely state synchronization and private/public updates during timed phases.
- WebRTC: rejected because this is not peer-to-peer media and would complicate hosting/networking.

## Decision 3: In-memory temporary room store, no persistent database

**Decision**: Store active rooms, player seats, game state, votes, role actions, and reconnect-token hashes in memory. Delete the room after settlement is shown or after all players leave; use cleanup timers for abandoned rooms.

**Rationale**: FR-026 and FR-027 require temporary rooms and no server-side match history. In-memory storage directly satisfies the privacy and lifecycle constraints and simplifies self-hosting for invited friends.

**Alternatives considered**:
- SQLite/PostgreSQL persistence: rejected because retained history increases privacy scope and is unnecessary for one-game temporary rooms.
- Redis: useful for multi-instance scaling, but rejected for first version because the target deployment is a single self-hosted service and scale is small.
- Browser-only peer state: rejected because server-authoritative rules are needed to prevent invalid actions, hidden-information leaks, and inconsistent settlement.

## Decision 4: Server-authoritative game engine with public/private view projection

**Decision**: Keep all card locations, phase timers, action validation, automatic mandatory actions, vote counting, and settlement on the server. Generate separate public room views and private per-player views before emitting events.

**Rationale**: Hidden role information is core to the game. Sending only authorized private data to each client prevents accidental UI leaks and aligns with SC-004. A pure game engine enables deterministic tests covering all six identities, swaps, tie votes, and wolf-underwater cases.

**Alternatives considered**:
- Client-calculated game state: rejected because clients would need hidden data and could diverge.
- Hybrid state where clients perform role actions locally: rejected because invalid targets, late actions, and disconnects must not mutate valid state.

## Decision 5: Browser-local reconnect token returned at seat acquisition

**Decision**: Generate a high-entropy reconnect token whenever a player creates or joins a room. Return it once to the browser, store only a hash server-side, and require room code plus token to reclaim the original seat before room deletion.

**Rationale**: This matches FR-022 without user accounts or personal information. Hashing server-side token data reduces exposure if process memory/logging is inspected, while localStorage gives same-device/same-browser recovery.

**Alternatives considered**:
- Nickname-only recovery: rejected because FR-022 requires a matching token and duplicate nicknames are disallowed only within a room.
- User accounts: rejected by FR-025 and FR-027.
- Server sessions/cookies only: viable, but less explicit for room-code recovery and harder to preserve if the room link is reopened in a new tab.

## Decision 6: Minimal Vite frontend with text/CSS UI

**Decision**: Build the client as a small Vite TypeScript app using semantic HTML, CSS, text labels, colors, and built-in emoji/icons only.

**Rationale**: FR-024 explicitly excludes custom artwork and nonessential animation. Vite provides fast local development and bundling without requiring a large UI framework. Minimal UI keeps the first version focused on rule correctness and online room reliability.

**Alternatives considered**:
- React/Vue/Svelte: all viable, but rejected for first version to reduce framework overhead for a small fixed-flow game.
- Custom canvas/game engine: rejected because the interface is text/status based, not graphics-heavy.

## Decision 7: Testing strategy centered on deterministic rules and multi-client flows

**Decision**: Use Vitest for pure game-engine and backend contract tests, plus Playwright for three-browser end-to-end scenarios.

**Rationale**: SC-003 requires 100 controlled rule test runs with exact final identities and winning camp. Pure unit tests can seed decks and assert every role interaction. Integration and browser tests cover create/join/reconnect, visibility, invalid actions, state sync, and full room completion.

**Alternatives considered**:
- Manual browser-only testing: rejected because hidden-information and rule permutations need deterministic repeatability.
- E2E-only automation: rejected because timed phase and card-swap edge cases are easier and faster to exhaustively cover at the engine level.

## Decision 8: Self-hosted single-process deployment behind HTTPS

**Decision**: Package as a single Node.js process serving API, Socket.IO, and built frontend assets; deploy behind an HTTPS reverse proxy such as Caddy or Nginx.

**Rationale**: The first version is invite-only and temporary-room based. A single service is easy to self-host, while HTTPS protects reconnect tokens and private game events in transit.

**Alternatives considered**:
- Serverless functions: rejected because long-lived real-time Socket.IO rooms and timers fit a persistent process better.
- Multi-instance cluster: rejected for first version because in-memory rooms would require external shared state, contradicting the simplicity and temporary-data goals.
