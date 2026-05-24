# Research: 点击卡牌直接翻转揭示身份

**Feature**: 005-click-to-reveal
**Date**: 2026-05-23

## 1. Card Click Event Delegation Strategy

### Decision
Use delegated `click` event listeners on the container elements (`.players-grid`, `.underwater-cards-grid`) rather than per-card individual listeners.

### Rationale
- The current `main.ts` already uses event delegation for action buttons (`[data-action]`), vote buttons (`[data-vote]`). Following the same pattern keeps the codebase consistent.
- Card elements are rendered from server state via `innerHTML` replacement on every state update. Per-card listeners would need re-binding after each render, which is fragile and error-prone.
- Delegated listeners attached to stable container elements survive `innerHTML` updates without re-binding.
- Performance: three player cards + three underwater cards = six potential targets, negligible for delegation overhead.

### Alternatives Considered
- **Per-card inline `onclick` attributes in HTML template**: Prone to XSS if payload data is interpolated, and harder to maintain complex selection logic.
- **Custom web components with Shadow DOM**: Over-engineering for three-player card game with text/CSS UI.
- **Pointer events instead of click**: `click` events work for both mouse and touch, and the spec uses `click` terminology. Pointer events add complexity without benefit for simple card tap/click.

### Implementation Notes
- Attach `click` event listener on `document` or the game panel root, using `event.target.closest('.player-card')` and `event.target.closest('.underwater-card')` to find clicked cards.
- This requires `bindCardClickHandlers()` to be called in `bindGameControls()` with access to `clientState.getSnapshot()`.
- Card click handlers must check: (a) is the player the acting player? (b) has action already been submitted? (c) is the clicked card a valid target? before emitting the appropriate Socket.IO event.

---

## 2. Client-Side Selection State Management

### Decision
Track selection state in `ClientState` using simple properties reset on each `state:private` update. Two scenarios require multi-step state:

- **Seer underwater mode**: Track `seerUnderwaterClicked: number[]` (array of clicked underwater indexes) and `seerActionMode: 'idle' | 'underwater' | 'player'`. First click determines mode; if underwater, allow up to 2 different indexes.
- **Troublemaker selection**: Track `troublemakerSelected: number[]` (array of selected player seat indexes, max 2).

### Rationale
- Both are ephemeral, purely client-side, and cleared when `revealedCards.length === 0` (phase change signal already handled in `state.ts`).
- Storing in `ClientState` (not DOM) allows the render function to read selection state and apply visual feedback (highlight/selected classes).
- The state is minimal: two small arrays and an enum string. No need for external state management libraries.

### Alternatives Considered
- **DOM-only state (data attributes on card elements)**: State would be lost on re-render, causing flicker or stale state. The render loop potentially runs multiple times during a skill phase (e.g., timer updates every second).
- **Redux/MobX**: Unnecessary complexity for two small arrays.
- **Single-step only (require separate confirm button)**: Rejected by spec — user explicitly requested "not two-step with confirmation", cards should flip immediately on click.

### State Lifecycle
1. **Initialize**: On `state:private` with `currentEligibleAction` present, selection state is empty/`idle`.
2. **Update**: On card click, push index to array, check if action is complete.
3. **Submit**: When selection complete (wolf: 1 click; seer player: 1 click; seer underwater: 2 clicks; robber: 1 click; troublemaker: 2 clicks; water-ghost: 1 click), emit the `action:*` event.
4. **Clear**: On next `state:private` where `revealedCards.length === 0` or `currentEligibleAction` is null.

---

## 3. Action Panel Redesign

### Decision
Replace the entire button-based `renderActionPanel()` with a prompt-only panel that displays:
- Role action title (狼人行动 / 预言家行动 / etc.)
- Context-sensitive Chinese prompt text describing what to click
- Countdown timer (via existing `renderTimer()`)
- Selection progress indicator (for seer underwater: "已查看 1/2 张水下牌"; for troublemaker: "已选择 2 名玩家")

### Rationale
- The spec explicitly requires removing selection buttons (FR-001) and replacing with direct card click.
- The action panel still provides role context and guidance, which is essential for player understanding.
- Selection progress feedback helps players understand multi-step actions.

### Prompt Text Mapping

