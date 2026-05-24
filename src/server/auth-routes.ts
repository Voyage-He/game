import { Router, type Request, type Response, type NextFunction } from 'express';
import { AuthStore, AuthError } from './auth-store.js';

export interface AuthRequest extends Request {
  authUser?: { username: string };
}

export function createAuthRouter(authStore: AuthStore): Router {
  const router = Router();

  /* ── 注册 ── */
  router.post('/auth/register', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username, password, inviteCode } = req.body;
      if (!username || !password || !inviteCode) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '需要提供用户名、密码和邀请码。' } });
        return;
      }
      const token = await authStore.register(String(username), String(password), String(inviteCode));
      const user = authStore.getSessionUser(token)!;
      res.status(201).json({ token, user: { username: user.username } });
    } catch (error) {
      next(error);
    }
  });

  /* ── 登陆 ── */
  router.post('/auth/login', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '需要提供用户名和密码。' } });
        return;
      }
      const token = await authStore.login(String(username), String(password));
      const user = authStore.getSessionUser(token)!;
      res.json({ token, user: { username: user.username } });
    } catch (error) {
      next(error);
    }
  });

  /* ── 获取当前用户 ── */
  router.get('/auth/me', (req: AuthRequest, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '未登录。' } });
      return;
    }
    const user = authStore.getSessionUser(token);
    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '会话已失效，请重新登录。' } });
      return;
    }
    res.json({ user: { username: user.username } });
  });

  /* ── 登出 ── */
  router.post('/auth/logout', (req: AuthRequest, res: Response) => {
    const token = extractToken(req);
    if (token) authStore.destroySession(token);
    res.json({ ok: true });
  });

  /* ── 生成邀请码（需要已登录） ── */
  router.post('/admin/invite-codes', (req: AuthRequest, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '未登录。' } });
      return;
    }
    const user = authStore.getSessionUser(token);
    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '会话已失效。' } });
      return;
    }
    const record = authStore.generateInviteCode(user.username);
    res.status(201).json({ code: record.code });
  });

  /* ── 邀请码列表（需要已登录） ── */
  router.get('/admin/invite-codes', (req: AuthRequest, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '未登录。' } });
      return;
    }
    const user = authStore.getSessionUser(token);
    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '会话已失效。' } });
      return;
    }
    const codes = authStore.getInviteCodes();
    res.json({ inviteCodes: codes.map((c) => ({
      code: c.code,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      usedBy: c.usedBy,
      usedAt: c.usedAt
    })) });
  });

  /* ── 错误处理 ── */
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AuthError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.message } });
      return;
    }
    res.status(500).json({ error: { code: 'VALIDATION_ERROR', message: '服务器内部错误。' } });
  });

  return router;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}
