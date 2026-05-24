# Implementation Plan: 修复倒计时与身份分配

**Branch**: `001-online-room-game` | **Date**: 2026-05-22 | **Spec**: `specs/003-fix-countdown-identity/spec.md`

**Input**: Feature specification from `/specs/003-fix-countdown-identity/spec.md`

**Note**: Current git branch is independent from the spec directory because the git extension hooks are disabled.

## Summary

修复两个已观察到的线上体验问题：限时阶段倒计时显示不连续，以及新局身份分配看起来固定。技术方案保持服务端权威：服务端继续拥有房间阶段、`phaseStartedAt`、`phaseEndsAt`、阶段推进和发牌结果；实时公共状态增加服务端发送时间用于客户端校准；客户端基于权威结束时间本地逐秒重绘倒计时；阶段定时器增加陈旧回调保护以避免重复推进；身份分配改为每局使用新的服务端随机洗牌，同时保留显式测试种子用于自动化测试。

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ LTS-compatible runtime; browser client targets modern evergreen browsers.

**Primary Dependencies**: Express for HTTP/static serving; Socket.IO for room-scoped real-time events; Vite for frontend bundling; Zod for runtime payload validation and shared contract schemas; Node.js built-in randomness for production identity shuffling.

**Storage**: In-memory room store only. Active rooms, nicknames, game state, reconnect-token hashes, connection status, phase timestamps, dealt card locations, actions, votes, and transient chat delivery data remain temporary and are deleted or discarded after settlement or all players leaving. No persistent match or chat history is introduced.

**Testing**: Vitest for deterministic game-engine, timer, visibility, identity-allocation, and backend integration tests; Playwright for three-browser countdown/reconnect/settlement end-to-end validation; contract tests for HTTP and Socket.IO payloads including timestamp fields.

**Target Platform**: Self-hosted public-internet Node.js service on Linux, normally behind an HTTPS reverse proxy; browser clients on modern desktop and mobile web.

**Project Type**: Single TypeScript web application with one backend service, one browser frontend, and shared TypeScript contracts.

**Performance Goals**: Maintain the existing target that at least 95% of visible room/game state updates reach affected connected clients within 2 seconds. Countdown rendering must visibly change once per second during timed phases under normal connectivity, and reconnected clients must align to the room's current remaining time within 2 seconds.

**Constraints**: Server-authoritative game state; exactly three-player invite-only rooms; no accounts, public lobby, matchmaking, spectators, persistent history, custom artwork, or nonessential animations. Timed phases continue during disconnects. Free speech remains untimed. Hidden identities and water cards stay private until rules authorize reveal or settlement.

**Scale/Scope**: Bug-fix scope for the existing small self-hosted friend-group game. The design supports many independent one-game rooms with isolated timers and identity allocations, without changing the first-version invite-only scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Required Gates

- **服务端权威与规则一致性**: Identify the server-owned state, validation, timers, vote/settlement logic, and rule source. Client-only authority over hidden information or outcome is a violation.
- **临时数据与隐私最小化**: List temporary data stored, cleanup triggers, hidden-information boundaries, and proof that no server-side match or chat history is retained.
- **测试先行与契约可验证**: Name the failing tests to add first for rule, visibility, lifecycle, HTTP, Socket.IO, reconnect, and user-visible error changes.
- **简洁自托管架构**: Confirm the feature stays within the single TypeScript app, in-memory storage, invite-only scope, and minimal text/CSS UI; otherwise document the complexity exception below.
- **清晰中文体验与实时可用性**: Confirm player-facing copy and non-technical documentation are Chinese-first, errors are actionable, and visible real-time updates preserve the 2-second/95% target.

### Initial Gate

