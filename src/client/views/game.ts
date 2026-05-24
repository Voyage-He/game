import { buildCountdownSnapshot, clientState, type ClientStateSnapshot, type SelectionState } from '../state.js';
import { ROLE_BY_PHASE, type PrivateRoomView, type PublicRoomView, type RolePhase, type SettlementView } from '../../shared/types.js';
import { FREE_SPEECH_TEXT, ROLE_ACTION_LABELS, VOTING_WAIT_TEXT, WAITING_ACTION_TEXT, escapeHtml, formatPhase, getActionPrompt, getRevealedRole, getSelectionProgress } from './util.js';

export function renderGame(snapshot: ClientStateSnapshot): string {
  const publicView = snapshot.publicView;
  const privateView = snapshot.privateView;
  if (!publicView) return '';
  const ownPlayer = publicView.players.find((player) => player.seatIndex === privateView?.seatIndex);
  const isOwner = Boolean(ownPlayer?.isOwner);
  const canAdvance = isOwner && publicView.phase === 'free_speech';
  return `
    <section class="panel game-panel">
      ${snapshot.error ? `<p role="alert" class="error">${escapeHtml(snapshot.error)}</p>` : ''}
      <div class="phase-card">
        <h2><span class="badge phase-badge">当前阶段</span>${formatPhase(publicView.phase)}</h2>
        ${renderTimer(snapshot)}
      </div>
      ${renderPlayers(publicView, privateView, snapshot.animatedCardKeys, snapshot.selectionState, snapshot.settlement)}
      ${privateView?.initialRole && !snapshot.settlement ? `<p class="own-role">你的初始身份：<strong>${escapeHtml(privateView.initialRole)}</strong></p>` : ''}
      ${renderActionPanel(publicView, privateView, snapshot.selectionState)}
      ${publicView.phase === 'free_speech' ? `<button id="advance-vote" ${canAdvance ? '' : 'disabled'}>进入投票</button>` : ''}
      ${renderVoting(publicView, privateView)}
      ${renderSettlement(snapshot)}
    </section>
  `;
}

function renderPlayers(publicView: PublicRoomView, privateView: PrivateRoomView | null, animatedCardKeys: Set<string>, selectionState: SelectionState, settlement: SettlementView | null): string {
  const revealedCards = privateView?.revealedCards ?? [];
  const ownSeatIndex = privateView?.seatIndex;
  const initialRole = privateView?.initialRole;
  const currentEligibleAction = privateView?.currentEligibleAction ?? null;

  // Build settlement lookup maps for final roles
  const finalPlayerRoles = new Map<number, string>();
  const finalUnderwaterRoles = new Map<number, string>();
  if (settlement) {
    for (const card of settlement.finalPlayerCards) {
      finalPlayerRoles.set(card.seatIndex, card.role);
    }
    for (const card of settlement.finalUnderwaterCards) {
      finalUnderwaterRoles.set(card.index, card.role);
    }
  }

  return `
    ${renderUnderwaterCards(revealedCards, animatedCardKeys, selectionState, currentEligibleAction, finalUnderwaterRoles)}
    <div class="cards-location-separator" aria-hidden="true"></div>
    <div class="players-grid">${publicView.players
      .map((player) => renderPlayerCard(player, ownSeatIndex, initialRole, revealedCards, animatedCardKeys, selectionState, currentEligibleAction, finalPlayerRoles.get(player.seatIndex)))
      .join('')}</div>`;
}

