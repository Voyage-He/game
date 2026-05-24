# Research: 身份牌翻转展示与技能查看

**Feature**: 004-fix-card-flip-reveal | **Date**: 2026-05-23

## Research Tasks

### 1. Current Reveal Data Flow Analysis

**Question**: Why do 预言家/狼人/强盗 skills "fail to show identity cards" after activation?

**Findings**:
- Server engine (`engine.ts`) correctly calls `revealCardToSeat()` in `performWolfAction`, `performSeerAction`, `performRobberAction`, adding the acting seat's `seatId` to `card.visibleToSeatIds`.
- Each action records `revealedCardIds` in `room.actions`.
- `visibility.ts` → `buildRevealedCards()` iterates all `room.actions` where `action.actingSeatId === seatId` and extracts `revealedCardIds` roles and locations into `revealedCards[]`.
- `socket-server.ts` → `emitRoomState()` calls `projectPrivateRoomView()` which includes `revealedCards` in the `state:private` event.
- Client `state.ts` receives `state:private` and stores `privateView.revealedCards` in its snapshot.
- **Root Cause**: Client `game.ts` → `renderGame()` never renders `privateView?.revealedCards`. The data arrives correctly but is ignored in the view layer.

**Decision**: Fix the client view to render `revealedCards` as face-up cards. Add phase-aware filtering on the server side (see Research #2).

**Rationale**: The server-authoritative identity data is already flowing correctly to the client; the fix is purely in the presentation layer.

**Alternatives considered**: Rewriting the reveal mechanism on the server — rejected because the existing engine logic is correct and matches `game_rule.md`.

---

### 2. Phase-Aware Revealed Card Filtering

**Question**: Should revealed cards persist across phase transitions? Per FR-008, cards must revert to face-down when the skill phase ends.

**Findings**:
- Current `buildRevealedCards()` returns ALL revealed cards from ALL past actions for the seat, regardless of current phase.
- Each `RoleAction` stores its `phase` field (e.g., `wolf_action`, `seer_action`).
- `room.phase` tracks the current phase.
- For FR-008 compliance, `buildRevealedCards()` should filter to only include actions matching `room.phase`.
- For FR-010 (reconnect preservation), since `buildRevealedCards` uses the live `room.phase`, a reconnecting player during the same phase will still see that phase's reveals.

**Decision**: Add phase filtering in `buildRevealedCards()`: `if (action.phase !== room.phase) continue;`.

**Rationale**: Minimal change; leverages existing `action.phase` field; satisfies both FR-008 (hide on phase change) and FR-010 (preserve on reconnect within same phase).

**Alternatives considered**:
- Clear `visibleToSeatIds` on phase transitions — rejected because it mutates card state which should represent persistent knowledge for settlement.
- Client-side phase tracking — rejected because server-authoritative filtering is simpler and prevents client manipulation.

---

### 3. CSS Card Flip Animation

**Question**: How to implement a card flip animation using only CSS (no external animation libraries, no image assets)?

**Findings**:
- CSS 3D transforms provide smooth card flip: `transform: rotateY(180deg)` with `transform-style: preserve-3d` and `perspective`.
- Standard pattern: container with `perspective`, inner element with two faces (front = card back, back = card face).
- `.card.flipped .card-inner { transform: rotateY(180deg); }` with `transition: transform 0.5s`.
- Card back: solid color with simple pattern (CSS gradient or border pattern), no images needed.
- Card front: shows role name in Chinese, simple colored background per role.

**Decision**: Use standard CSS 3D card flip pattern with `perspective` on container, `rotateY(180deg)` on inner, 0.5s transition.

**Rationale**: Well-established pattern, works in all evergreen browsers, no external dependencies, fits 0.3–0.8s spec range.

**Alternatives considered**:
- CSS `@keyframes` animation — rejected because transitions handle both directions (flip and unflip) naturally.
- JavaScript animation (Web Animations API) — rejected because CSS-only is simpler and server-authoritative state already drives the flip via class toggling.
- ScaleX transform — rejected because it looks less like a physical card flip than rotateY.

**Card Design**:
- Card back: `#2454d6` (theme blue) with a subtle diagonal stripe pattern using CSS `repeating-linear-gradient`
- Card front: White background, role name centered in large text, role-specific accent color border

---

### 4. Card Element Layout

**Question**: How to render players and underwater cards as vertical rectangular card shapes?

**Findings**:
- Current rendering: `<ul class="players">` with list items, no card shape.
- Need: portrait-oriented card (~2:3 aspect ratio), nickname on top, role reveal on flip.
- For three players: `grid` layout, one card per player, side by side on desktop, stack on mobile.
- For three underwater cards: separate row/grid below players, labeled "水下的牌".
- Card dimensions: ~140px wide × ~210px tall (2:3 ratio), scalable with viewport.

**Decision**: Replace player `<ul>` with a CSS Grid of `.player-card` elements (3 columns on desktop, 1 column on mobile). Add `.underwater-cards` grid below with 3 face-down `.card` elements.

**Rationale**: Grid provides clean, responsive layout. Consistent card dimensions for both player and underwater cards.

**Alternatives considered**:
- Flexbox — rejected because grid handles equal-width columns naturally.
- Fixed pixel sizes — rejected because responsive scaling is needed for different viewport sizes (FR-004 scenario 4).

---

### 5. Reconnect and Animation State

**Question**: Per FR-009, how to prevent flip animation replay on reconnect when the card is already face-up?

**Findings**:
- The client receives `state:private` on every reconnection, which includes `revealedCards`.
- A naive implementation would re-render cards as face-up without animation — this is actually the desired behavior since HTML renders in final state.
- The animation only occurs when a card transitions from not-flipped to flipped state.
- During a single render cycle, the DOM is replaced entirely (current `app.innerHTML = ...` pattern).

**Decision**: Use a client-side `Set<string>` to track "newly flipped" card locations. When a `revealedCard` location is not in the set, add it and render with a `card-flip-in` CSS animation class. When `revealedCards` clears (phase change), clear the set. On reconnect during the same phase, the set is rebuilt from the server data — cards render face-up without animation class since they're already "known".

**Rationale**: Simple state tracking in the client; aligns with the full-render pattern used by the current application.

**Alternatives considered**:
- CSS-only `animation` with `animation-fill-mode: forwards` — rejected because animation replays on every DOM insertion.
- Server-side "already animated" flag — rejected because it would add state the server shouldn't need to track.
- Differential DOM updates — rejected because the app uses full re-renders for simplicity.

---

### 6. Testing Strategy

**Question**: What tests are needed to verify the card flip fix?

**Findings**:
- **Unit tests (visibility.test.ts)**:
  - Seer acts in `seer_action`: `revealedCards` contains target roles
  - Phase advances to next: `revealedCards` is empty
  - Wolf acts: `revealedCards` shows the underwater card role
  - Robber acts: `revealedCards` shows target player role
  - Non-acting player's `revealedCards` never contains other players' reveals
- **Unit tests (game-view.test.ts)**:
  - Verify card HTML structure contains required CSS classes
  - Verify underwater cards section renders with Chinese label
  - Verify player cards show nicknames
- **Integration tests (socket-flow.test.ts)**:
  - After seer action, `state:private` contains correct `revealedCards`
  - After phase change, `state:private` reveals are cleared
- **E2E tests (three-player-game.spec.ts)**:
  - Card flip visual states visible after skill activation
  - Card content reads correctly in Chinese
  - Phase transitions clear flipped cards

**Decision**: Follow existing test patterns (Vitest for unit, Playwright for E2E). Add targeted test cases for the card flip flow.

**Rationale**: Matches the project's existing test structure and Constitution Principle III (测试先行).