| Phase | Default Prompt | Progress State |
|---|---|---|
| wolf_action | "请点击一张水下牌查看身份" | (none, single step) |
| seer_action (idle) | "请点击一张水下牌查看身份（最多两张），或点击一名玩家的卡牌查看其身份" | — |
| seer_action (underwater, 1/2) | — | "已查看 1/2 张水下牌，可再点击一张水下牌查看" |
| seer_action (player, done) | "已查看目标玩家的身份，请等待下一阶段" | — |
| robber_action | "请点击一名其他玩家的卡牌查看并交换身份" | (none, single step) |
| troublemaker_action (0/2) | "请点击两名其他玩家的卡牌进行交换" | — |
| troublemaker_action (1/2) | — | "已选择 1/2 名玩家，请选择第二名玩家（可再次点击已选中卡牌取消）" |
| troublemaker_action (2/2) | "已选择两名玩家，正在提交交换..." | — |
| water_ghost_action | "请点击一张水下牌进行交换" | (none, single step) |

---

## 4. Card Clickable Visual Feedback

### Decision
Use pure CSS for clickable card indicators:
- `cursor: pointer` on clickable cards
- `:hover` pseudo-class with `transform: scale(1.03)` and box-shadow enhancement
- `transition: transform 0.15s ease, box-shadow 0.15s ease` for smooth hover

### Rationale
- Constitution principle IV (简洁自托管架构) prohibits external animation/image libraries.
- CSS-only approach is zero-dependency, performant, and works on both desktop and mobile.
- The card already uses CSS 3D transforms for flip animation — scaling is a natural extension of existing CSS capabilities.

### CSS Classes Added
- `.card.clickable`: Base class applied to cards that can be clicked (when user has `currentEligibleAction`). Sets `cursor: pointer` and enables `:hover` transform.
- `.card.selected`: Applied to troublemaker-selected player cards and seer-clicked underwater cards. Adds a highlight border (blue glow) to indicate selection.
- `.card.clickable:active`: Brief scale-down on mousedown/touch for tactile feedback.
- `.card.submitted`: Applied after any action is submitted to dim all cards and prevent further clicks.

### Alternatives Considered
- **JavaScript-driven hover animations**: More complex, no benefit over CSS.
- **Custom cursor images**: Over-engineering; standard `pointer` cursor is universally recognized.
- **Animated glow/pulse on clickable cards**: Could distract from countdown timer urgency; static hover feedback is sufficient.

---

## 5. Server-Side Compatibility Verification

### Decision
Server-side code (`engine.ts`, `event-handlers.ts`, `visibility.ts`) requires **zero modifications**. All existing Socket.IO event names, payload schemas, and game engine functions already support the exact payloads that card click will emit.

### Verification Matrix

| Card Click Scenario | Socket Event | Payload | Server Handler | Status |
|---|---|---|---|---|
| Wolf clicks underwater card | `action:wolf` | `{ underwaterIndex: 0\|1\|2 }` | `performWolfAction()` | ✅ Existing |
| Seer clicks player card | `action:seer` | `{ mode: 'view_one_player', targetSeatIndex: 0\|1\|2 }` | `performSeerAction()` | ✅ Existing |
| Seer clicks 2 underwater cards | `action:seer` | `{ mode: 'view_two_underwater', underwaterIndexes: [i, j] }` | `performSeerAction()` | ✅ Existing |
| Robber clicks player card | `action:robber` | `{ targetSeatIndex: 0\|1\|2 }` | `performRobberAction()` | ✅ Existing |
| Troublemaker clicks 2 players | `action:troublemaker` | `{ targetSeatIndexes: [0, 1] }` | `performTroublemakerAction()` | ✅ Existing |
| Water Ghost clicks underwater | `action:water-ghost` | `{ underwaterIndex: 0\|1\|2 }` | `performWaterGhostAction()` | ✅ Existing |

### Key Server Behaviors Preserved
- Server validates `INVALID_PHASE` (wrong phase) → returns error; client shows Chinese error.
- Server validates `INELIGIBLE_PLAYER` (wrong role) → returns error.
- Server validates `ACTION_WINDOW_CLOSED` (phase ended or already acted) → returns error; client prevents further clicks.
- Server emits `action:result` on success → client can use this to confirm action submission.
- Server emits `state:private` with updated `revealedCards` → triggers card flip animation.

---

## 6. Test Plan

### Unit Tests (`tests/unit/game-view.test.ts`)

