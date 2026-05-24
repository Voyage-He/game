import { createServer } from 'node:http';
import { createApp } from './app.js';
import { configureSocketServer } from './realtime/socket-server.js';
import { RoomStore } from './room-store.js';

const port = Number(process.env.PORT ?? 3000);
const store = new RoomStore();
const app = createApp({ roomStore: store });
const server = createServer(app);
configureSocketServer(server, store);

server.listen(port, () => {
  console.log(`在线房间游戏服务已启动: http://localhost:${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
