export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatPhase(phase: string | undefined): string {
  const labels: Record<string, string> = {
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
  return phase ? labels[phase] ?? phase : '等待中';
}
