# Contracts: 身份牌翻转展示与技能查看

**Feature**: 004-fix-card-flip-reveal | **Date**: 2026-05-23

## Overview

This feature does not introduce new external interfaces. It modifies the **existing internal contract** between the server's `visibility.ts` module and the client's `game.ts` view regarding the `revealedCards` field in `PrivateRoomView`.

All Socket.IO events and HTTP endpoints remain unchanged. The Zod schemas in `src/shared/contracts.ts` already validate all message shapes correctly.

## Modified Internal Contract

### `PrivateRoomView.revealedCards` — Phase Bounding

**Contract**: The `revealedCards` array in `PrivateRoomView` MUST only contain cards revealed by the seat's own actions **during the current phase**. When the room advances to the next phase, `revealedCards` MUST be empty.

**Producer**: `src/server/game/visibility.ts` → `buildRevealedCards(room, seatId)`

**Consumer**: `src/client/views/game.ts` → `renderGame()` → card rendering

**Schema** (unchanged, from `contracts.ts`):
```typescript
revealedCards: z.array(z.object({
  location: z.string().min(1),  // e.g., "underwater:0", "playerSeat:1"
  role: RoleSchema              // e.g., "狼人", "预言家", ...
}))
```

**Behavior Contract**:

| State | `revealedCards` Content |
|-------|----------------------|
| Game starts, no actions taken | `[]` (empty) |
| Wolf acts in `wolf_action`, reveals underwater:0 | `[{ location: "underwater:0", role: "捣蛋鬼" }]` |
| Phase advances to `seer_action` | `[]` (wolf reveal cleared) |
| Seer acts, reveals playerSeat:1 | `[{ location: "playerSeat:1", role: "狼人" }]` |
| Phase advances to `robber_action` | `[]` (seer reveal cleared) |
| Robber acts, reveals playerSeat:0 | `[{ location: "playerSeat:0", role: "预言家" }]` |
| Phase advances past all role phases | `[]` |
| Reconnect during same phase after acting | Same reveals as before disconnect |
| Reconnect after phase change | `[]` |

### Card Flip Animation State (Client-Only)

**Contract**: The client MUST track which card locations have been newly revealed to determine whether to play the flip animation or show the card directly face-up.

**Interface** (conceptual, not serialized):
```typescript
interface CardFlipState {
  // Keys are location strings matching revealedCards[].location
  animatedCards: Set<string>;
  
  // Called when a new revealedCard appears for the first time
  markAnimated(location: string): void;
  
  // Called when the phase changes (revealedCards becomes empty)
  reset(): void;
}
```

## Socket.IO Events (Unchanged)

All event names and payload schemas remain unchanged:

| Event | Direction | Schema | Purpose |
|-------|-----------|--------|---------|
| `action:wolf` | Client → Server | `WolfActionSchema` | Wolf views one underwater card |
| `action:seer` | Client → Server | `SeerActionSchema` | Seer views two underwater or one player |
| `action:robber` | Client → Server | `RobberActionSchema` | Robber views and swaps with a player |
| `action:result` | Server → Client | `ActionResult` | Immediate feedback after action |
| `state:private` | Server → Client | `PrivateRoomViewSchema` | Full private state including `revealedCards` |
| `state:public` | Server → Client | `PublicRoomViewSchema` | Public state broadcast |

## CSS Class Contract

The client view MUST produce the following CSS class structure for predictable styling:

```html
<!-- Player card -->
<div class="player-card" data-seat-index="0">
  <div class="player-card-header">
    <span class="player-nickname">玩家1</span>
    <span class="player-badges">...</span>
  </div>
  <div class="card" data-flipped="false">
    <div class="card-inner">
      <div class="card-back">🃏</div>
      <div class="card-front">
        <span class="card-role">狼人</span>
      </div>
    </div>
  </div>
</div>

<!-- Underwater card -->
<div class="underwater-card" data-underwater-index="0">
  <div class="card" data-flipped="false">
    <div class="card-inner">
      <div class="card-back">🃏</div>
      <div class="card-front">
        <span class="card-role">强盗</span>
      </div>
    </div>
  </div>
  <span class="underwater-label">水下 1</span>
</div>
```

**Flip Trigger**: When `revealedCards` contains a matching card, set `data-flipped="true"` and optionally add `class="card-flip-in"` for the initial animation.
