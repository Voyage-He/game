# Data Model: 点击卡牌直接翻转揭示身份

**Feature**: 005-click-to-reveal
**Date**: 2026-05-23

## Overview

This feature adds client-side selection state for card click interactions. No new server-side entities, database tables, or persistent storage. All new data is ephemeral client-side state reset on phase transitions.

---

## Entity: CardClickTarget

A card element rendered in the UI that may be clickable during a skill action phase.

| Field | Type | Source | Description |
|---|---|---|---|
| `kind` | `'player'` \| `'underwater'` | Derived from DOM data attributes | Whether this is a player card or underwater card |
| `targetIndex` | `0` \| `1` \| `2` | `data-seat-index` / `data-underwater-index` | The index identifying this card's target |
| `clickable` | `boolean` | Computed from `currentEligibleAction` + selection state | Whether the card accepts clicks right now |
| `selected` | `boolean` | Computed from `selectionState` | Whether this card is currently selected (troublemaker) or has been clicked (seer underwater) |
| `submitted` | `boolean` | Computed from `actionSubmitted` flag | Whether action has been emitted (all cards dimmed) |

### Clickable State Rules

A card is **clickable** when ALL of:
1. `privateView.currentEligibleAction !== null` (player has an active skill turn)
2. `actionSubmitted === false` (no action already submitted)
3. For player cards: `kind === 'player'` AND `targetIndex !== ownSeatIndex` (can't target self)
4. For underwater cards: `kind === 'underwater'`
5. Role-specific constraints:
   - **Wolf**: only underwater cards
   - **Seer**: underwater cards (not yet clicked) AND player cards (other players only, unless mode locked to underwater)
   - **Robber**: only other players' cards
   - **Troublemaker**: only other players' cards
   - **Water Ghost**: only underwater cards

A card is **selected** when:
- Troublemaker phase: the card's `targetIndex` is in `troublemakerSelected[]`
- Seer underwater mode: the card's `underwaterIndex` is in `seerUnderwaterClicked[]`

---

## Entity: SelectionState (Client-Side Only)

Ephemeral state tracking multi-step card selection progress. Lives in `ClientStateSnapshot`, cleared on phase change.

| Field | Type | Initial | Description |
|---|---|---|---|
| `actionSubmitted` | `boolean` | `false` | Set to `true` when any `action:*` event is emitted. Prevents all further clicks until next phase. |
| `seerActionMode` | `'idle'` \| `'underwater'` \| `'player'` | `'idle'` | Locked on first click. `'underwater'` = player entered two-underwater path; `'player'` = player clicked another player. |
| `seerUnderwaterClicked` | `number[]` | `[]` | Array of underwater indexes (0, 1, 2) already clicked. Max 2 distinct entries. |
| `troublemakerSelected` | `number[]` | `[]` | Array of seat indexes selected for swap. Max 2 entries. First click adds, second click on same removes; second click on different submits. |

### State Transitions

#### Seer Action

```
IDLE
├── click player card → mode='player', emit action:seer (player), submitted=true
└── click underwater card → mode='underwater', clicked=[idx]
    └── click different underwater card → clicked=[idx1,idx2], emit action:seer (underwater), submitted=true
```

#### Troublemaker Action

```
START (selected=[])
├── click player A → selected=[A]
│   ├── click player B (B≠A) → selected=[A,B], emit action:troublemaker, submitted=true
│   └── click player A again → selected=[] (deselect)
└── click own card → ignored
```

#### All Single-Step Actions (Wolf, Robber, Water Ghost)

```
START
└── click valid target → emit action:*, submitted=true
```

### Cleanup Triggers

Selection state is reset to initial values when:
1. `revealedCards.length === 0` in incoming `state:private` → indicates phase transition (existing cleanup signal in `state.ts`)
2. `currentEligibleAction === null` in incoming `state:private` → player no longer eligible
3. Reconnect: fresh `state:private` arrives, likely with clean state

---

## Relationships

```
ClientStateSnapshot
├── publicView: PublicRoomView        # [existing] public game state
├── privateView: PrivateRoomView      # [existing] private player state
│   └── currentEligibleAction         # [existing] drives card clickability
│       ├── phase: RolePhase
│       └── options: string[]
├── selectionState: SelectionState    # [NEW] ephemeral click selection tracking
│   ├── actionSubmitted: boolean
│   ├── seerActionMode: 'idle'|'underwater'|'player'
│   ├── seerUnderwaterClicked: number[]
│   └── troublemakerSelected: number[]
└── animatedCardKeys: Set<string>     # [existing] flip animation tracking
```

```
Server (no changes)
├── Room.actions: RoleAction[]        # [existing] records all submitted actions
├── Room.phase: Phase                 # [existing] current game phase
└── IdentityCard.visibleToSeatIds     # [existing] drives revealedCards generation
```

---

## Validation Rules

| Rule | Enforcement | Error Case |
|---|---|---|
| Only acting player can click cards | Client checks `currentEligibleAction !== null`; Server validates in `prepareRoleAction()` | Client: no-op; Server: `INVALID_PHASE` |
| Cannot click after action submitted | Client: `actionSubmitted` flag; Server: `ACTION_WINDOW_CLOSED` | Client: no-op; Server: error |
| Cannot click own player card | Client filter: exclude `seatIndex === ownSeatIndex` | Client: card not clickable |
| Seer: max 2 distinct underwater cards | Client: `seerUnderwaterClicked.length < 2` and `!seerUnderwaterClicked.includes(idx)` | Client: no-op |
| Seer: cannot switch mode after first click | Client: `seerActionMode !== 'idle'` | Client: no-op |
| Troublemaker: must select 2 different players | Client: `troublemakerSelected.length === 2` and no duplicates | Client: no-op |
| Troublemaker: cannot select self | Client filter: exclude own seat | Client: card not clickable |
| Duplicate action prevention | Server: `room.actions.some()` check | Server: `ACTION_WINDOW_CLOSED` |
