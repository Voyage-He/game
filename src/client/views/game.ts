import type { ClientStateSnapshot } from '../state.js';
import type { PrivateRoomView, PublicRoomView } from '../../shared/types.js';
import { escapeHtml, formatPhase } from './util.js';

export function renderGame(snapshot: ClientStateSnapshot): string {
  const publicView = snapshot.publicView;
  const privateView = snapshot.privateView;
  if (!publicView) return '';
  const ownPlayer = publicView.players.find((player) => player.seatIndex === privateView?.seatIndex);
  const isOwner = Boolean(ownPlayer?.isOwner);
  const canAdvance = isOwner && publicView.phase === 'free_speech';
  return `
    <section class="panel game-panel" aria-labelledby="game-title">
      <h1 id="game-title">房间 ${escapeHtml(publicView.roomCode)}</h1>
      ${snapshot.error ? `<p role="alert" class="error">${escapeHtml(snapshot.error)}</p>` : ''}
      <div class="phase-card">
        <span class="badge">当前阶段</span>
        <h2>${formatPhase(publicView.phase)}</h2>
        ${renderTimer(publicView)}
      </div>
      ${renderPlayers(publicView, privateView)}
      ${privateView?.initialRole ? `<p class="own-role">你的初始身份：<strong>${escapeHtml(privateView.initialRole)}</strong></p>` : ''}
      ${renderActionPanel(publicView, privateView)}
      ${publicView.phase === 'free_speech' ? `<button id="advance-vote" ${canAdvance ? '' : 'disabled'}>进入投票</button>` : ''}
      ${renderVoting(publicView, privateView)}
      ${renderSettlement(snapshot)}
    </section>
  `;
}

function renderPlayers(publicView: PublicRoomView, privateView: PrivateRoomView | null): string {
  return `<ul class="players">${publicView.players
    .map((player) => `<li class="${player.seatIndex === privateView?.seatIndex ? 'self' : ''}"><span>席位 ${player.seatIndex + 1}</span><strong>${escapeHtml(player.nickname)}</strong>${player.isOwner ? '<span class="badge">房主</span>' : ''}<span class="status ${player.connectionStatus}">${player.connectionStatus === 'connected' ? '在线' : '离线'}</span></li>`)
    .join('')}</ul>`;
}

function renderTimer(publicView: PublicRoomView): string {
  if (!publicView.phaseEndsAt) return '<p class="muted">该阶段没有自动倒计时。</p>';
  const remaining = Math.max(0, Math.ceil((new Date(publicView.phaseEndsAt).getTime() - Date.now()) / 1000));
  return `<p class="timer">剩余约 <strong>${remaining}</strong> 秒</p>`;
}

function renderActionPanel(publicView: PublicRoomView, privateView: PrivateRoomView | null): string {
  const action = privateView?.currentEligibleAction;
  if (!action || publicView.phase !== action.phase) {
    if (publicView.phase?.endsWith('_action')) return '<section class="action-panel neutral"><h2>身份行动</h2><p>请等待当前身份玩家行动。不会显示私密行动内容。</p></section>';
    return '';
  }
  switch (action.phase) {
    case 'wolf_action':
      return actionWrapper('狼人行动', underwaterButtons('action:wolf', 'underwaterIndex'));
    case 'seer_action':
      return actionWrapper('预言家行动', `
        <button data-action="action:seer" data-payload='{"mode":"view_two_underwater","underwaterIndexes":[0,1]}'>查看水下 1+2</button>
        <button data-action="action:seer" data-payload='{"mode":"view_two_underwater","underwaterIndexes":[0,2]}'>查看水下 1+3</button>
        <button data-action="action:seer" data-payload='{"mode":"view_two_underwater","underwaterIndexes":[1,2]}'>查看水下 2+3</button>
        ${playerTargetButtons(publicView, privateView.seatIndex, 'action:seer', 'targetSeatIndex', { mode: 'view_one_player' })}
      `);
    case 'robber_action':
      return actionWrapper('强盗行动', playerTargetButtons(publicView, privateView.seatIndex, 'action:robber', 'targetSeatIndex'));
    case 'troublemaker_action': {
      const targets = publicView.players.filter((player) => player.seatIndex !== privateView.seatIndex).map((player) => player.seatIndex);
      return actionWrapper('捣蛋鬼行动', `<button data-action="action:troublemaker" data-payload='${JSON.stringify({ targetSeatIndexes: targets })}'>交换另外两名玩家</button>`);
    }
    case 'water_ghost_action':
      return actionWrapper('水鬼行动', underwaterButtons('action:water-ghost', 'underwaterIndex'));
    default:
      return '';
  }
}

function renderVoting(publicView: PublicRoomView, privateView: PrivateRoomView | null): string {
  if (publicView.phase !== 'voting' || !privateView) return '';
  const submitted = Boolean(privateView.submittedVote);
  return `<section class="vote-panel"><h2>投票</h2><p>${submitted ? `你已投给席位 ${privateView.submittedVote!.targetSeatIndex + 1}` : '请选择一名其他玩家投票。'}</p>${publicView.players
    .filter((player) => player.seatIndex !== privateView.seatIndex)
    .map((player) => `<button data-vote="${player.seatIndex}" ${submitted ? 'disabled' : ''}>投给 ${escapeHtml(player.nickname)}</button>`)
    .join('')}</section>`;
}

function renderSettlement(snapshot: ClientStateSnapshot): string {
  const settlement = snapshot.settlement;
  if (!settlement) return '';
  return `<section class="settlement"><h2>结算</h2><p>胜利阵营：<strong>${escapeHtml(settlement.winningCamp)}</strong></p><p>出局：${settlement.eliminatedSeatIndex === null ? '无人出局' : `席位 ${settlement.eliminatedSeatIndex + 1}`}</p><h3>投票</h3><ul>${settlement.voteTotals.map((total) => `<li>席位 ${total.seatIndex + 1}: ${total.votes} 票</li>`).join('')}</ul><h3>最终身份</h3><ul>${settlement.finalPlayerCards.map((card) => `<li>席位 ${card.seatIndex + 1} ${escapeHtml(card.nickname)}：${escapeHtml(card.role)}</li>`).join('')}</ul><h3>水下的牌</h3><ul>${settlement.finalUnderwaterCards.map((card) => `<li>水下 ${card.index + 1}：${escapeHtml(card.role)}</li>`).join('')}</ul>${settlement.automaticVotes.length ? `<p class="badge">包含自动投票 ${settlement.automaticVotes.length} 个</p>` : ''}${settlement.automaticActions.length ? `<p class="badge">包含自动身份行动 ${settlement.automaticActions.length} 个</p>` : ''}</section>`;
}

function actionWrapper(title: string, buttons: string): string {
  return `<section class="action-panel"><h2>${escapeHtml(title)}</h2><p>只有你能看到并提交这些选择。</p><div class="actions">${buttons}</div></section>`;
}

function underwaterButtons(action: string, property: string): string {
  return [0, 1, 2]
    .map((index) => `<button data-action="${action}" data-payload='${JSON.stringify({ [property]: index })}'>选择水下 ${index + 1}</button>`)
    .join('');
}

function playerTargetButtons(publicView: PublicRoomView, ownSeatIndex: number, action: string, property: string, extra: Record<string, unknown> = {}): string {
  return publicView.players
    .filter((player) => player.seatIndex !== ownSeatIndex)
    .map((player) => `<button data-action="${action}" data-payload='${JSON.stringify({ ...extra, [property]: player.seatIndex })}'>选择 ${escapeHtml(player.nickname)}</button>`)
    .join('');
}