| Test ID | Description |
|---|---|
| UT-CC-01 | Card elements with `currentEligibleAction` present have `.clickable` CSS class |
| UT-CC-02 | Card elements without `currentEligibleAction` do NOT have `.clickable` class |
| UT-CC-03 | Clicking a clickable card emits the correct `action:*` event with correct payload |
| UT-CC-04 | Clicking a non-clickable card does NOT emit any action event |
| UT-CC-05 | After action submission, all cards lose `.clickable` class |
| UT-CC-06 | Seer underwater mode: first click emits no event, second click emits `action:seer` with two indexes |
| UT-CC-07 | Seer player mode: clicking a player card immediately emits `action:seer` with `mode: view_one_player` |
| UT-CC-08 | Seer mode lock: after clicking underwater card, clicking player card does nothing |
| UT-CC-09 | Seer mode lock: after clicking player card, clicking underwater card does nothing |
| UT-CC-10 | Troublemaker: first click selects (no emit), second click on different player emits `action:troublemaker` |
| UT-CC-11 | Troublemaker: clicking selected card again deselects it |
| UT-CC-12 | Troublemaker: clicking own card does nothing |
| UT-CC-13 | Phase change clears all selection states |

### Integration Tests (`tests/integration/socket-flow.test.ts`)

| Test ID | Description |
|---|---|
| INT-CC-01 | Wolf card click → server receives `action:wolf` with correct `underwaterIndex` → client receives `state:private` with revealed card |
| INT-CC-02 | Seer underwater click×2 → server executes view_two_underwater → both cards in `revealedCards` |
| INT-CC-03 | Robber card click → server executes exchange → robber's `initialRole` updates in next `state:private` |
| INT-CC-04 | Non-acting player card click → no server event emitted → no state change |
| INT-CC-05 | Click after action submission → server rejects with error → client shows error message |
| INT-CC-06 | Phase end during partial seer selection → server auto-action → client receives partial reveals |

### End-to-End Tests (`tests/e2e/three-player-game.spec.ts`)

| Test ID | Description |
|---|---|
| E2E-CC-01 | Wolf player clicks underwater card → card flips with animation → identity shown |
| E2E-CC-02 | Seer clicks two underwater cards → both flip in sequence → panel shows "1/2" then "2/2" |
| E2E-CC-03 | Seer clicks player card → card flips → action completes |
| E2E-CC-04 | Robber clicks target player card → card flips → robber's role updates after swap |
| E2E-CC-05 | Troublemaker clicks two players → both highlight → swap submits |
| E2E-CC-06 | Non-acting player attempts to click cards → no response |
| E2E-CC-07 | Card hover visual feedback appears for acting player on clickable cards |
| E2E-CC-08 | After phase change, previously clickable cards become non-clickable |

---

## 7. Edge Case Handling

### Fast Double-Click
- **Client**: After emitting an action event, immediately set a `actionSubmitted: true` flag. All subsequent clicks check this flag and are no-ops.
- **Server**: Already validates against duplicate actions via `ACTION_WINDOW_CLOSED` check in `prepareRoleAction()`.

### Network Delay During Click
- **Client**: After emitting action event, add `submitted` class to all cards (dims them). This provides immediate visual feedback that the action is being processed, even before server response.
- **Server**: Response arrives via `action:result` → `state:private` within typical latency.

### Countdown Expiry During Multi-Step Selection
- **Seer**: If 1 of 2 underwater cards have been clicked when countdown expires, the server's auto-action logic will handle the remaining. The client should NOT submit a partial selection; let the server's timeout handle everything.
- **Troublemaker**: Same approach — do NOT submit partial selections. Let server auto-action handle.
- **Why**: Server is the authority. If the client submits partial data and the server independently processes auto-action, there's a race condition. Better to let server auto-action take over cleanly.

### Reconnect During Selection
- On reconnect, client receives fresh `state:private` with `revealedCards.length === 0` → triggers selection state clear.
- If action was already completed server-side before reconnect, `currentEligibleAction` will be null → cards not clickable.
- If action was NOT completed and phase is still active, `currentEligibleAction` will be present → selection state resets to zero, player starts fresh.

---

## Summary of Changes

| File | Change Type | Description |
|---|---|---|
| `src/client/state.ts` | MODIFY | Add `selectionState` to snapshot: seer mode/count, troublemaker selected, action submitted flag |
| `src/client/views/game.ts` | MODIFY | Replace `renderActionPanel()` button generation with prompt-only panel; add `bindCardClickHandlers()`; pass clickable state to card render functions |
| `src/client/views/util.ts` | MODIFY | Add prompt text helpers, card clickable state determination |
| `src/client/styles/main.css` | MODIFY | Add `.card.clickable`, `.card.selected`, `.card.submitted` styles |
| `src/client/main.ts` | MODIFY | Call card click binding in `bindGameControls()` |
| Test files | MODIFY | Add card click tests as outlined in §6 |
