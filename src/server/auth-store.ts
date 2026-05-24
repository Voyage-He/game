import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SALT_LENGTH = 16;
const HASH_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export interface UserRecord {
  username: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface InviteCodeRecord {
  code: string;
  createdBy: string;
  createdAt: string;
  usedBy: string | null;
  usedAt: string | null;
}

export class AuthStore {
  private dataDir: string;
  private usersPath: string;
  private inviteCodesPath: string;
  private users = new Map<string, UserRecord>();
  private inviteCodes = new Map<string, InviteCodeRecord>();
  private sessions = new Map<string, string>(); // token → username

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
    this.usersPath = path.join(this.dataDir, 'users.json');
    this.inviteCodesPath = path.join(this.dataDir, 'invite_codes.json');
    this.ensureDataDir();
    this.loadUsers();
    this.loadInviteCodes();
    this.seedInitialInviteCode();
  }

  /* ── 密码哈希 ── */

  private hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    return new Promise<string>((resolve, reject) => {
      crypto.scrypt(password, salt, HASH_LENGTH, SCRYPT_PARAMS, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  private verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      crypto.scrypt(password, salt, HASH_LENGTH, SCRYPT_PARAMS, (err, derivedKey) => {
        if (err) resolve(false);
        else resolve(crypto.timingSafeEqual(Buffer.from(derivedKey), Buffer.from(key, 'hex')));
      });
    });
  }

  /* ── 注册 ── */

  async register(username: string, password: string, inviteCode: string): Promise<string> {
    const normalized = normalizeUsername(username);
    if (!normalized || normalized.length < 1 || normalized.length > 20) {
      throw new AuthError('用户名长度必须在 1-20 个字符之间。');
    }
    if (!password || password.length < 4) {
      throw new AuthError('密码长度不能少于 4 个字符。');
    }
    if (this.users.has(normalized)) {
      throw new AuthError('用户名已被注册。');
    }
    const code = this.inviteCodes.get(inviteCode.trim());
    if (!code) {
      throw new AuthError('邀请码无效。');
    }
    if (code.usedBy !== null) {
      throw new AuthError('邀请码已被使用。');
    }
    const passwordHash = await this.hashPassword(password);
    const now = new Date().toISOString();
    this.users.set(normalized, {
      username: normalized,
      passwordHash,
      createdAt: now,
      lastLoginAt: now
    });
    this.persistUsers();
    code.usedBy = normalized;
    code.usedAt = now;
    this.persistInviteCodes();
    return this.createSession(normalized);
  }

  /* ── 登陆 ── */

  async login(username: string, password: string): Promise<string> {
    const normalized = normalizeUsername(username);
    const user = this.users.get(normalized);
    if (!user) {
      throw new AuthError('用户名或密码错误。');
    }
    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new AuthError('用户名或密码错误。');
    }
    user.lastLoginAt = new Date().toISOString();
    this.persistUsers();
    return this.createSession(normalized);
  }

  /* ── 会话 ── */

  getSessionUser(token: string): UserRecord | null {
    const username = this.sessions.get(token);
    if (!username) return null;
    return this.users.get(username) ?? null;
  }

  destroySession(token: string): void {
    this.sessions.delete(token);
  }

  /* ── 邀请码管理 ── */

  generateInviteCode(createdBy: string): InviteCodeRecord {
    const code = generateCode();
    const now = new Date().toISOString();
    const record: InviteCodeRecord = {
      code,
      createdBy,
      createdAt: now,
      usedBy: null,
      usedAt: null
    };
    this.inviteCodes.set(code, record);
    this.persistInviteCodes();
    return record;
  }

  getInviteCodes(): InviteCodeRecord[] {
    return [...this.inviteCodes.values()];
  }

  /** 是否有任何已注册用户？ */
  hasUsers(): boolean {
    return this.users.size > 0;
  }

  /** 获取还未被使用的初始邀请码（来自环境变量 INVITE_CODE） */
  getInitialInviteCode(): string | null {
    const code = process.env.INVITE_CODE;
    if (!code) return null;
    const record = this.inviteCodes.get(code);
    if (!record) return null;
    if (record.usedBy !== null) return null; // 已被使用
    return code;
  }

  /* ── 内部 ── */

  private createSession(username: string): string {
    const token = crypto.randomUUID();
    this.sessions.set(token, username);
    return token;
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadUsers(): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.usersPath, 'utf-8')) as UserRecord[];
      for (const user of data) this.users.set(user.username, user);
    } catch { /* 文件不存在或格式错误，视为空 */ }
  }

  private loadInviteCodes(): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.inviteCodesPath, 'utf-8')) as InviteCodeRecord[];
      for (const code of data) this.inviteCodes.set(code.code, code);
    } catch { /* 同上 */ }
  }

  private persistUsers(): void {
    fs.writeFileSync(this.usersPath, JSON.stringify([...this.users.values()], null, 2), 'utf-8');
  }

  private persistInviteCodes(): void {
    fs.writeFileSync(this.inviteCodesPath, JSON.stringify([...this.inviteCodes.values()], null, 2), 'utf-8');
  }

  private seedInitialInviteCode(): void {
    const code = process.env.INVITE_CODE;
    if (!code) return;
    if (this.inviteCodes.has(code)) return;
    const now = new Date().toISOString();
    this.inviteCodes.set(code, { code, createdBy: 'system', createdAt: now, usedBy: null, usedAt: null });
    this.persistInviteCodes();
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 无 I/O/0/1 便于口述
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
