import './styles/main.css';
import { clientState, isTimedPhaseView } from './state.js';
import { renderLobby } from './views/lobby.js';
import { renderGame, bindCardClickHandlers } from './views/game.js';
import { renderChat } from './views/chat.js';
import { renderAuthPage, renderUserStatusBar, renderInviteCodesSection, bindAuthEvents } from './views/auth.js';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');

let countdownRenderLoop: number | null = null;

clientState.subscribe(render);

// Restore auth session on startup (async, triggers re-render on completion)
clientState.authRestoreSession();

function render(): void {
  // Preserve in-progress chat input across re-renders
  const chatInput = document.querySelector<HTMLInputElement>('#chat-form input[name="text"]');
  const pendingChatText = chatInput?.value ?? '';

  const snapshot = clientState.getSnapshot();

  // Show auth page if user is not logged in and hasn't skipped
  if (snapshot.showAuthPage && !snapshot.authUser) {
    app.innerHTML = renderAuthPage(snapshot.error ?? undefined);
    bindAuthEvents();
    bindAuthFormSubmissions();
    syncInviteCodeEvents();
    return;
  }

  const inRoom = Boolean(snapshot.publicView || snapshot.currentRoomCode);
  const statusBar = renderUserStatusBar(snapshot);
  app.innerHTML = `
    ${statusBar}
    ${!snapshot.publicView || snapshot.publicView.status === 'waiting' ? renderLobby(snapshot) : renderGame(snapshot)}
    ${inRoom ? renderChat(snapshot.chatMessages, snapshot.publicView?.phase === 'free_speech') : ''}
  `;
  bindForms();
  bindGameControls();
  bindAuthControls();
  syncCountdownRenderLoop(snapshot);

  // Restore in-progress chat input text
  if (pendingChatText) {
    const newInput = document.querySelector<HTMLInputElement>('#chat-form input[name="text"]');
    if (newInput && !newInput.disabled) {
      newInput.value = pendingChatText;
    }
  }
}

/* ── Auth form submissions ── */

function bindAuthFormSubmissions(): void {
  document.querySelector<HTMLFormElement>('#auth-login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    try {
      clientState.clearError();
      await clientState.authLogin(String(data.get('username') ?? ''), String(data.get('password') ?? ''));
    } catch (error) {
      showAuthError(error);
    }
  });

  document.querySelector<HTMLFormElement>('#auth-register-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    try {
      clientState.clearError();
      await clientState.authRegister(
        String(data.get('username') ?? ''),
        String(data.get('password') ?? ''),
        String(data.get('inviteCode') ?? '')
      );
    } catch (error) {
      showAuthError(error);
    }
  });
}

function showAuthError(error: unknown): void {
  const msg = error instanceof Error ? error.message : '操作失败。';
  const panel = document.querySelector('.auth-panel');
  if (panel) {
    const existingError = panel.querySelector('[role="alert"]');
    if (existingError) {
      existingError.textContent = msg;
    } else {
      const errorEl = document.createElement('p');
      errorEl.setAttribute('role', 'alert');
      errorEl.className = 'error';
      errorEl.textContent = msg;
      panel.insertBefore(errorEl, panel.querySelector('.auth-tabs'));
    }
  }
}

/* ── Auth controls (inside lobby/game) ── */

