# Data Model: 精简界面无意义UI、减少纵向内容展

**Feature**: 008-reduce-ui-clutter | **Date**: 2026-05-24

## No Data Model Changes

This feature is purely a UI presentation change. No data entities, fields, types, or contracts are added, modified, or removed.

### Existing Entities (Unchanged)

| Entity | Location | Impact |
|--------|----------|--------|
| `PublicRoomView` | `src/shared/types.ts` | Zero changes — `roomCode` field still exists, just not rendered in game view |
| `PrivateRoomView` | `src/shared/types.ts` | Zero changes |
| `Phase` / `RolePhase` | `src/shared/types.ts` | Zero changes — phase labels in `util.ts` unchanged |
| `SettlementView` | `src/shared/types.ts` | Zero changes |
| `ChatMessage` | `src/shared/types.ts` | Zero changes |
| `DEFAULT_PHASE_DURATIONS_MS` | `src/shared/types.ts` | Zero changes |
| Socket.IO event schemas | `src/shared/contracts.ts` | Zero changes |

### CSS Custom Properties (New/Modified)

These are presentation-only values in `src/client/styles/main.css`:

| Property | Current Value | New Value | Rationale |
|----------|--------------|-----------|-----------|
| `.card` width (desktop) | `140px` | `~100px` | Reduce card footprint |
| `.card` height (desktop) | `210px` | `~150px` | Maintain 2:3 aspect ratio |
| `.card` width (mobile ≤640px) | `clamp(100px, 28vw, 140px)` | `clamp(80px, 24vw, 100px)` | Smaller on mobile |
| `.card` height (mobile) | `clamp(150px, 42vw, 210px)` | `clamp(120px, 36vw, 150px)` | Proportional |
| `.card` perspective | `800px` | `~600px` | Tuned for smaller card |
| `.card-role` font-size | `1.4rem` | `~1rem` | Fit identity text on smaller card |
| `.card-role` font-size (mobile) | `1.1rem` | `~0.9rem` | Mobile scaling |
| `.card-back` font-size | `2.5rem` | `~1.8rem` | Emoji size |
| `.phase-card h2` font-size | `clamp(1.6rem, 5vw, 2.5rem)` | `~1.25rem` | Compact heading |
| `.player-card` flex-direction | `column` | `column` (card first, header after) | Visual reorder |
| `.player-card-header` layout | vertical stack | compact horizontal or removed | Horizontal badges |

No runtime data model changes. No database schema changes. No API contract changes.
