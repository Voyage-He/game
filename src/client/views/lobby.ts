import type { ClientStateSnapshot } from '../state.js';
import type { PlayerPublicView } from '../../shared/types.js';
import { escapeHtml } from './util.js';

const REQUIRED_PLAYERS = 3;

type LobbyPlayer = PlayerPublicView;

export function renderLobby(snapshot: ClientStateSnapshot): string {
  const roomCode = snapshot.publicView?.roomCode ?? snapshot.currentRoomCode ?? '';
  const players = snapshot.publicView?.players ?? [];
  const ownSeatIndex = snapshot.privateView?.seatIndex ?? snapshot.currentSeatIndex ?? null;
  const ownPlayer = ownSeatIndex === null ? undefined : players.find((player) => player.seatIndex === ownSeatIndex);
  const isOwner = Boolean(ownPlayer?.isOwner);
  const canStart = canStartGame(snapshot.publicView?.status, isOwner, players);

  const inRoom = Boolean(snapshot.publicView);
  const loggedInUsername = snapshot.authUser?.username ?? '';
  return `
    <section class="panel lobby-panel" aria-labelledby="lobby-title">
      <h1 id="lobby-title">🃏 在线房间游戏</h1>
      <p class="muted">三人邀请制房间。使用昵称和房间码开始一局临时游戏。</p>
      ${snapshot.error ? `<p role="alert" class="error">${escapeHtml(snapshot.error)}</p>` : ''}
      ${inRoom ? '' : `
      <div class="forms">
        <form id="create-form" class="card-form">
          <h2>创建房间</h2>
          <label>昵称 <input name="nickname" required maxlength="20" autocomplete="nickname" value="${escapeHtml(loggedInUsername)}" /></label>
          <button type="submit">创建房间</button>
        </form>
        <form id="join-form" class="card-form">
          <h2>加入房间</h2>
          <label>房间码 <input name="roomCode" required maxlength="12" autocapitalize="characters" /></label>
          <label>昵称 <input name="nickname" required maxlength="20" autocomplete="nickname" value="${escapeHtml(loggedInUsername)}" /></label>
          <button type="submit">加入房间</button>
        </form>
        <form id="reconnect-form" class="card-form">
          <h2>重连席位</h2>
          <label>房间码 <input name="roomCode" required maxlength="12" autocapitalize="characters" value="${escapeHtml(roomCode)}" /></label>
          <button type="submit">重连</button>
        </form>
      </div>
      `}
      ${roomCode ? renderWaitingRoomCard(roomCode, players, ownSeatIndex, isOwner, canStart, inRoom) : ''}
    </section>
  `;
}

function renderWaitingRoomCard(roomCode: string, players: LobbyPlayer[], ownSeatIndex: number | null, isOwner: boolean, canStart: boolean, inRoom: boolean): string {
  const connectedCount = players.filter((player) => player.connectionStatus === 'connected').length;
  const startHint = getStartHint(players, isOwner, canStart, inRoom);
  return `<section class="room-card waiting-room-card" aria-labelledby="waiting-room-title">
    <div class="room-card-header">
      <h2 id="waiting-room-title">房间码 <strong class="room-code">${escapeHtml(roomCode)}</strong></h2>
      <p class="player-count" aria-live="polite">当前人员 <strong>${players.length}/${REQUIRED_PLAYERS}</strong><span class="muted"> · 在线 ${connectedCount}/${REQUIRED_PLAYERS}</span></p>
    </div>
    <p id="start-game-hint" class="start-hint${canStart ? ' ready' : ''}">${escapeHtml(startHint)}</p>
    ${renderPlayers(players, ownSeatIndex)}
    <div class="start-actions">
      ${renderStartControl(isOwner, canStart, inRoom)}
      ${inRoom ? '<button id="leave-room">退出房间</button>' : ''}
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

function renderStartControl(isOwner: boolean, canStart: boolean, inRoom: boolean): string {
  if (!inRoom) return '<p class="muted owner-wait">正在同步开始条件。</p>';
  if (!isOwner) return '<p class="muted owner-wait">等待房主开始游戏。</p>';
  return `<button id="start-game" aria-describedby="start-game-hint" ${canStart ? '' : 'disabled'}>房主开始游戏</button>`;
}

function canStartGame(status: string | undefined, isOwner: boolean, players: LobbyPlayer[]): boolean {
  return Boolean(isOwner && status === 'waiting' && players.length === REQUIRED_PLAYERS && players.every((player) => player.connectionStatus === 'connected'));
}

function getStartHint(players: LobbyPlayer[], isOwner: boolean, canStart: boolean, inRoom: boolean): string {
  if (!inRoom) return '正在同步房间人员信息，请稍候。';
  if (players.length < REQUIRED_PLAYERS) return `还需 ${REQUIRED_PLAYERS - players.length} 人加入后才能开始。`;
  if (players.some((player) => player.connectionStatus !== 'connected')) return '需要所有成员在线后才能开始。';
  if (canStart) return '三名玩家已在线，房主可以开始游戏。';
  if (!isOwner) return '三名玩家已在线，等待房主开始游戏。';
  return '暂时无法开始游戏，请稍后重试。';
}