function renderPlayerCard(
  player: { seatIndex: number; nickname: string; isOwner: boolean; connectionStatus: string },
  ownSeatIndex: number | undefined,
  initialRole: string | null | undefined,
  revealedCards: Array<{ location: string; role: string }>,
  animatedCardKeys: Set<string>,
  selectionState: SelectionState,
  currentEligibleAction: { phase: string; options: string[] } | null,
  finalRole?: string
): string {
  const isSelf = player.seatIndex === ownSeatIndex;
  const isDisconnected = player.connectionStatus === 'disconnected';

  let cardLocation: string;
  let roleForCardFront: string | null = null;

  // Settlement: show final role for every player
  if (finalRole !== undefined) {
    cardLocation = `playerSeat:${player.seatIndex}:final`;
    roleForCardFront = finalRole;
  } else if (isSelf) {
    // Own card always shows initial role (always present in revealedCards via buildRevealedCards)
    cardLocation = `playerSeat:${player.seatIndex}:initial`;
    roleForCardFront = getRevealedRole(cardLocation, revealedCards) ?? initialRole ?? null;
  } else {
    cardLocation = `playerSeat:${player.seatIndex}`;
    roleForCardFront = getRevealedRole(cardLocation, revealedCards);
  }

  const isFlipped = roleForCardFront !== null;
  const isSettlement = finalRole !== undefined;
  const flipAnimationClass = isSettlement ? 'card-flip-in' : getFlipAnimationClass(cardLocation, isFlipped, animatedCardKeys);
  const interactionClass = isSettlement ? '' : getCardInteractionClass(currentEligibleAction?.phase, 'player', player.seatIndex, ownSeatIndex, selectionState, currentEligibleAction);

  return `
    <div class="player-card${isDisconnected ? ' disconnected' : ''}" data-seat-index="${player.seatIndex}">
      ${renderCardElement(cardLocation, roleForCardFront, isFlipped, flipAnimationClass, interactionClass, 'player')}
      <div class="player-card-header">
        <span class="player-nickname">${escapeHtml(player.nickname)}</span>
        <span class="player-badges">
          ${player.isOwner ? '<span class="badge">房主</span>' : ''}
          ${isDisconnected ? '<span class="badge">离线</span>' : ''}
          ${isSelf ? '<span class="badge" style="background:#2454d6;color:white">你</span>' : ''}
        </span>
      </div>
    </div>`;
}

function renderUnderwaterCards(revealedCards: Array<{ location: string; role: string }>, animatedCardKeys: Set<string>, selectionState: SelectionState, currentEligibleAction: { phase: string; options: string[] } | null, finalUnderwaterRoles?: Map<number, string>): string {
  const isSettlement = finalUnderwaterRoles !== undefined && finalUnderwaterRoles.size > 0;
  return `
    <div class="underwater-cards">
      <h3>水下的牌</h3>
      <div class="underwater-cards-grid">
        ${[0, 1, 2]
          .map((index) => {
            const location = `underwater:${index}`;
            let role: string | null = null;
            let flipAnimationClass = '';
            let interactionClass = '';
            if (isSettlement) {
              role = finalUnderwaterRoles!.get(index) ?? null;
              flipAnimationClass = 'card-flip-in';
            } else {
              role = getRevealedRole(location, revealedCards);
              const isFlipped = role !== null;
              flipAnimationClass = getFlipAnimationClass(location, isFlipped, animatedCardKeys);
              interactionClass = getCardInteractionClass(currentEligibleAction?.phase, 'underwater', index, undefined, selectionState, currentEligibleAction);
            }
            const isFlipped = role !== null;
            return `
              <div class="underwater-card" data-underwater-index="${index}">
                ${renderCardElement(location, role, isFlipped, flipAnimationClass, interactionClass, 'underwater')}
                <span class="underwater-label">水下 ${index + 1}</span>
              </div>`;
          })
          .join('')}
      </div>
    </div>`;
}

function getFlipAnimationClass(location: string, isFlipped: boolean, animatedCardKeys: Set<string>): string {
  if (!isFlipped) return '';
  if (animatedCardKeys.has(location)) return '';
  // First time this card is revealed in this phase → add flip-in animation
  animatedCardKeys.add(location);
  return 'card-flip-in';
}

