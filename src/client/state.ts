import { io, type Socket } from 'socket.io-client';
import type { ChatMessage, CountdownDisplaySnapshot, CreateRoomResponse, JoinRoomResponse, LobbyRoomEntry, PrivateRoomView, PublicRoomView, SettlementView } from '../shared/types.js';
import type { ErrorCode } from '../shared/errors.js';

export interface SelectionState {
  actionSubmitted: boolean;
  wolfSelectedUnderwater: number | null;
  seerActionMode: 'idle' | 'underwater' | 'player';
  seerUnderwaterClicked: number[];
  seerPlayerSelected: number | null;
  robberSelectedSeat: number | null;
  troublemakerSelected: number[];
  waterGhostSelectedUnderwater: number | null;
}

export function createInitialSelectionState(): SelectionState {
  return {
    actionSubmitted: false,
    wolfSelectedUnderwater: null,
    seerActionMode: 'idle',
    seerUnderwaterClicked: [],
    seerPlayerSelected: null,
    robberSelectedSeat: null,
    troublemakerSelected: [],
    waterGhostSelectedUnderwater: null
  };
}

export interface ClientStateSnapshot {
  publicView: PublicRoomView | null;
  privateView: PrivateRoomView | null;
  settlement: SettlementView | null;
  chatMessages: ChatMessage[];
  error: string | null;
  currentRoomCode: string | null;
  currentSeatIndex: number | null;
  connected: boolean;
  serverClockOffsetMs: number;
  animatedCardKeys: Set<string>;
  selectionState: SelectionState;
  authUser: { username: string; isAdmin: boolean } | null;
  authToken: string | null;
  showAuthPage: boolean;
  lobbyRooms: LobbyRoomEntry[];
}

export class ClientState {
  private socket: Socket | null = null;
  private listeners = new Set<() => void>();
  private snapshot: ClientStateSnapshot = {
    publicView: null,
    privateView: null,
    settlement: null,
    chatMessages: [],
    error: null,
    currentRoomCode: null,
    currentSeatIndex: null,
    connected: false,
    serverClockOffsetMs: 0,
    animatedCardKeys: new Set(),
    selectionState: createInitialSelectionState(),
    authUser: null,
    authToken: null,
    showAuthPage: true,
    lobbyRooms: []
  };

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ClientStateSnapshot {
    return this.snapshot;
  }

  getCountdownSnapshot(): CountdownDisplaySnapshot {
    return buildCountdownSnapshot(this.snapshot);
  }

  async createRoom(): Promise<void> {
    const token = this.snapshot.authToken;
    if (!token) throw new Error('请先登录。');
    const response = await authPostJson<CreateRoomResponse>('/api/rooms', token, {});
    this.persistSeat(response.roomCode, response.reconnectToken, response.seatIndex);
    await this.connect(response.roomCode, response.reconnectToken);
  }