- **服务端权威与规则一致性**: PASS — phase state, phase timestamps, scheduled phase advancement, identity shuffling/dealing, action validation, voting, and settlement remain server-owned. The client only derives display text from server-provided timestamps and never decides phase changes, identities, or outcomes.
- **临时数据与隐私最小化**: PASS — the fix only uses active-room phase timestamps, timer metadata, identity cards, seat state, reconnect-token hashes, actions, and votes already within temporary room state. Cleanup remains settlement/all-left room deletion; no history, profiles, or analytics are added.
- **测试先行与契约可验证**: PASS — add failing tests first for continuous countdown rendering, stale timer idempotency, reconnect remaining-time alignment, actions not resetting `phaseEndsAt`, fresh per-game identity allocation, in-game identity stability after reconnect, and hidden-information visibility.
- **简洁自托管架构**: PASS — implementation stays inside the existing Node/Express/Socket.IO/Vite TypeScript application with in-memory storage and minimal text/CSS UI.
- **清晰中文体验与实时可用性**: PASS — countdown labels, phase labels, waiting/action text, and errors remain Chinese; realtime state delivery target remains 95% within 2 seconds while local countdown rendering supplies per-second visual updates.

**Initial Gate Result**: PASS — no constitution violations or complexity exceptions required.

### Post-Design Gate

- **服务端权威与规则一致性**: PASS — `research.md` selects server timestamps plus client display ticks, stale-timer guards, and server-side fresh identity shuffling. `data-model.md` keeps phase/timer/deck ownership in room state, and `contracts/realtime-api.md` exposes only synchronized timestamps and filtered room views.
- **临时数据与隐私最小化**: PASS — data model stores no new persistent or personal data. `serverNow` is a transient contract field, and identity allocation details remain in active room memory until cleanup.
- **测试先行与契约可验证**: PASS — `quickstart.md` defines failing-first Vitest, integration, and Playwright checks for countdown, reconnect, identity randomness/stability, and privacy. Contracts document observable payload requirements.
- **简洁自托管架构**: PASS — no new service, database, account system, public lobby, artwork, or animation is required.
- **清晰中文体验与实时可用性**: PASS — UI contract requires Chinese labels and visible per-second countdown updates; realtime updates remain room-scoped and within the 2-second target.

**Post-Design Gate Result**: PASS — design remains aligned with all five ratified constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/003-fix-countdown-identity/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── realtime-api.md  # HTTP + Socket.IO countdown/identity contract notes
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
│   │   ├── socket-server.ts   # Socket.IO setup, auth, room state broadcasts
│   │   └── event-handlers.ts  # Validated start/action/vote/chat handlers
│   └── game/
│       ├── engine.ts          # Pure game rules, phase progression, dealing, settlement
│       ├── timers.ts          # Server-authoritative phase timers and stale-callback guard
│       └── visibility.ts      # Public/private views, server time field, reveal rules
├── client/
│   ├── main.ts                # Browser app bootstrap and render scheduling
│   ├── state.ts               # Client state, reconnect token handling, clock offset
│   ├── views/
│   │   ├── lobby.ts           # Create/join/waiting room UI
│   │   ├── game.ts            # Countdown, action, vote, settlement UI
│   │   └── chat.ts            # Free-speech text communication UI
│   └── styles/
│       └── main.css           # Minimal text/CSS roles and statuses
└── shared/
    ├── types.ts               # Shared domain types and enums
    ├── contracts.ts           # Zod schemas for HTTP and Socket.IO payloads
    └── errors.ts              # User-facing Chinese error codes/messages

tests/
├── unit/
│   ├── game-engine.test.ts    # Phase durations, dealing invariants, identity stability
│   ├── timers.test.ts         # Countdown scheduling, stale callbacks, no duplicate advance
│   └── visibility.test.ts     # Private/public information filtering and serverNow field
├── integration/
│   ├── room-api.test.ts       # HTTP create/join/reconnect contracts
│   └── socket-flow.test.ts    # Multi-client countdown/reconnect/action/vote flows
└── e2e/
    └── three-player-game.spec.ts # Browser-level countdown, reconnect, vote, settlement flow
```

**Structure Decision**: Use the existing single TypeScript web application. Modify only the current server timer/engine/visibility, shared contract/type, client state/render/view, and test files as needed. Do not introduce separate services, persistent storage, or additional applications.

## Complexity Tracking

No constitution violations or complexity exceptions are required.
