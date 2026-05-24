import type { RolePhase } from '../../shared/types.js';
import type { SelectionState } from '../state.js';

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export const PHASE_LABELS: Record<string, string> = {
  close_eyes: '闭眼准备',
  wolf_action: '狼人行动',
  seer_action: '预言家行动',
  robber_action: '强盗行动',
  troublemaker_action: '捣蛋鬼行动',
  water_ghost_action: '水鬼行动',
  open_eyes: '睁眼',
  free_speech: '自由发言',
  voting: '投票',
  settlement: '结算'
};

export const ROLE_ACTION_LABELS: Record<RolePhase, string> = {
  wolf_action: '狼人行动',
  seer_action: '预言家行动',
  robber_action: '强盗行动',
  troublemaker_action: '捣蛋鬼行动',
  water_ghost_action: '水鬼行动'
};

export const WAITING_ACTION_TEXT = '其他玩家行动中。请等待当前身份玩家完成操作，倒计时结束会自动进入下一阶段。不会显示私密身份或行动结果。';
export const ACTING_ACTION_TEXT = '轮到你行动，请在倒计时结束前选择。只有你能看到并提交这些选择。';
export const VOTING_WAIT_TEXT = '请选择一名其他玩家投票。';
export const FREE_SPEECH_TEXT = '自由发言不限时，房主确认后进入投票。';

export function formatPhase(phase: string | undefined): string {
  return phase ? PHASE_LABELS[phase] ?? phase : '等待中';
}

export function isLocationRevealed(location: string, revealedCards: Array<{ location: string; role: string }>): boolean {
  return revealedCards.some((card) => card.location === location);
}

export function getRevealedRole(location: string, revealedCards: Array<{ location: string; role: string }>): string | null {
  return revealedCards.find((card) => card.location === location)?.role ?? null;
}

export function getActionPrompt(phase: string, selectionState: SelectionState): string {
  switch (phase) {
    case 'wolf_action':
      if (selectionState.actionSubmitted) return '技能选择已提交，请等待下一阶段';
      return '请点击一张水下牌作为目标，确认前不会翻牌';
    case 'seer_action': {
      if (selectionState.actionSubmitted) return '技能选择已提交，请等待下一阶段';
      if (selectionState.seerActionMode === 'underwater') {
        const count = selectionState.seerUnderwaterClicked.length;
        return count < 2 ? '已选择水下牌路径，请再选择一张水下牌后确认' : '已选择两张水下牌，请确认使用技能';
      }
      if (selectionState.seerActionMode === 'player') return '已选择一名玩家，请确认使用技能';
      return '请选择两张水下牌，或选择一名玩家的卡牌；确认前不会翻牌';
    }
    case 'robber_action':
      if (selectionState.actionSubmitted) return '技能选择已提交，请等待下一阶段';
      return '请点击一名其他玩家的卡牌作为目标，确认后才查看并交换身份';
    case 'troublemaker_action': {
      if (selectionState.actionSubmitted) return '技能选择已提交，请等待下一阶段';
      const count = selectionState.troublemakerSelected.length;
      if (count === 1) return '已选择 1/2 名玩家，请选择第二名玩家（可再次点击已选中卡牌取消）';
      if (count === 2) return '已选择两名玩家，请确认交换';
      return '请点击两名其他玩家的卡牌进行交换，确认前不会提交';
    }
    case 'water_ghost_action':
      if (selectionState.actionSubmitted) return '技能选择已提交，请等待下一阶段';
      return '请点击一张水下牌作为交换目标，确认前不会提交';
    default:
      return '';
  }
}

export function getSelectionProgress(phase: string, selectionState: SelectionState): string | null {
  if (selectionState.actionSubmitted) return null;
  switch (phase) {
    case 'wolf_action':
      return selectionState.wolfSelectedUnderwater === null ? null : `已选择水下 ${selectionState.wolfSelectedUnderwater + 1}`;
    case 'seer_action':
      if (selectionState.seerActionMode === 'underwater') {
        return `已选择 ${selectionState.seerUnderwaterClicked.length}/2 张水下牌`;
      }
      if (selectionState.seerActionMode === 'player' && selectionState.seerPlayerSelected !== null) {
        return `已选择席位 ${selectionState.seerPlayerSelected + 1}`;
      }
      return null;
    case 'robber_action':
      return selectionState.robberSelectedSeat === null ? null : `已选择席位 ${selectionState.robberSelectedSeat + 1}`;
    case 'troublemaker_action':
      if (selectionState.troublemakerSelected.length > 0) {
        return `已选择 ${selectionState.troublemakerSelected.length}/2 名玩家`;
      }
      return null;
    case 'water_ghost_action':
      return selectionState.waterGhostSelectedUnderwater === null ? null : `已选择水下 ${selectionState.waterGhostSelectedUnderwater + 1}`;
    default:
      return null;
  }
}