function renderCardElement(location: string, role: string | null, isFlipped: boolean, flipAnimationClass = '', interactionClass = '', kind: 'player' | 'underwater' = 'player'): string {
  const kindClass = kind === 'underwater' ? 'card-underwater' : 'card-player';
  const classes = ['card', kindClass, flipAnimationClass, interactionClass].filter(Boolean).join(' ');
  const backEmoji = kind === 'underwater' ? '🌊' : '🃏';
  return `
    <div class="${classes}" data-flipped="${isFlipped}" data-location="${escapeHtml(location)}">
      <div class="card-inner">
        <div class="card-back">${backEmoji}</div>
        <div class="card-front">
          <span class="card-role">${role ? escapeHtml(role) : '?'}</span>
        </div>
      </div>
    </div>`;
}

function renderTimer(snapshot: ClientStateSnapshot): string {
  const publicView = snapshot.publicView;
  if (!publicView) return '';
  if (publicView.phase === 'free_speech') return `<p class="muted">${FREE_SPEECH_TEXT}</p>`;
  if (publicView.phase === 'settlement') return '<p class="muted">对局已结算，没有倒计时。</p>';
  const countdown = buildCountdownSnapshot(snapshot);
  if (!countdown.isTimed) return '<p class="muted">该阶段没有自动倒计时。</p>';
  return `<p class="timer" aria-live="polite">剩余 <strong>${countdown.remainingSeconds ?? 0}</strong> 秒</p>`;
}

function renderActionPanel(publicView: PublicRoomView, privateView: PrivateRoomView | null, selectionState: SelectionState): string {
  const action = privateView?.currentEligibleAction;
  if (!action || publicView.phase !== action.phase) {
    if (isOwnRoleActionCompleted(publicView, privateView)) {
      return '<section class="action-panel completed"><h2>身份行动已提交</h2><p>你的技能选择已提交，请等待下一阶段。</p></section>';
    }
    if (publicView.phase?.endsWith('_action')) return `<section class="action-panel neutral"><h2>其他玩家行动中</h2><p>${WAITING_ACTION_TEXT}</p></section>`;
    return '';
  }
  const prompt = getActionPrompt(action.phase, selectionState);
  const progress = getSelectionProgress(action.phase, selectionState);
  const title = ROLE_ACTION_LABELS[action.phase as RolePhase] ?? action.phase;
  const confirmation = getSkillConfirmationState(action.phase, selectionState, action.options);
  return `<section class="action-panel">
    <h2>${escapeHtml(title)} · 轮到你行动</h2>
    <p>${escapeHtml(prompt)}</p>
    ${progress ? `<p class="selection-progress">${escapeHtml(progress)}</p>` : ''}
    <div class="skill-confirm-row">
      <button id="confirm-skill-action" type="button" ${confirmation.disabled ? 'disabled' : ''}>${escapeHtml(confirmation.label)}</button>
    </div>
    ${confirmation.hint ? `<p class="selection-hint">${escapeHtml(confirmation.hint)}</p>` : ''}
  </section>`;
}

function isOwnRoleActionCompleted(publicView: PublicRoomView, privateView: PrivateRoomView | null): boolean {
  if (!publicView.phase?.endsWith('_action') || !privateView?.initialRole) return false;
  return ROLE_BY_PHASE[publicView.phase] === privateView.initialRole && Boolean(publicView.phaseCompletion?.currentRoleCompleted);
}

function getSkillConfirmationState(phase: string, sel: SelectionState, options: string[]): { label: string; disabled: boolean; hint: string | null } {
  if (sel.actionSubmitted) return { label: '已提交', disabled: true, hint: null };
  if (hasValidSkillSelection(phase, sel)) return { label: '确认使用技能', disabled: false, hint: null };
  if (isOptionalSkill(options) && !hasAnySkillSelection(phase, sel)) return { label: '不使用技能', disabled: false, hint: '不选择目标时，将跳过本次技能。' };
  return { label: '确认使用技能', disabled: true, hint: requiredSelectionHint(phase) };
}

function isOptionalSkill(options: string[]): boolean {
  return options.includes('skip');
}

function hasAnySkillSelection(phase: string, sel: SelectionState): boolean {
  switch (phase) {
    case 'wolf_action':
      return sel.wolfSelectedUnderwater !== null;
    case 'seer_action':
      return sel.seerUnderwaterClicked.length > 0 || sel.seerPlayerSelected !== null;
    case 'robber_action':
      return sel.robberSelectedSeat !== null;
    case 'troublemaker_action':
      return sel.troublemakerSelected.length > 0;
    case 'water_ghost_action':
      return sel.waterGhostSelectedUnderwater !== null;
    default:
      return false;
  }
}

