# Quickstart: 修复倒计时与身份分配

## Prerequisites

- Node.js 20+
- npm dependencies installed with `npm install`

## Failing-First Test Plan

Before implementation, add or update tests so these checks fail against the current bug behavior:

1. **Countdown continuity**
   - Unit/integration: timed phases expose stable `phaseStartedAt`, `phaseEndsAt`, and `serverNow`.
   - Browser/e2e: visible countdown text changes once per second during `close_eyes`, role action, and voting phases.

2. **Timer idempotency**
   - Unit: stale timer callbacks with old `phase` or old `phaseEndsAt` do not advance the room.
   - Integration: phase timeout settles or advances exactly once, even if action/vote updates happen near timeout.

3. **Action does not reset countdown**
   - Integration: after a valid role action or vote, the next public state keeps the same active `phaseEndsAt` unless the phase has legitimately completed.

4. **Reconnect time alignment**
   - Integration/e2e: disconnect during a timed phase, reconnect with the original token, and verify the player sees the current remaining time within 2 seconds of other clients.

5. **Fresh per-game identity allocation**
   - Unit/integration: start 100 new games with the same three nicknames and join order; verify every game has six unique cards, and no seat receives the same identity in all 100 games.

6. **Same-game identity stability**
   - Integration/e2e: after identities are dealt, refresh or reconnect and verify the player's initial identity remains unchanged for that active game.

7. **Privacy boundary**
   - Unit/integration: public state before settlement contains no hidden role contents; private state contains only the receiving seat's authorized information.

## Commands

Run the standard validation suite:

```bash
npm run build
npm test
npm run test:e2e
```

Run targeted tests during implementation:

```bash
npm test -- tests/unit/game-engine.test.ts
npm test -- tests/unit/timers.test.ts
npm test -- tests/unit/visibility.test.ts
npm test -- tests/unit/game-view.test.ts
npm test -- tests/integration/socket-flow.test.ts
npm test -- tests/integration/identity-allocation.test.ts
npm test -- tests/integration/privacy-errors.test.ts
npm run test:e2e -- tests/e2e/three-player-game.spec.ts
npm run test:e2e -- tests/e2e/identity-allocation.spec.ts
npm run test:e2e -- tests/e2e/chinese-prompts-settlement.spec.ts
```

## Manual Verification

1. Start the accelerated test server:

   ```bash
   npm run dev:test
   ```

2. Open three separate browser contexts and create/join one room with three players.
3. Start the game and watch `闭眼准备` and at least one role action stage:
   - countdown decreases visibly once per second;
   - it does not freeze until another server event arrives;
   - it does not jump backward or restart after an action.
4. Refresh one player during a timed phase and reconnect with the same room code:
   - player returns to the same seat;
   - displayed remaining time matches the other clients within about 2 seconds;
   - initial identity is unchanged for the active game.
5. Advance to voting:
   - voting countdown shows the same 60-second window;
   - submitting a vote does not restart the countdown;
   - when all three vote, settlement appears once.
6. Create several fresh rooms with the same nicknames and joining order:
   - identities should not be fixed to the same player/seat every time;
   - occasional natural repeats are acceptable.
7. For accelerated local verification against the built server, keep production behavior unchanged but run with test-only timing variables when needed:

   ```bash
   PORT=3000 PHASE_TIME_SCALE=0.5 VOTING_TIMEOUT_MS=8000 npm start
   ```

## Expected User-Facing Results

- All countdown and phase labels are clear Chinese text.
- Free speech clearly appears untimed.
- Non-acting players see neutral waiting text during hidden role phases.
- Settlement shows final identities, final water cards, vote totals, eliminated/no-out result, and winning camp.
- Duplicate actions, duplicate votes, self-votes, late actions, and invalid targets return actionable Chinese socket errors.

## Rollback / Safety Notes

- The change should not alter room creation, join, reconnect, chat, role-action payloads, or vote payloads.
- If countdown display misbehaves, server-authoritative phase transitions must still remain correct.
- If identity distribution tests fail statistically, inspect for deterministic fallback paths tied to seat, nickname, room code, or version.
