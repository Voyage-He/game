# Research: 精简界面无意义UI、减少纵向内容展

**Feature**: 008-reduce-ui-clutter | **Date**: 2026-05-24

## Research Questions

### Q1: Current room code display locations

**Decision**: Remove room code from game panel `<h1>`; keep lobby room code display (needed for invite sharing) but make it more compact.

**Findings**:
- `src/client/views/game.ts:14`: `<h1 id="game-title">房间 ${escapeHtml(publicView.roomCode)}</h1>` — the sole game-view room code display
- `src/client/views/lobby.ts:29`: `<h2>房间码 <strong class="room-code">${escapeHtml(roomCode)}</strong></h2>` — lobby room code for sharing; should be preserved but can be compact
- No other files reference `roomCode` for display purposes
- Removing the game-view `<h1>` frees ~2rem of vertical space at the top of the game panel

**Rationale**: The game-view room code serves no gameplay purpose after joining. The lobby room code is needed for players to invite others. Remove game-view display; optionally make lobby display more compact (e.g., inline text instead of a full `<h2>`).

**Alternatives considered**: 
- Replacing with a tiny "房间: XXXXXX" subtitle — rejected, still takes space with no value
- Moving room code to browser title — adds complexity for zero user value

### Q2: Current phase indicator dimensions

**Decision**: Collapse the `.phase-card` block from a large `h2` + badge into a compact inline heading. Target ≥ 40% vertical footprint reduction.

**Findings**:
- `src/client/views/game.ts:16-19`:
  ```html
  <div class="phase-card">
    <span class="badge">当前阶段</span>
    <h2>${formatPhase(publicView.phase)}</h2>
    ${renderTimer(snapshot)}
  </div>
  ```
- CSS: `.phase-card h2 { margin: 0.25rem 0; font-size: clamp(1.6rem, 5vw, 2.5rem); }` — very large heading
- CSS: `.phase-card` inherits `.panel` styles: `padding: 1rem; margin: 1rem 0;`
- Current vertical footprint at 375px viewport: badge (~24px) + h2 (~40px at 5vw=18.75px+line-height) + timer (~24px) + padding (32px) ≈ 120px
- After changes: reduced padding, smaller heading, inline badge → target ~70px or less

**Rationale**: The "当前阶段" badge text is redundant (the h2 already shows the phase name). Can merge badge into heading or remove badge entirely. Reduce h2 to a more reasonable `font-size: 1.25rem` and reduce padding.

### Q3: Current player card layout

**Decision**: Change `.player-card` from `flex-direction: column` to a horizontal arrangement where nickname sits below the card (as a label).

**Findings**:
- `src/client/views/game.ts:58-62`:
  ```html
  <div class="player-card">
    <div class="player-card-header">
      <span class="player-nickname">...</span>
      <span class="player-badges">...</span>
    </div>
    ${renderCardElement(...)}
  </div>
  ```
- CSS: `.player-card { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }`
- CSS: `.player-card-header { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }`
- Current stack: nickname → badges → card → vertical height ≈ 210px(card) + 32px(header) + 8px(gap) ≈ 250px per player
- Three players: 3 × 250px = 750px vertical in single-column mobile layout

**Rationale**: Moving nickname below the card (still horizontal/centered) or to the side creates a more natural "playing card on table with nameplate" look. Target: nickname as a compact label directly under the card, reducing per-player height from ~250px to ~card height + ~20px label.

**Alternative considered**: Nickname to the left of card (side-by-side) — rejected because it would make the 3-column grid too wide on mobile.

### Q4: Current card dimensions and scaling

**Decision**: Reduce desktop card from 140×210px to ~100×150px; reduce mobile from clamp(100px,28vw,140px) to ~80–96px width.

**Findings**:
- CSS: `.card { width: 140px; height: 210px; perspective: 800px; }`
- CSS (mobile): `.card { width: clamp(100px, 28vw, 140px); height: clamp(150px, 42vw, 210px); }`
- Aspect ratio: 2:3 (width:height = 1:1.5) — standard playing card ratio
- `.card-role { font-size: 1.4rem; }` — needs to scale down proportionally
- `.card-back { font-size: 2.5rem; }` — emoji back decoration, scales naturally
- `perspective: 800px` — 3D flip perspective; should be reduced proportionally for smaller cards to maintain visual quality
- WCAG touch target: 44×44px minimum; at 80px width, touch area is adequate (80px > 44px)

**Rationale**: Simple proportional scaling preserves the visual design. 100×150px is ~71% of original size, maintaining 2:3 ratio. Mobile 80×120px is ~57% of original — aggressive but still functional. The `.card-role` font at 1.4rem on 140px card → should scale to ~1rem on 100px card.

### Q5: CSS-only changes vs HTML restructure

**Decision**: All four changes achievable with CSS modifications + minor HTML reordering (move nickname after card element in rendered output, remove room code line). No JavaScript logic changes.

**Findings**:
- Room code removal: delete one line in `game.ts` template literal
- Phase compact: CSS changes to `.phase-card h2`, `.phase-card .badge`; optionally merge badge into heading
- Player card horizontal: reorder HTML template (card first, then nickname), CSS `flex-direction` stays column but card is now above nickname (shorter stack)
- Card sizing: pure CSS changes to `.card`, `.card-role`, `.card-back`, `perspective`
- No changes to `state.ts`, `main.ts`, `contracts.ts`, server code, or Socket.IO events

**Rationale**: This is a pure presentational change. Keeping it to CSS + template reordering minimizes regression risk.

### Q6: Impact on existing tests

**Decision**: No impact on 83 unit/integration tests (they test logic, not rendering). E2E tests may need visual tolerance updates if they perform screenshot comparisons.

**Findings**:
- Unit tests (`tests/unit/`): Test timers, game engine, visibility logic — zero impact
- Integration tests (`tests/integration/`): Test Socket.IO event flow — zero impact
- E2E tests (`tests/e2e/`): Browser-based tests that verify game flow; may need updated selectors if HTML structure changes (e.g., removing room code `<h1>`)
- CSS changes don't affect test assertions that rely on data attributes or text content

**Rationale**: Test suite should continue passing with zero or minimal changes. E2E selectors targeting text "房间" may need updating to not assert its presence.

## Summary

All four UI simplifications are pure frontend changes:
1. **Room code removal**: Delete 1 line in `game.ts`, optional lobby compacting
2. **Phase badge compaction**: CSS resize + optional HTML inline merge
3. **Player card horizontal**: HTML reorder (card first, then nickname) + CSS tweaks
4. **Card size reduction**: Pure CSS dimension changes

Zero backend changes. Zero new dependencies. Estimated touch: 2 files (`game.ts`, `main.css`).