function bindAuthControls(): void {
  document.querySelector<HTMLButtonElement>('#auth-logout-btn')?.addEventListener('click', () => {
    clientState.authLogout();
  });

  document.querySelector<HTMLButtonElement>('#auth-show-invite-codes')?.addEventListener('click', async () => {
    try {
      const token = clientState.authGetToken();
      if (!token) return;
      const res = await fetch('/api/admin/invite-codes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? '获取邀请码列表失败。');

      // Insert invite codes panel after user status bar
      const existing = document.getElementById('invite-codes-panel');
      if (existing) {
        existing.remove();
      }
      const statusBar = document.querySelector('.user-status-bar');
      statusBar?.insertAdjacentHTML('afterend', renderInviteCodesSection(data.inviteCodes));
      syncInviteCodeEvents();
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败。');
    }
  });
}

function syncInviteCodeEvents(): void {
  document.querySelector<HTMLButtonElement>('#auth-generate-invite-code')?.addEventListener('click', async () => {
    try {
      const token = clientState.authGetToken();
      if (!token) return;
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? '生成邀请码失败。');

      const resultEl = document.getElementById('invite-code-result');
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `新邀请码已生成：<strong><code>${data.code}</code></strong> （请立即分享给需要注册的成员）`;
      }

      // Refresh invite code list
      const refreshRes = await fetch('/api/admin/invite-codes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const refreshData = await refreshRes.json();
      if (refreshRes.ok) {
        const tbody = document.querySelector('.invite-codes-table tbody');
        if (tbody) {
          const rows = refreshData.inviteCodes.map((c: { code: string; createdBy: string; createdAt: string; usedBy: string | null; usedAt: string | null }) => {
            const used = c.usedBy
              ? `<span class="badge used-badge">已使用（${escapeHtml(c.usedBy)}）</span>`
              : `<span class="badge available-badge">可用</span>`;
            return `<tr>
              <td><code>${escapeHtml(c.code)}</code></td>
              <td>${escapeHtml(c.createdBy)}</td>
              <td>${new Date(c.createdAt).toLocaleDateString('zh-CN')}</td>
              <td>${used}</td>
            </tr>`;
          }).join('');
          tbody.innerHTML = rows || '<tr><td colspan="4" class="muted">暂无邀请码。</td></tr>';
        }
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败。');
    }
  });

  document.querySelector<HTMLButtonElement>('#auth-close-invite-codes')?.addEventListener('click', () => {
    document.getElementById('invite-codes-panel')?.remove();
  });
}

/* ── Existing game form bindings ── */

function bindForms(): void {
  document.querySelector<HTMLFormElement>('#create-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await runAction(() => clientState.createRoom(String(data.get('nickname') ?? '')));
  });

  document.querySelector<HTMLFormElement>('#join-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await runAction(() => clientState.joinRoom(String(data.get('roomCode') ?? ''), String(data.get('nickname') ?? '')));
  });

  document.querySelector<HTMLFormElement>('#reconnect-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await runAction(() => clientState.reconnect(String(data.get('roomCode') ?? '')));
  });

  document.querySelector<HTMLFormElement>('#chat-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = String(data.get('text') ?? '').trim();
    if (text) clientState.sendChat(text);
    event.currentTarget.reset();
  });
}

function bindGameControls(): void {
  bindCardClickHandlers();

  document.querySelector<HTMLButtonElement>('#start-game')?.addEventListener('click', () => clientState.startGame());
  document.querySelector<HTMLButtonElement>('#leave-room')?.addEventListener('click', () => clientState.leaveRoom());
  document.querySelector<HTMLButtonElement>('#advance-vote')?.addEventListener('click', () => clientState.advanceToVote());

  document.querySelectorAll<HTMLButtonElement>('[data-vote]').forEach((button) => {
    button.addEventListener('click', () => clientState.castVote(Number(button.dataset.vote)));
  });
}

function syncCountdownRenderLoop(snapshot = clientState.getSnapshot()): void {
  const shouldRun = isTimedPhaseView(snapshot.publicView);
  if (shouldRun && countdownRenderLoop === null) {
    countdownRenderLoop = window.setInterval(render, 1000);
    return;
  }
  if (!shouldRun && countdownRenderLoop !== null) {
    window.clearInterval(countdownRenderLoop);
    countdownRenderLoop = null;
  }
}

async function runAction(action: () => Promise<void>): Promise<void> {
  try {
    clientState.clearError();
    await action();
  } catch (error) {
    alert(error instanceof Error ? error.message : '操作失败');
  }
}

/* ── Helpers ── */

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
