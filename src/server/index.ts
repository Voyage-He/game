import { createServer } from 'node:http';
import { createApp } from './app.js';
import { configureSocketServer } from './realtime/socket-server.js';
import { RoomStore } from './room-store.js';
import { AuthStore } from './auth-store.js';

const port = Number(process.env.PORT ?? 3000);
const roomStore = new RoomStore();
const authStore = new AuthStore();
const app = createApp({ roomStore, authStore });
const server = createServer(app);
configureSocketServer(server, roomStore);

server.listen(port, () => {
  console.log(`\n🃏 在线房间游戏服务已启动: http://localhost:${port}`);

  const initialCode = authStore.getInitialInviteCode();
  if (initialCode) {
    console.log(`\n📋 初始邀请码: ${initialCode}`);
    console.log('   打开浏览器 → 注册新账号 → 输入此邀请码完成首次注册。');
    console.log('   注册后可使用「邀请码管理」功能生成更多邀请码分发给团队成员。');
  } else if (!authStore.hasUsers()) {
    console.log('\n⚠️  当前无用户且未设置 INVITE_CODE 环境变量。');
    console.log('   请设置环境变量后重启：INVITE_CODE=ABC12345 npm run dev');
    console.log('   或直接在 data/invite_codes.json 中添加一个邀请码记录。');
  } else {
    console.log(`\n已有 ${authStore.getInviteCodes().length} 个邀请码、${authStore.hasUsers() ? '有' : '无'}注册用户。`);
  }
  console.log('');
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
