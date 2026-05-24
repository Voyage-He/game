import type { ChatMessage } from '../../shared/types.js';
import { escapeHtml } from './util.js';

export function renderChat(messages: ChatMessage[], enabled: boolean): string {
  return `
    <section class="panel chat-panel" aria-labelledby="chat-title">
      <h2 id="chat-title">💬 自由发言</h2>
      <div class="chat-log" aria-live="polite">
        ${messages.length === 0 ? '<p class="muted">暂无聊天消息。聊天仅转发给当前房间成员，不保留历史记录。</p>' : messages.map(renderMessage).join('')}
      </div>
      <form id="chat-form" class="chat-form">
        <input name="text" maxlength="500" placeholder="输入发言内容" ${enabled ? '' : 'disabled'} />
        <button type="submit" ${enabled ? '' : 'disabled'}>发送</button>
      </form>
    </section>
  `;
}

function renderMessage(message: ChatMessage): string {
  return `<p class="chat-message"><strong>席位 ${message.seatIndex + 1} ${escapeHtml(message.nickname)}：</strong>${escapeHtml(message.text)}</p>`;
}
