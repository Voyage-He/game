# Implementation Plan: 修复身份牌翻转展示与技能查看

**Branch**: `001-online-room-game` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-fix-card-flip-reveal/spec.md`

## Summary

修复预言家、狼人、强盗技能查看身份牌的客户端展示 Bug，并重构玩家/水下牌 UI 为竖直卡牌元素，增加 CSS 3D 翻转动画。服务端技能逻辑和身份数据已正确（引擎层 `revealCardToSeat` 已实现），修复集中在：(1) 客户端渲染 `revealedCards` 数据，(2) 可见性模块按阶段过滤已揭示卡牌，(3) 卡牌化 UI 布局与 CSS 翻转动画。

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ LTS-compatible runtime; browser client targets modern evergreen browsers.

**Primary Dependencies**: Express for HTTP/static serving; Socket.IO for room-scoped real-time events; Vite for frontend bundling; Zod for runtime payload validation and shared contract schemas.

**Storage**: In-memory room store only. Active rooms, nicknames, game state, reconnect-token hashes, and transient chat delivery data are temporary and deleted or discarded after settlement or all players leaving. Persistent match or chat history requires a constitution amendment.

**Testing**: Vitest for deterministic unit and integration tests; Playwright for three-browser end-to-end room flows; contract tests for HTTP and Socket.IO payloads.

**Target Platform**: Self-hosted public-internet Node.js service on Linux, normally behind an HTTPS reverse proxy; browser clients on desktop and mobile web.

**Project Type**: Single TypeScript web application with one backend service, one browser frontend, and shared TypeScript contracts.

**Performance Goals**: At least 95% of visible room or game state updates reach affected connected clients within 2 seconds; card flip animation completes within 0.3–0.8 seconds via CSS transition.

**Constraints**: Server-authoritative game state; three-player invite-only rooms; no accounts, public lobby, matchmaking, spectators, persistent history, custom artwork, or nonessential animations unless justified through constitution governance.

**Scale/Scope**: Small self-hosted friend groups with many independent one-game rooms; feature plans must state any expected load beyond the current invite-only scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Required Gates

- **服务端权威与规则一致性**: ✅ PASS — 身份牌内容和技能查看结果始终以服务器 `IdentityCard` 和 `RoleAction` 为准；客户端仅渲染服务端下发的 `revealedCards`，不自行决定身份内容。技能触发逻辑已存在于 `engine.ts`（`performWolfAction`, `performSeerAction`, `performRobberAction`），遵循 `game_rule.md` 规则。

- **临时数据与隐私最小化**: ✅ PASS — 不新增持久数据。`revealedCards` 来自既有 `RoleAction` 记录（内存），阶段结束后通过可见性过滤隐藏。水下牌内容仅对有权查看的玩家（预言家、狼人）在技能阶段内临时可见。强盗查看后身份交换已由引擎层处理。

- **测试先行与契约可验证**: ✅ PASS — 需要新增测试：预言家/狼人/强盗技能后 `revealedCards` 在 `PrivateRoomView` 中出现的可见性测试、阶段变更后 `revealedCards` 消失的测试、卡牌翻转动画 CSS 类的存在性测试、水下牌三张卡牌形状渲染测试、重连后卡牌状态保持测试。

- **简洁自托管架构**: ✅ PASS — 不新增服务、数据库、外部依赖或自定义美术资产。牌翻转效果使用纯 CSS 3D transform，不依赖外部动画库。UI 重构使用纯 CSS 几何形状和文字。

- **清晰中文体验与实时可用性**: ✅ PASS — 身份牌名称、技能阶段提示文字、水下牌标签均为中文。`buildRevealedCards` 返回的角色字段已为中文名称。翻转动画使用 CSS transition，延迟在 0.3–0.8 秒内。

### Initial Gate

All five gates PASS. No violations requiring Complexity Tracking.

### Post-Design Gate

Re-evaluated after Phase 1 design (research.md, data-model.md, contracts/internal-contracts.md, quickstart.md):

- **服务端权威与规则一致性**: ✅ PASS — Phase filtering in `buildRevealedCards()` ensures server controls visibility timing. Client never fabricates identity data; `revealedCards` comes exclusively from server-authoritative `RoleAction` records. Identity swap for robber is already handled server-side in `performRobberAction()`.

- **临时数据与隐私最小化**: ✅ PASS — `animatedCardKeys` Set is purely client-side and ephemeral (cleared on phase change). No server-side persistence added. Phase filtering ensures old reveals are not leaked. Underwater card content only sent to authorized seats via existing `visibleToSeatIds` mechanism.

- **测试先行与契约可验证**: ✅ PASS — Test plan in research.md §6 maps to concrete test files: `visibility.test.ts` (phase filtering), `game-view.test.ts` (card HTML structure), `socket-flow.test.ts` (end-to-end reveal flow), `three-player-game.spec.ts` (E2E card flip). Contract in `contracts/internal-contracts.md` defines precise `revealedCards` behavior per phase.

- **简洁自托管架构**: ✅ PASS — Zero new dependencies, services, or infrastructure. Card flip uses CSS `perspective` + `rotateY(180deg)` + `transition`. Card back uses CSS gradient patterns — no image assets. All changes within existing `src/` tree.

- **清晰中文体验与实时可用性**: ✅ PASS — All card labels, role names, action prompts remain in Chinese. `data-model.md` confirms Chinese role names on card fronts. CSS transition duration of 0.5s is within 0.3–0.8s spec range. Phase filtering ensures timely hiding on phase advance.

**Post-Design Gate Result**: All five gates PASS. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-card-flip-reveal/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (if applicable)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
package.json
src/
├── server/
│   ├── game/
│   │   ├── engine.ts        # [MODIFY] Phase-aware card visibility helper
│   │   └── visibility.ts    # [MODIFY] Filter revealedCards by current phase
│   └── realtime/
│       └── event-handlers.ts # [MODIFY] No changes needed; confirms existing flow
├── client/
│   ├── state.ts             # [MODIFY] Track card flip animation state
│   ├── views/
│   │   ├── game.ts          # [MODIFY] Card rendering, underwater cards, revealed cards display
│   │   └── util.ts          # [MODIFY] New card rendering helpers
│   └── styles/
│       └── main.css         # [MODIFY] Card styles, flip animation, underwater cards layout
└── shared/
    ├── types.ts             # [MODIFY] Add Phase to revealed card context
    └── contracts.ts         # [NO CHANGE] Existing schemas cover all actions

tests/
├── unit/
│   ├── visibility.test.ts   # [MODIFY] Add phase-filtered reveal tests
│   └── game-view.test.ts    # [MODIFY] Add card rendering tests
├── integration/
│   └── socket-flow.test.ts  # [MODIFY] Add card reveal flow tests
└── e2e/
    └── three-player-game.spec.ts  # [MODIFY] Add card flip e2e tests
```

**Structure Decision**: All changes stay within the existing single TypeScript web application. No new services, directories, or dependencies.

## Complexity Tracking

> No violations — this section intentionally left empty.
