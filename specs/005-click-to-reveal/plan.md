# Implementation Plan: 点击卡牌直接翻转揭示身份

**Branch**: `001-online-room-game` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-click-to-reveal/spec.md`

## Summary

移除所有技能行动面板中的按钮式目标选择（"选择水下 1/2/3"、"查看水下 1+2"、"选择玩家X"等），改为玩家直接点击 UI 中的卡牌元素（玩家卡牌、水下牌）来触发技能行动。服务端技能逻辑、Socket.IO 事件体系和载荷格式保持不变；客户端将卡牌点击映射为已有的 `action:*` 事件。捣蛋鬼和预言家需要两步选择的技能通过客户端临时选择状态管理，选中满额后自动提交。

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ LTS-compatible runtime; browser client targets modern evergreen browsers.

**Primary Dependencies**: Express for HTTP/static serving; Socket.IO for room-scoped real-time events; Vite for frontend bundling; Zod for runtime payload validation and shared contract schemas.

**Storage**: In-memory room store only. Active rooms, nicknames, game state, reconnect-token hashes, and transient chat delivery data are temporary and deleted or discarded after settlement or all players leaving. Persistent match or chat history requires a constitution amendment.

**Testing**: Vitest for deterministic unit and integration tests; Playwright for three-browser end-to-end room flows; contract tests for HTTP and Socket.IO payloads.

**Target Platform**: Self-hosted public-internet Node.js service on Linux, normally behind an HTTPS reverse proxy; browser clients on desktop and mobile web.

**Project Type**: Single TypeScript web application with one backend service, one browser frontend, and shared TypeScript contracts.

**Performance Goals**: At least 95% of visible room or game state updates reach affected connected clients within 2 seconds; card click to visual response within 50ms for cursor feedback, within 1s for server round-trip flip. Card flip animation uses existing 0.5s CSS transition from spec 004.

**Constraints**: Server-authoritative game state; three-player invite-only rooms; no accounts, public lobby, matchmaking, spectators, persistent history, custom artwork, or nonessential animations unless justified through constitution governance.

**Scale/Scope**: Small self-hosted friend groups with many independent one-game rooms; feature plans must state any expected load beyond the current invite-only scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Required Gates

- **服务端权威与规则一致性**: ✅ PASS — 卡牌可点击状态由服务端下发的 `currentEligibleAction` 决定（仅当前行动玩家可见）。客户端仅将点击事件转换为已有的 `action:wolf`、`action:seer`、`action:robber`、`action:troublemaker`、`action:water-ghost` 事件，载荷格式与现有服务端验证逻辑完全兼容。服务端的 `performWolfAction`、`performSeerAction` 等函数不需要任何修改。身份揭示、交换逻辑和阶段推进仍由服务端全权控制。

- **临时数据与隐私最小化**: ✅ PASS — 客户端新增的临时状态包括：预言家的"水下牌已查看计数/模式锁定"（技能阶段内有效）、捣蛋鬼的"已选中玩家列表"（技能阶段内有效）、整体"点击已提交"标志。这些状态均在阶段切换或收到新的 `state:private` 时清除（当前 `state.ts` 中已有 `revealedCards.length === 0` 时清空 `animatedCardKeys` 的机制，选择状态同样在此处清除）。不通过卡牌点击交互暴露任何额外隐私。

- **测试先行与契约可验证**: ✅ PASS — 需新增测试：(1) 技能阶段内卡牌可点击性测试（有 `currentEligibleAction` 的玩家点击触发事件，非行动玩家点击无响应），(2) 各技能点击后正确事件发射测试（事件名及载荷匹配），(3) 预言家两步水下牌选择的独立翻转测试，(4) 捣蛋鬼两步选择的中间状态与取消逻辑测试，(5) 点击后防重复提交测试，(6) 阶段结束后卡牌不可点击测试。详见 Phase 0 research §6。

- **简洁自托管架构**: ✅ PASS — 零新依赖、零新服务、零新增存储。卡牌可点击视觉反馈使用已有 CSS `cursor: pointer` 和 `:hover` 伪类。点击事件处理为纯 DOM 事件委托，利用 Vite 打包内联。不引入动画库或 UI 框架。

- **清晰中文体验与实时可用性**: ✅ PASS — 行动面板中文提示文字更新为点击引导（"请点击一张水下牌查看身份"、"请选择两名其他玩家进行交换"等）。捣蛋鬼选中状态提示为中文。预言家每次点击水下牌后立即翻转，面板实时更新"已查看 1/2 张水下牌"。

### Initial Gate

All five gates PASS. No violations requiring Complexity Tracking.

### Post-Design Gate

Re-evaluated after Phase 1 design (research.md, data-model.md, contracts/card-click-events.md, quickstart.md):

- **服务端权威与规则一致性**: ✅ PASS — 所有卡牌点击事件映射为已有的 Socket.IO `action:*` 事件，载荷格式通过现有 Zod schema 验证。服务端 `engine.ts` 的函数（`performWolfAction`、`performSeerAction` 等）零修改。`currentEligibleAction` 由服务端下发的 `PrivateRoomView` 决定，客户端不自行判断可行性。卡牌可点击状态完全由服务端权威驱动。

- **临时数据与隐私最小化**: ✅ PASS — 客户端新增的 `SelectionState`（`actionSubmitted`、`seerActionMode`、`seerUnderwaterClicked`、`troublemakerSelected`）完全是临时数据，存储在 `ClientStateSnapshot` 中，不持久化。阶段切换或 `currentEligibleAction` 变为 null 时自动清除（复用已有的 `revealedCards.length === 0` 清除信号）。不通过点击交互暴露任何额外隐私 — 非行动玩家的卡牌始终不可点击。

- **测试先行与契约可验证**: ✅ PASS — research.md §6 定义了完整的测试计划（13 个单元测试、6 个集成测试、8 个 E2E 测试）。测试覆盖：各技能卡牌可点击性、事件载荷正确性、预言家两步选择、捣蛋鬼选择/取消、防重复提交、阶段结束清除、非行动玩家隔离。所有测试均可独立于实现先行编写。

- **简洁自托管架构**: ✅ PASS — 零新依赖、零新服务、零新存储、零新文件。所有变更限于已有的客户端 TypeScript 文件和 CSS 文件。卡牌悬停效果使用纯 CSS `cursor: pointer` + `:hover` transform。事件处理使用已有的 Socket.IO 通道。服务端代码完全不变。

- **清晰中文体验与实时可用性**: ✅ PASS — 行动面板提示文字全部为中文（见 research.md §3 表格）。捣蛋鬼选择进度、预言家查看计数均为中文提示。卡牌点击到翻转动画延迟在 1 秒目标内（客户端 50ms 内视觉反馈 + 服务端往返 + 0.5s CSS 翻转动画）。断线玩家的卡牌保持可点击但带有离线视觉标识。

**Post-Design Gate Result**: All five gates PASS. No Complexity Tracking entries needed. Design is fully aligned with constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/005-click-to-reveal/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
package.json
src/
├── server/              # Express, Socket.IO, room store, game engine, timers, visibility
│   ├── game/
│   │   ├── engine.ts        # [NO CHANGE] Skill action logic already complete
│   │   └── visibility.ts    # [NO CHANGE] Private view generation unchanged
│   ├── realtime/
│   │   └── event-handlers.ts # [NO CHANGE] Existing event handlers accept same payloads
│   └── ...
├── client/
│   ├── state.ts             # [MODIFY] Add card selection state tracking (seer/troublemaker)
│   ├── views/
│   │   ├── game.ts          # [MODIFY] Replace button-based action panels with click handlers; add card click event delegation; render selection state UI
│   │   └── util.ts          # [MODIFY] Add click prompt text helpers, card clickable state helpers
│   └── styles/
│       └── main.css         # [MODIFY] Add clickable card hover effects, selected state styling
└── shared/
    ├── types.ts             # [NO CHANGE] Contract types already support current payloads
    └── contracts.ts         # [NO CHANGE] Zod schemas already validate all action payloads

tests/
├── unit/
│   └── game-view.test.ts    # [MODIFY] Add card click rendering tests
├── integration/
│   └── socket-flow.test.ts  # [MODIFY] Add card click event flow tests
└── e2e/
    └── three-player-game.spec.ts  # [MODIFY] Add card click interaction e2e tests
```

**Structure Decision**: Zero new files; all changes confined to client-side rendering (`game.ts`, `util.ts`, `state.ts`, `main.css`) and test files. Server code requires no modifications. The Socket.IO event names and payload schemas remain exactly as they are.

## Complexity Tracking

> No violations — this section intentionally left empty.
