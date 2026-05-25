import type { ClientStateSnapshot } from '../state.js';
import type { LobbyRoomEntry, PlayerPublicView } from '../../shared/types.js';
import { escapeHtml } from './util.js';

const REQUIRED_PLAYERS = 3;

type LobbyPlayer = PlayerPublicView;

export function renderLobby(snapshot: ClientStateSnapshot): string {
  const inRoom = Boolean(snapshot.publicView);
  const inWaitingRoom = snapshot.publicView?.status === 'waiting';
  const loggedInUsername = snapshot.authUser?.username ?? '';

  const waitingRoomCard = inWaitingRoom ? renderWaitingRoomCard(snapshot) : '';

  return `
    <section class="panel lobby-panel" aria-labelledby="lobby-title">
      <h1 id="lobby-title">🃏 房间大厅</h1>
      ${inRoom ? '' : `<p class="muted">你好，<strong>${escapeHtml(loggedInUsername)}</strong>。选择一个房间加入，或创建新房间。</p>`}
      ${snapshot.error ? `<p role="alert" class="error">${escapeHtml(snapshot.error)}</p>` : ''}
      ${inRoom ? '' : renderLobbyList(snapshot.lobbyRooms)}
      ${waitingRoomCard}
    </section>
  `;
}

function renderLobbyList(rooms: LobbyRoomEntry[]): string {
  const emptyState = rooms.length === 0
    ? `<li class="room-list-empty">
        <div class="empty-icon">🎴</div>
        <p>当前没有可加入的房间</p>
        <p class="muted">点击「创建房间」开始一局游戏吧</p>
      </li>`
    : '';

  return `
    <div class="lobby-controls">
      <button id="lobby-create-room" class="btn-primary">＋ 创建房间</button>
      <button id="lobby-refresh" class="btn-outline">🔄 刷新列表</button>
    </div>
    <ul class="room-list" aria-label="可加入的房间列表">
      ${emptyState}
      ${rooms.map((room) => renderRoomListItem(room)).join('')}
    </ul>
  `;
}

function renderRoomListItem(room: LobbyRoomEntry): string {
  const owner = room.players.find((p: PlayerPublicView) => p.isOwner);
  const ownerName = owner ? escapeHtml(owner.nickname) : '未知';
  const roomName = `${ownerName} 的房间`;
  const otherPlayers = room.players.filter((p: PlayerPublicView) => !p.isOwner);
  const seatsRemaining = room.maxPlayers - room.playerCount;
  const timeAgo = formatTimeAgo(room.createdAt);

  return `
    <li class="room-card-item" data-room-code="${escapeHtml(room.roomCode)}" role="button" tabindex="0">
      <div class="room-card-left">
        <div class="room-card-icon">🏠</div>
        <div class="room-card-info">
          <div class="room-card-name">${roomName}</div>
          <div class="room-card-meta">
            <span class="room-number" title="房间号：${escapeHtml(room.roomCode)}">#${escapeHtml(room.roomCode)}</span>
            <span class="room-time">${timeAgo}</span>
          </div>
        </div>
      </div>
      <div class="room-card-center">
        ${renderRoomPlayers(owner, otherPlayers)}
      </div>
      <div class="room-card-right">
        <span class="room-seats-badge ${seatsRemaining === 0 ? 'full' : 'open'}">
          ${room.playerCount}/${room.maxPlayers}
        </span>
        <span class="room-join-hint">点击加入 →</span>
      </div>
    </li>
  `;
}

function renderRoomPlayers(owner: PlayerPublicView | undefined, others: PlayerPublicView[]): string {
  const parts: string[] = [];
  if (owner) {
    parts.push(`<span class="room-player-tag owner">👑 ${escapeHtml(owner.nickname)}</span>`);
  }
  for (const p of others) {
    parts.push(`<span class="room-player-tag">${escapeHtml(p.nickname)}</span>`);
  }
  const emptySlots = 3 - parts.length;
  for (let i = 0; i < emptySlots; i++) {
    parts.push(`<span class="room-player-tag empty">空位</span>`);
  }
  return parts.join('');
}

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function renderWaitingRoomCard(snapshot: ClientStateSnapshot): string {
  const players = snapshot.publicView?.players ?? [];
  const ownSeatIndex = snapshot.privateView?.seatIndex ?? snapshot.currentSeatIndex ?? null;
  const ownPlayer = ownSeatIndex === null ? undefined : players.find((player) => player.seatIndex === ownSeatIndex);
  const isOwner = Boolean(ownPlayer?.isOwner);
  const canStart = canStartGame(snapshot.publicView?.status, isOwner, players);

  return renderWaitingRoomCardInner(players, ownSeatIndex, isOwner, canStart);
}

