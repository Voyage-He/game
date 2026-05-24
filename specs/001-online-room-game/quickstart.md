# Quickstart: 在线房间游戏

## Prerequisites

- Node.js 20+ LTS-compatible runtime
- npm
- A browser with modern WebSocket support

## Local Development

```bash
npm install
npm run dev
```

Expected local services:

- HTTP app: `http://localhost:3000`
- Socket.IO namespace: `/rooms`

## Environment Variables

```bash
PORT=3000
PUBLIC_ORIGIN=http://localhost:3000
ROOM_IDLE_TTL_MS=1800000
```

Notes:
- `PUBLIC_ORIGIN` should use HTTPS in public self-hosted deployments.
- Room data is in-memory and is deleted after settlement or all players leaving.

## Manual Smoke Flow

1. Open three browser windows or profiles.
2. In the first window, enter a nickname and create a room.
3. Copy the room code into the other two windows and join with unique nicknames.
4. Start the game from the owner window.
5. Complete or skip role actions according to the assigned identities.
6. Use free-speech text chat, then let the owner advance to voting.
7. Cast one vote from each player and review settlement results.
8. Refresh one player window during a game and verify the same browser reclaims the original seat through the stored reconnect token.

## Test Commands

```bash
npm run test          # Vitest unit + integration tests
npm run test:e2e      # Playwright three-browser flows
npm run build         # Type-check and build server/client assets
npm start             # Run built self-hosted service
```

Verified on 2026-05-22:

```bash
npm run build
npm test
npm run test:e2e
```

If Playwright browsers are not installed locally, run `npx playwright install chromium` once before `npm run test:e2e`.

## Deployment Notes

- Run as a single Node.js process serving the API, Socket.IO, and built frontend assets.
- Place behind an HTTPS reverse proxy for public-internet access so reconnect tokens and private role events are encrypted in transit.
- Do not configure persistent database storage for first version room/game history.
- If process restarts, active in-memory rooms are lost; this is acceptable for the first version because rooms are temporary and no history is retained.
