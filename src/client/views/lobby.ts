import type { ClientStateSnapshot } from '../state.js';
import { escapeHtml } from './util.js';

export function renderLobby(snapshot: ClientStateSnapshot): string {
  const roomCode = snapshot.publicView?.roomCode ?? snapshot.currentRoomCode ?? '';
  const players = snapshot.publicView?.players ?? [];
  const isOwner = snapshot.privateView?.seatIndex !== undefined && players.find((player) => player.seatIndex === snapshot.privateView?.seatIndex)?.isOwner;
  const canStart = Boolean(isOwner && snapshot.publicView?.status === 'waiting' && players.length === 3 && players.every((player) => player.connectionStatus === 'connected'));

  return `
    <section class="panel lobby-panel" aria-labelledby="lobby-title">
      <h1 id="lobby-title">🃏 在线房间游戏</h1>
      <p class="muted">三人邀请制房间。使用昵称和房间码开始一局临时游戏。</p>
      ${snapshot.error ? `<p role="alert" class="error">${escapeHtml(snapshot.error)}</p>` : ''}
      <div class="forms">
        <form id="create-form" class="card-form">
          <h2>创建房间</h2>
          <label>昵称 <input name="nickname" required maxlength="20" autocomplete="nickname" /></label>
          <button type="submit">创建房间</button>
        </form>
        <form id="join-form" class="card-form">
          <h2>加入房间</h2>
          <label>房间码 <input name="roomCode" required maxlength="12" autocapitalize="characters" /></label>
          <label>昵称 <input name="nickname" required maxlength="20" autocomplete="nickname" /></label>
          <button type="submit">加入房间</button>
        </form>
        <form id="reconnect-form" class="card-form">
          <h2>重连席位</h2>
          <label>房间码 <input name="roomCode" required maxlength="12" autocapitalize="characters" value="${escapeHtml(roomCode)}" /></label>
          <button type="submit">重连</button>
        </form>
      </div>
      ${roomCode ? `<section class="room-card"><h2>房间码 <strong class="room-code">${escapeHtml(roomCode)}</strong></h2>${renderPlayers(players)}<button id="start-game" ${canStart ? '' : 'disabled'}>房主开始游戏</button></section>` : ''}
    </section>
  `;
}

function renderPlayers(players: Array<{ seatIndex: number; nickname: string; isOwner: boolean; connectionStatus: string }>): string {
  if (players.length === 0) return '<p class="muted">尚未进入房间。</p>';
  return `<ul class="players">${players
    .map((player) => `<li><span>席位 ${player.seatIndex + 1}</span><strong>${escapeHtml(player.nickname)}</strong>${player.isOwner ? '<span class="badge">房主</span>' : ''}<span class="status ${player.connectionStatus}">${player.connectionStatus === 'connected' ? '在线' : '离线'}</span></li>`)
    .join('')}</ul>`;
}
