import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { CreateRoomRequestSchema, JoinRoomRequestSchema, ReconnectRoomRequestSchema } from '../shared/contracts.js';
import { GameError, toErrorPayload } from '../shared/errors.js';
import { RoomStore } from './room-store.js';
import { AuthStore } from './auth-store.js';
import { createAuthRouter } from './auth-routes.js';

export interface AppOptions {
  roomStore?: RoomStore;
  authStore?: AuthStore;
  publicOrigin?: string;
  staticDir?: string;
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  const roomStore = options.roomStore ?? new RoomStore();
  const authStore = options.authStore ?? new AuthStore();
  app.locals.roomStore = roomStore;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use(originGuard(options.publicOrigin ?? process.env.PUBLIC_ORIGIN));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Auth routes
  app.use('/api', createAuthRouter(authStore));

  app.post('/api/rooms', (req, res, next) => {
    try {
      const body = CreateRoomRequestSchema.parse(req.body);
      const result = roomStore.createRoom(body.nickname);
      res.status(201).json(result);
    } catch (error) {
      next(normalizeZodError(error));
    }
  });

  app.post('/api/rooms/:roomCode/join', (req, res, next) => {
    try {
      const body = JoinRoomRequestSchema.parse(req.body);
      const result = roomStore.joinRoom(req.params.roomCode, body.nickname);
      res.status(201).json(result);
    } catch (error) {
      next(normalizeZodError(error));
    }
  });

  app.post('/api/rooms/:roomCode/reconnect', (req, res, next) => {
    try {
      const body = ReconnectRoomRequestSchema.parse(req.body);
      const result = roomStore.reconnectRoom(req.params.roomCode, body.reconnectToken);
      res.status(200).json(result);
    } catch (error) {
      next(normalizeZodError(error));
    }
  });

  const staticDir = options.staticDir ?? defaultStaticDir();
  app.use(express.static(staticDir));
  app.get('*', (_req, res, next) => {
    const indexFile = path.join(staticDir, 'index.html');
    res.sendFile(indexFile, (error) => {
      if (error) next();
    });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof GameError ? error.status : 400;
    res.status(status).json(toErrorPayload(error));
  });

  return app;
}

function originGuard(publicOrigin?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (publicOrigin && origin) {
      const allowed = new URL(publicOrigin).origin;
      if (origin !== allowed && process.env.NODE_ENV === 'production') {
        res.status(403).json({ error: { code: 'VALIDATION_ERROR', message: '访问来源不被允许。' } });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin === allowed ? origin : allowed);
    } else if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  };
}

function normalizeZodError(error: unknown): unknown {
  if (error instanceof ZodError) return new GameError('VALIDATION_ERROR');
  return error;
}

function defaultStaticDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const builtClientDir = path.resolve(currentDir, '../client');
  if (currentDir.includes(`${path.sep}dist${path.sep}`)) return builtClientDir;
  return path.resolve(process.cwd(), 'dist/client');
}