function hasValidSkillSelection(phase: string, sel: SelectionState): boolean {
  switch (phase) {
    case 'wolf_action':
      return sel.wolfSelectedUnderwater !== null;
    case 'seer_action':
      return sel.seerPlayerSelected !== null || sel.seerUnderwaterClicked.length === 2;
    case 'robber_action':
      return sel.robberSelectedSeat !== null;
    case 'troublemaker_action':
      return sel.troublemakerSelected.length === 2;
    case 'water_ghost_action':
      return sel.waterGhostSelectedUnderwater !== null;
    default:
      return false;
  }
}

function requiredSelectionHint(phase: string): string {
  switch (phase) {
    case 'seer_action':
      return '请选择一名玩家，或选择两张水下牌后再确认。';
    case 'troublemaker_action':
      return '请选择两名其他玩家后再确认。';
    case 'water_ghost_action':
      return '请选择一张水下牌后再确认。';
    default:
      return '请选择有效目标后再确认。';
  }
}

function isCardClickable(
  phase: string | undefined,
  cardKind: 'player' | 'underwater',
  targetIndex: number,
  ownSeatIndex: number | undefined,
  sel: SelectionState,
  currentEligibleAction: { phase: string; options: string[] } | null
): boolean {
  if (!currentEligibleAction || sel.actionSubmitted) return false;
  switch (currentEligibleAction.phase) {
    case 'wolf_action':
      return cardKind === 'underwater';
    case 'seer_action':
      if (cardKind === 'underwater') {
        if (sel.seerActionMode === 'player') return false;
        return sel.seerUnderwaterClicked.includes(targetIndex) || sel.seerUnderwaterClicked.length < 2;
      }
      return sel.seerActionMode !== 'underwater' && targetIndex !== ownSeatIndex;
    case 'robber_action':
      return cardKind === 'player' && targetIndex !== ownSeatIndex;
    case 'troublemaker_action':
      if (cardKind !== 'player' || targetIndex === ownSeatIndex) return false;
      return sel.troublemakerSelected.includes(targetIndex) || sel.troublemakerSelected.length < 2;
    case 'water_ghost_action':
      return cardKind === 'underwater';
    default:
      return false;
  }
}

function isCardSelected(
  phase: string | undefined,
  cardKind: 'player' | 'underwater',
  targetIndex: number,
  sel: SelectionState
): boolean {
  switch (phase) {
    case 'wolf_action':
      return cardKind === 'underwater' && sel.wolfSelectedUnderwater === targetIndex;
    case 'seer_action':
      if (cardKind === 'underwater') return sel.seerUnderwaterClicked.includes(targetIndex);
      return sel.seerPlayerSelected === targetIndex;
    case 'robber_action':
      return cardKind === 'player' && sel.robberSelectedSeat === targetIndex;
    case 'troublemaker_action':
      return cardKind === 'player' && sel.troublemakerSelected.includes(targetIndex);
    case 'water_ghost_action':
      return cardKind === 'underwater' && sel.waterGhostSelectedUnderwater === targetIndex;
    default:
      return false;
  }
}

function getCardInteractionClass(
  phase: string | undefined,
  cardKind: 'player' | 'underwater',
  targetIndex: number,
  ownSeatIndex: number | undefined,
  sel: SelectionState,
  currentEligibleAction: { phase: string; options: string[] } | null
): string {
  if (sel.actionSubmitted) return 'submitted';
  const classes: string[] = [];
  if (isCardClickable(phase, cardKind, targetIndex, ownSeatIndex, sel, currentEligibleAction)) {
    classes.push('clickable');
  }
  if (isCardSelected(phase, cardKind, targetIndex, sel)) {
    classes.push('selected');
  }
  return classes.join(' ');
}