  async joinRoom(roomCode: string): Promise<void> {
    const token = this.snapshot.authToken;
    if (!token) throw new Error('请先登录。');
    const response = await authPostJson<JoinRoomResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/join`, token, {});
    this.persistSeat(response.roomCode, response.reconnectToken, response.seatIndex);
    await this.connect(response.roomCode, response.reconnectToken);
  }

  async fetchLobbyRooms(): Promise<void> {
    const token = this.snapshot.authToken;
    if (!token) throw new Error('请先登录。');
    const response = await authGetJson<{ rooms: LobbyRoomEntry[] }>('/api/rooms/lobby', token);
    this.snapshot.lobbyRooms = response.rooms;
    this.emitChange();
  }

  startGame(): void {
    this.socket?.emit('room:start', {});
  }

  advanceToVote(): void {
    this.socket?.emit('phase:advance-to-vote', {});
  }

  sendChat(text: string): void {
    this.socket?.emit('chat:send', { text });
  }

  castVote(targetSeatIndex: number): void {
    this.socket?.emit('vote:cast', { targetSeatIndex });
  }

  sendRoleAction(eventName: string, payload: unknown): void {
    this.socket?.emit(eventName, payload);
  }

  leaveRoom(): void {
    this.socket?.emit('room:leave', {});
    if (this.snapshot.currentRoomCode) {
      this.cleanupToken(this.snapshot.currentRoomCode);
    }
    const { authUser, authToken, showAuthPage } = this.snapshot;
    this.snapshot = {
      publicView: null,
      privateView: null,
      settlement: null,
      chatMessages: [],
      error: null,
      currentRoomCode: null,
      currentSeatIndex: null,
      connected: false,
      serverClockOffsetMs: 0,
      animatedCardKeys: new Set(),
      selectionState: createInitialSelectionState(),
      authUser,
      authToken,
      showAuthPage,
      lobbyRooms: []
    };
    this.emitChange();
  }

  /* ── Auth ── */

  async authRegister(username: string, password: string, inviteCode: string): Promise<void> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, inviteCode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? '注册失败。');
    this.snapshot.authToken = data.token;
    this.snapshot.authUser = { username: data.user.username, isAdmin: data.user.isAdmin ?? false };
    this.snapshot.showAuthPage = false;
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    this.emitChange();
  }

  async authLogin(username: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? '登陆失败。');
    this.snapshot.authToken = data.token;
    this.snapshot.authUser = { username: data.user.username, isAdmin: data.user.isAdmin ?? false };
    this.snapshot.showAuthPage = false;
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    this.emitChange();
  }

  async authLogout(): Promise<void> {
    const token = this.snapshot.authToken;
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      }).catch(() => {});
    }
    this.snapshot.authToken = null;
    this.snapshot.authUser = null;
    this.snapshot.showAuthPage = true;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    this.emitChange();
  }

  async authRestoreSession(): Promise<void> {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      this.snapshot.showAuthPage = true;
      this.emitChange();
      return;
    }
    // 添加 token 到 snapshot 以便后续 fetch 携带
    this.snapshot.authToken = token;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        this.snapshot.authToken = null;
        this.snapshot.showAuthPage = true;
        this.emitChange();
        return;
      }
      const data = await res.json();
      this.snapshot.authUser = { username: data.user.username, isAdmin: data.user.isAdmin ?? false };
      this.snapshot.showAuthPage = false;
      this.emitChange();
    } catch {
      // 网络错误，静默处理（保留 token 稍后重试）
      this.snapshot.showAuthPage = false; // 不阻塞游戏
      this.emitChange();
    }
  }

  authShowPage(): void {
    this.snapshot.showAuthPage = true;
    this.emitChange();
  }

  authHidePage(): void {
    this.snapshot.showAuthPage = false;
    this.emitChange();
  }

  authGetToken(): string | null {
    return this.snapshot.authToken;
  }

  clearError(): void {
    if (this.snapshot.error !== null) {
      this.snapshot.error = null;
      this.emitChange();
    }
  }

  updateCardSelection(updates: Partial<SelectionState>): void {
    Object.assign(this.snapshot.selectionState, updates);
    this.emitChange();
  }

  cleanupToken(roomCode: string): void {
    localStorage.removeItem(tokenKey(roomCode));
    localStorage.removeItem(seatKey(roomCode));
  }

  getReconnectToken(roomCode: string): string | null {
    return localStorage.getItem(tokenKey(roomCode.trim().toUpperCase()));
  }

  private async connect(roomCode: string, reconnectToken: string): Promise<void> {
    if (this.socket) this.socket.disconnect();
    this.snapshot = {
      ...this.snapshot,
      currentRoomCode: roomCode,
      currentSeatIndex: Number(localStorage.getItem(seatKey(roomCode)) ?? 0),
      connected: false,
      error: null,
      serverClockOffsetMs: 0
    };
    this.emitChange();

    this.socket = io('/rooms', {
      auth: { roomCode, reconnectToken },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.snapshot.connected = true;
      this.emitChange();
    });

    this.socket.on('disconnect', () => {
      this.snapshot.connected = false;
      this.emitChange();
    });

    this.socket.on('connect_error', (error) => {
      this.snapshot.error = parseSocketError(error.message);
      this.snapshot.connected = false;
      this.emitChange();
    });

    this.socket.on('state:public', (view: PublicRoomView) => {
      const serverNowMs = Date.parse(view.serverNow);
      this.snapshot.publicView = view;
      this.snapshot.currentRoomCode = view.roomCode;
      if (Number.isFinite(serverNowMs)) {
        this.snapshot.serverClockOffsetMs = serverNowMs - Date.now();
      }
      this.emitChange();
    });

    this.socket.on('state:private', (view: PrivateRoomView) => {
      // Clear animation tracking when revealedCards become empty (phase change)
      if (view.revealedCards.length === 0) {
        this.snapshot.animatedCardKeys = new Set();
      }
      // Clear selection state when phase changes or action no longer eligible
      if (view.revealedCards.length === 0 || view.currentEligibleAction === null) {
        this.snapshot.selectionState = createInitialSelectionState();
      }
      this.snapshot.privateView = view;
      this.snapshot.currentSeatIndex = view.seatIndex;
      this.emitChange();
    });

    this.socket.on('settlement:shown', (view: SettlementView) => {
      this.snapshot.settlement = view;
      if (this.snapshot.currentRoomCode) this.cleanupToken(this.snapshot.currentRoomCode);
      this.emitChange();
    });

    this.socket.on('chat:message', (message: ChatMessage) => {
      this.snapshot.chatMessages = [...this.snapshot.chatMessages.slice(-49), message];
      this.emitChange();
    });

    this.socket.on('action:result', () => {
      this.emitChange();
    });

    this.socket.on('error', (error: { code: ErrorCode; message: string }) => {
      this.snapshot.error = error.message;
      // Reset submitted state so the player can retry after an action error
      this.snapshot.selectionState.actionSubmitted = false;
      this.emitChange();
    });
  }

  private persistSeat(roomCode: string, reconnectToken: string, seatIndex: number): void {
    const normalized = roomCode.trim().toUpperCase();
    localStorage.setItem(tokenKey(normalized), reconnectToken);
    localStorage.setItem(seatKey(normalized), String(seatIndex));
  }

  private emitChange(): void {
    for (const listener of this.listeners) listener();
  }
}

export const clientState = new ClientState();

export function isTimedPhaseView(view: PublicRoomView | null | undefined): boolean {
  return Boolean(view?.phaseEndsAt && view.phase !== 'free_speech' && view.phase !== 'settlement');
}

export function remainingSecondsForDeadline(phaseEndsAt: string | undefined, serverClockOffsetMs: number, nowMs = Date.now()): number | null {
  if (!phaseEndsAt) return null;
  const deadlineMs = Date.parse(phaseEndsAt);
  if (!Number.isFinite(deadlineMs)) return null;
  const estimatedServerNow = nowMs + serverClockOffsetMs;
  return Math.max(0, Math.ceil((deadlineMs - estimatedServerNow) / 1000));
}

export function buildCountdownSnapshot(snapshot: ClientStateSnapshot): CountdownDisplaySnapshot {
  const view = snapshot.publicView;
  if (!view || !isTimedPhaseView(view)) {
    return { phase: view?.phase, phaseEndsAt: view?.phaseEndsAt, serverNow: view?.serverNow, isTimed: false, remainingSeconds: null };
  }
  return {
    phase: view.phase,
    phaseEndsAt: view.phaseEndsAt,
    serverNow: view.serverNow,
    isTimed: true,
    remainingSeconds: remainingSecondsForDeadline(view.phaseEndsAt, snapshot.serverClockOffsetMs)
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message ?? '请求失败，请重试。';
    throw new Error(message);
  }
  return data as T;
}

async function authPostJson<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message ?? '请求失败，请重试。';
    throw new Error(message);
  }
  return data as T;
}

async function authGetJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message ?? '请求失败，请重试。';
    throw new Error(message);
  }
  return data as T;
}

function tokenKey(roomCode: string): string {
  return `online-room-game:${roomCode}:reconnectToken`;
}

function seatKey(roomCode: string): string {
  return `online-room-game:${roomCode}:seatIndex`;
}

function parseSocketError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    return parsed.message ?? raw;
  } catch {
    return raw;
  }
}

const AUTH_TOKEN_KEY = 'online-room-game:authToken';
