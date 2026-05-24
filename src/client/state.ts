import { io, type Socket } from 'socket.io-client';
import type { ChatMessage, CreateRoomResponse, JoinRoomResponse, PrivateRoomView, PublicRoomView, ReconnectResponse, SettlementView } from '../shared/types.js';
import type { ErrorCode } from '../shared/errors.js';

export interface ClientStateSnapshot {
  publicView: PublicRoomView | null;
  privateView: PrivateRoomView | null;
  settlement: SettlementView | null;
  chatMessages: ChatMessage[];
  error: string | null;
  currentRoomCode: string | null;
  currentSeatIndex: number | null;
  connected: boolean;
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
    connected: false
  };

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ClientStateSnapshot {
    return this.snapshot;
  }

  async createRoom(nickname: string): Promise<void> {
    const response = await postJson<CreateRoomResponse>('/api/rooms', { nickname });
    this.persistSeat(response.roomCode, response.reconnectToken, response.seatIndex);
    await this.connect(response.roomCode, response.reconnectToken);
  }

  async joinRoom(roomCode: string, nickname: string): Promise<void> {
    const response = await postJson<JoinRoomResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/join`, { nickname });
    this.persistSeat(response.roomCode, response.reconnectToken, response.seatIndex);
    await this.connect(response.roomCode, response.reconnectToken);
  }

  async reconnect(roomCode: string): Promise<void> {
    const token = this.getReconnectToken(roomCode);
    if (!token) throw new Error('没有找到该房间的本地重连令牌。');
    const response = await postJson<ReconnectResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/reconnect`, { reconnectToken: token });
    this.persistSeat(response.roomCode, token, response.seatIndex);
    await this.connect(response.roomCode, token);
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

  clearError(): void {
    this.snapshot.error = null;
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
      error: null
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
      this.snapshot.publicView = view;
      this.snapshot.currentRoomCode = view.roomCode;
      this.emitChange();
    });

    this.socket.on('state:private', (view: PrivateRoomView) => {
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