function renderVoting(publicView: PublicRoomView, privateView: PrivateRoomView | null): string {
  if (publicView.phase !== 'voting' || !privateView) return '';
  const submitted = Boolean(privateView.submittedVote);
  const progress = publicView.voteCompletion ? `投票进度：${publicView.voteCompletion.submittedCount}/${publicView.voteCompletion.requiredCount}` : '投票进度：等待同步';
  return `<section class="vote-panel"><h2>投票</h2><p class="vote-progress">${progress}</p><p>${submitted ? `你已投给席位 ${privateView.submittedVote!.targetSeatIndex + 1}` : VOTING_WAIT_TEXT}</p>${publicView.players
    .filter((player) => player.seatIndex !== privateView.seatIndex)
    .map((player) => `<button data-vote="${player.seatIndex}" ${submitted ? 'disabled' : ''}>投给 ${escapeHtml(player.nickname)}</button>`)
    .join('')}</section>`;
}

function renderSettlement(snapshot: ClientStateSnapshot): string {
  const settlement = snapshot.settlement;
  if (!settlement) return '';
  const winnerClass = settlement.winningCamp === '狼人' ? 'settlement-wolf-wins' : 'settlement-good-wins';
  return `<section class="settlement ${winnerClass}">
    <h2>结算</h2>
    <p>胜利阵营：<strong>${escapeHtml(settlement.winningCamp)}</strong></p>
    <p>出局：${settlement.eliminatedSeatIndex === null ? '无人出局' : `席位 ${settlement.eliminatedSeatIndex + 1}`}</p>
    <ul>${settlement.voteTotals.map((total) => `<li>席位 ${total.seatIndex + 1}: ${total.votes} 票</li>`).join('')}</ul>
    ${settlement.automaticVotes.length ? `<p class="badge">包含自动投票 ${settlement.automaticVotes.length} 个</p>` : ''}${settlement.automaticActions.length ? `<p class="badge">包含自动身份行动 ${settlement.automaticActions.length} 个</p>` : ''}
  </section>`;
}

export function bindCardClickHandlers(): void {
  const underwaterGrid = document.querySelector('.underwater-cards-grid');
  const playersGrid = document.querySelector('.players-grid');
  const confirmButton = document.querySelector<HTMLButtonElement>('#confirm-skill-action');

  function handleClick(event: Event): void {
    const snap = clientState.getSnapshot();
    const action = snap.privateView?.currentEligibleAction;
    if (!action) return;

    const sel = snap.selectionState;
    if (sel.actionSubmitted) return;

    const target = event.target as HTMLElement;
    const ownSeatIndex = snap.privateView?.seatIndex;

    const underwaterCard = target.closest('.underwater-card');
    if (underwaterCard) {
      const idxStr = underwaterCard.getAttribute('data-underwater-index');
      if (idxStr === null) return;
      const idx = parseInt(idxStr, 10);
      if (isNaN(idx)) return;
      handleUnderwaterClick(action.phase, idx, sel);
      return;
    }

    const playerCard = target.closest('.player-card');
    if (playerCard) {
      const idxStr = playerCard.getAttribute('data-seat-index');
      if (idxStr === null) return;
      const seatIdx = parseInt(idxStr, 10);
      if (isNaN(seatIdx)) return;
      handlePlayerClick(action.phase, seatIdx, ownSeatIndex, sel);
    }
  }

  underwaterGrid?.addEventListener('click', handleClick);
  playersGrid?.addEventListener('click', handleClick);
  confirmButton?.addEventListener('click', handleSkillConfirmClick);
}

