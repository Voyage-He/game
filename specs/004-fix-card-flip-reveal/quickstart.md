# Quickstart: 身份牌翻转展示与技能查看

**Feature**: 004-fix-card-flip-reveal | **Date**: 2026-05-23

## Prerequisites

- Node.js 20+
- npm
- The project already cloned and dependencies installed (`npm install`)

## Development Setup

```bash
# Start dev server with hot reload
npm run dev

# Or start with accelerated timers for testing
npm run dev:test
```

The dev server starts on `http://localhost:3000`. Open three browser tabs (or use Playwright) to simulate three players.

## Manual Verification Checklist

### 1. Verify Card Rendering
1. Start a 3-player game
2. **Expected**: Each player is shown as a vertical rectangular card with their nickname
3. **Expected**: Three underwater cards are shown below, face-down, labeled "水下的牌"

### 2. Verify Seer Skill Reveal
1. Ensure one player gets 预言家 role (check initial role display)
2. During 预言家行动 phase, click a target action button
3. **Expected**: Target card(s) execute flip animation and show identity content (Chinese role name)
4. **Expected**: After phase advances, cards revert to face-down

### 3. Verify Wolf Skill Reveal
1. During 狼人行动 phase, click one underwater card
2. **Expected**: That underwater card flips, shows identity; other two remain face-down
3. **Expected**: After phase advances, card reverts to face-down

### 4. Verify Robber Skill Reveal
1. During 强盗行动 phase, click a target player
2. **Expected**: Target player's card flips, shows identity
3. **Expected**: Robber's own card updates to show swapped identity (the target's original role)

### 5. Verify Reconnect Behavior
1. After a skill action (card is face-up), refresh the page
2. Do NOT click "reconnect" until the same phase is still active
3. **Expected**: Card is face-up without re-playing the flip animation

### 6. Verify Privacy
1. Open a second browser as a different player
2. When the first player's skill phase is active, verify the second player sees NO card flips or identity content

## Running Tests

```bash
# All unit + integration tests
npm test

# End-to-end tests (requires Playwright browsers installed)
npm run test:e2e

# Watch mode for development
npm run test:watch
```

## Key Files

| File | Purpose |
|------|---------|
| `src/server/game/visibility.ts` | Phase-aware revealed cards filtering |
| `src/client/views/game.ts` | Card rendering and flip logic |
| `src/client/styles/main.css` | Card styles, flip animation |
| `src/client/state.ts` | Client-side flip state tracking |
| `src/shared/types.ts` | Shared type definitions |

## Architecture Decision Records

See [research.md](./research.md) for detailed decisions on:
- Why phase filtering is done server-side vs client-side
- Why CSS 3D transforms are used for flip animation
- Why Grid layout is used for card positioning
- Why a client-side `Set` tracks animation state for reconnect