function renderWaitingRoomCardInner(players: LobbyPlayer[], ownSeatIndex: number | null, isOwner: boolean, canStart: boolean): string {
  const connectedCount = players.filter((player) => player.connectionStatus === 'connected').length;
  const startHint = getStartHint(players, isOwner, canStart);
  return `<section class="room-card waiting-room-card" aria-labelledby="waiting-room-title">
    <div class="room-card-header">
      <h2 id="waiting-room-title">等待开局</h2>
      <p class="player-count" aria-live="polite">当前人员 <strong>${players.length}/${REQUIRED_PLAYERS}</strong><span class="muted"> · 在线 ${connectedCount}/${REQUIRED_PLAYERS}</span></p>
    </div>
    <p id="start-game-hint" class="start-hint${canStart ? ' ready' : ''}">${escapeHtml(startHint)}</p>
    ${renderPlayers(players, ownSeatIndex)}
    <div class="start-actions">
      ${renderStartControl(isOwner, canStart)}
      <button id="leave-room">退出房间</button>
    </div>
  </section>`;
}

function renderPlayers(players: LobbyPlayer[], ownSeatIndex: number | null): string {
  if (players.length === 0) return '<p class="muted">正在同步房间人员信息…</p>';
  const playersBySeat = new Map(players.map((player) => [player.seatIndex, player]));
  return `<ul class="players waiting-players" aria-label="当前人员信息">${[0, 1, 2]
    .map((seatIndex) => {
      const player = playersBySeat.get(seatIndex);
      if (!player) return `<li class="empty"><span class="seat-label">席位 ${seatIndex + 1}</span><span class="muted">等待加入</span></li>`;
      const isSelf = player.seatIndex === ownSeatIndex;
      const isDisconnected = player.connectionStatus === 'disconnected';
      return `<li class="${isSelf ? 'self ' : ''}${isDisconnected ? 'disconnected' : ''}" data-seat-index="${player.seatIndex}">
        <span class="seat-label">席位 ${player.seatIndex + 1}</span>
        <strong>${escapeHtml(player.nickname)}</strong>
        <span class="player-badges">
          ${player.isOwner ? '<span class="badge">房主</span>' : ''}
          ${isSelf ? '<span class="badge self-badge">你</span>' : ''}
        </span>
        <span class="status ${player.connectionStatus}">${player.connectionStatus === 'connected' ? '在线' : '离线'}</span>
      </li>`;
    })
    .join('')}</ul>`;
}

function renderStartControl(isOwner: boolean, canStart: boolean): string {
  if (!isOwner) return '<p class="muted owner-wait">等待房主开始游戏。</p>';
  return `<button id="start-game" aria-describedby="start-game-hint" ${canStart ? '' : 'disabled'}>房主开始游戏</button>`;
}

function canStartGame(status: string | undefined, isOwner: boolean, players: LobbyPlayer[]): boolean {
  return Boolean(isOwner && status === 'waiting' && players.length === REQUIRED_PLAYERS && players.every((player) => player.connectionStatus === 'connected'));
}

function getStartHint(players: LobbyPlayer[], isOwner: boolean, canStart: boolean): string {
  if (players.length < REQUIRED_PLAYERS) return `还需 ${REQUIRED_PLAYERS - players.length} 人加入后才能开始。`;
  if (players.some((player) => player.connectionStatus !== 'connected')) return '需要所有成员在线后才能开始。';
  if (canStart) return '三名玩家已在线，房主可以开始游戏。';
  if (!isOwner) return '三名玩家已在线，等待房主开始游戏。';
  return '暂时无法开始游戏，请稍后重试。';
}