function handleUnderwaterClick(phase: string, idx: number, sel: SelectionState): void {
  switch (phase) {
    case 'wolf_action':
      clientState.updateCardSelection({
        wolfSelectedUnderwater: sel.wolfSelectedUnderwater === idx ? null : idx
      });
      break;
    case 'seer_action': {
      if (sel.seerActionMode === 'player') return;
      if (sel.seerUnderwaterClicked.includes(idx)) {
        const next = sel.seerUnderwaterClicked.filter((selected) => selected !== idx);
        clientState.updateCardSelection({
          seerActionMode: next.length === 0 ? 'idle' : 'underwater',
          seerUnderwaterClicked: next
        });
        return;
      }
      if (sel.seerUnderwaterClicked.length >= 2) return;
      clientState.updateCardSelection({
        seerActionMode: 'underwater',
        seerUnderwaterClicked: [...sel.seerUnderwaterClicked, idx]
      });
      break;
    }
    case 'water_ghost_action':
      clientState.updateCardSelection({
        waterGhostSelectedUnderwater: sel.waterGhostSelectedUnderwater === idx ? null : idx
      });
      break;
  }
}

function handlePlayerClick(phase: string, seatIdx: number, ownSeatIndex: number | undefined, sel: SelectionState): void {
  if (seatIdx === ownSeatIndex) return;

  switch (phase) {
    case 'seer_action':
      if (sel.seerActionMode === 'underwater') return;
      if (sel.seerPlayerSelected === seatIdx) {
        clientState.updateCardSelection({ seerActionMode: 'idle', seerPlayerSelected: null });
        return;
      }
      clientState.updateCardSelection({
        seerActionMode: 'player',
        seerPlayerSelected: seatIdx
      });
      break;
    case 'robber_action':
      clientState.updateCardSelection({
        robberSelectedSeat: sel.robberSelectedSeat === seatIdx ? null : seatIdx
      });
      break;
    case 'troublemaker_action':
      if (sel.troublemakerSelected.includes(seatIdx)) {
        clientState.updateCardSelection({
          troublemakerSelected: sel.troublemakerSelected.filter((selected) => selected !== seatIdx)
        });
      } else if (sel.troublemakerSelected.length < 2) {
        clientState.updateCardSelection({
          troublemakerSelected: [...sel.troublemakerSelected, seatIdx]
        });
      }
      break;
  }
}

function handleSkillConfirmClick(): void {
  const snap = clientState.getSnapshot();
  const action = snap.privateView?.currentEligibleAction;
  if (!action) return;
  const sel = snap.selectionState;
  if (sel.actionSubmitted) return;

  if (isOptionalSkill(action.options) && !hasAnySkillSelection(action.phase, sel)) {
    clientState.sendRoleAction('action:skip', { phase: action.phase });
    clientState.updateCardSelection({ actionSubmitted: true });
    return;
  }

  if (!hasValidSkillSelection(action.phase, sel)) return;
  const payload = buildSkillActionPayload(action.phase, sel);
  if (!payload) return;
  clientState.sendRoleAction(payload.eventName, payload.body);
  clientState.updateCardSelection({ actionSubmitted: true });
}

function buildSkillActionPayload(phase: string, sel: SelectionState): { eventName: string; body: unknown } | null {
  switch (phase) {
    case 'wolf_action':
      return sel.wolfSelectedUnderwater === null ? null : { eventName: 'action:wolf', body: { underwaterIndex: sel.wolfSelectedUnderwater } };
    case 'seer_action':
      if (sel.seerPlayerSelected !== null) {
        return { eventName: 'action:seer', body: { mode: 'view_one_player', targetSeatIndex: sel.seerPlayerSelected } };
      }
      if (sel.seerUnderwaterClicked.length === 2) {
        return { eventName: 'action:seer', body: { mode: 'view_two_underwater', underwaterIndexes: sel.seerUnderwaterClicked } };
      }
      return null;
    case 'robber_action':
      return sel.robberSelectedSeat === null ? null : { eventName: 'action:robber', body: { targetSeatIndex: sel.robberSelectedSeat } };
    case 'troublemaker_action':
      return sel.troublemakerSelected.length === 2 ? { eventName: 'action:troublemaker', body: { targetSeatIndexes: sel.troublemakerSelected } } : null;
    case 'water_ghost_action':
      return sel.waterGhostSelectedUnderwater === null ? null : { eventName: 'action:water-ghost', body: { underwaterIndex: sel.waterGhostSelectedUnderwater } };
    default:
      return null;
  }
}
