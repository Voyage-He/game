# Contracts: 精简界面无意义UI、减少纵向内容展

**Feature**: 008-reduce-ui-clutter | **Date**: 2026-05-24

## No Contract Changes

This feature involves zero changes to:

- Socket.IO event names or payload schemas (`src/shared/contracts.ts`)
- Shared TypeScript types (`src/shared/types.ts`)
- Client-server protocol
- API endpoints (Express routes)
- Data exchange formats

All changes are confined to client-side presentation (CSS + HTML template). The server has zero awareness of these UI changes.

### Verification

- `src/shared/contracts.ts` — unchanged
- `src/shared/types.ts` — unchanged
- `src/server/` — all files unchanged
- Socket.IO `state:public` / `state:private` events — payload format unchanged
