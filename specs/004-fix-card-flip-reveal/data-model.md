# Data Model: 身份牌翻转展示与技能查看

**Feature**: 004-fix-card-flip-reveal | **Date**: 2026-05-23

## Overview

This feature does **not** introduce new persistent entities or modify the server-side data model. It modifies the **presentation layer** to render existing data (`revealedCards`, player seats, underwater cards) as card elements with flip animation.

## Existing Entities (Referenced)

These entities already exist in `src/shared/types.ts` and are used as-is:

| Entity | Purpose | Relevant Fields for This Feature |
|--------|---------|----------------------------------|
| `Room` | Core game state | `phase`, `actions[]`, `seats[]`, `underwaterCardIds[]`, `deck[]` |
| `RoleAction` | Record of a skill activation | `phase`, `actingSeatId`, `revealedCardIds[]`, `selectedTargets[]` |
| `IdentityCard` | A single role card | `role`, `currentLocation`, `visibleToSeatIds[]` |
| `PlayerSeat` | A player's seat | `seatIndex`, `nickname`, `connectionStatus`, `currentCardId` |
| `PrivateRoomView` | Per-seat private state sent to client | `revealedCards[]`, `initialRole`, `currentEligibleAction` |

## Modified Behavior

### `PrivateRoomView.revealedCards`

**Before (current)**: Contains ALL revealed cards from ALL past actions for the seat, across all phases.

**After (fixed)**: Contains only revealed cards from actions matching the **current phase** (`action.phase === room.phase`).

**Reason**: FR-008 requires cards to revert to face-down when the skill phase ends. The client re-renders whenever it receives a new `state:private`. By filtering server-side, the client automatically hides reveals when the phase changes.

**State Transitions**:

```
Phase: wolf_action, wolf acts → revealedCards: [{ location: "underwater:0", role: "捣蛋鬼" }]
Phase: seer_action (advance)      → revealedCards: []  (wolf's reveal hidden)
Phase: seer_action, seer acts     → revealedCards: [{ location: "playerSeat:1", role: "狼人" }]
Phase: robber_action (advance)    → revealedCards: []  (seer's reveal hidden)
...
```

### Client-Side Card Flip State (New)

A transient client-only data structure tracking which cards have been animated:

```typescript
// Managed in game.ts rendering logic, not persisted
const animatedCardKeys: Set<string> = new Set();
// Key format: "{location}:{role}" e.g., "underwater:0:捣蛋鬼"
```

**Purpose**: Prevents flip animation replay on reconnect (FR-009). The set tracks which card locations have already completed their flip-in animation within the current phase. On phase transition, the set is cleared.

## Visual Card Elements

### Player Card

```
┌──────────────┐
│    [昵称]     │  ← nickname (always visible)
│   [在线状态]   │  ← connection status badge
│   ┌────────┐  │
│   │ 卡牌背面 │  │  ← card back (face-down default)
│   │   🃏    │  │
│   └────────┘  │
│   (翻转后)     │
│   ┌────────┐  │
│   │  狼人   │  │  ← card front (face-up when revealed)
│   └────────┘  │
└──────────────┘
```

### Underwater Card

```
┌──────────────┐
│  水下的牌 #1  │
│   ┌────────┐  │
│   │ 卡牌背面 │  │  ← face-down by default
│   └────────┘  │
│   (翻转后)     │
│   ┌────────┐  │
│   │  强盗   │  │  ← face-up when revealed to seer/wolf
│   └────────┘  │
└──────────────┘
```

## Validation Rules

| Rule | Source | Enforcement |
|------|--------|-------------|
| Only the acting seat sees revealed cards | FR-011 | Server: `buildRevealedCards` filters by `actingSeatId === seatId` |
| Revealed cards hidden after phase change | FR-008 | Server: `buildRevealedCards` filters by `action.phase === room.phase` |
| Card flip animation 0.3–0.8 seconds | FR-006 | Client: CSS `transition: transform 0.5s` |
| No repeat animation on reconnect | FR-009 | Client: `animatedCardKeys` Set prevents re-trigger |
| Three underwater cards always visible | FR-005 | Client: render `underwaterCardIds` (3 items) |
| Player cards show nickname | FR-004 | Client: render `PlayerSeat.nickname` on card |
| Disconnected player card shows distinct state | FR-013 | Client: CSS class based on `connectionStatus` |
