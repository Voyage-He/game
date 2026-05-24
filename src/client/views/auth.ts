import { escapeHtml } from './util.js';

interface AuthState {
  authUser: { username: string } | null;
  authToken: string | null;
}

export function renderAuthPage(error?: string): string {
  return `
    <section class="panel auth-panel" aria-labelledby="auth-title">
      <h1 id="auth-title">🃏 在线房间游戏</h1>
      <p class="muted">已有账号？登陆后保持身份，房间昵称自动填充。</p>
      ${error ? `<p role="alert" class="error">${escapeHtml(error)}</p>` : ''}

      <div class="auth-tabs" role="tablist">
        <button class="auth-tab active" data-tab="login" role="tab" aria-selected="true">登陆</button>
        <button class="auth-tab" data-tab="register" role="tab" aria-selected="false">注册新账号</button>
      </div>

      <form id="auth-login-form" class="auth-form">
        <label>
          用户名
          <input name="username" required maxlength="20" autocomplete="username" />
        </label>
        <label>
          密码
          <input name="password" type="password" required autocomplete="current-password" />
        </label>
        <button type="submit">登陆</button>
      </form>

      <form id="auth-register-form" class="auth-form" hidden>
        <label>
          用户名
          <input name="username" required maxlength="20" autocomplete="off" />
        </label>
        <label>
          邀请码
          <input name="inviteCode" required maxlength="20" autocomplete="off" autocapitalize="characters" />
        </label>
        <label>
          密码（至少 4 位）
          <input name="password" type="password" required minlength="4" autocomplete="new-password" />
        </label>
        <button type="submit">注册并登陆</button>
      </form>

      <p class="auth-skip">
        <a href="#" id="auth-skip-link">跳过，直接开始游戏</a>
      </p>
    </section>
  `;
}

export function renderUserStatusBar(authState: AuthState): string {
  if (!authState.authUser) return '';
  return `
    <div class="user-status-bar">
      <span class="user-status-info">已登录：<strong>${escapeHtml(authState.authUser.username)}</strong></span>
      <span class="user-status-actions">
        <button id="auth-show-invite-codes" class="btn-small">邀请码管理</button>
        <button id="auth-logout-btn" class="btn-small btn-outline">登出</button>
      </span>
    </div>
  `;
}

export function renderInviteCodesSection(codes: Array<{ code: string; createdBy: string; createdAt: string; usedBy: string | null; usedAt: string | null }>): string {
  const rows = codes.map((c) => {
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

  return `
    <div class="panel invite-codes-panel" id="invite-codes-panel">
      <h2>邀请码管理</h2>
      <button id="auth-generate-invite-code" class="btn-primary">生成新邀请码</button>
      <p id="invite-code-result" class="invite-code-result" style="display:none"></p>
      <div class="invite-codes-table-wrap">
        <table class="invite-codes-table">
          <thead>
            <tr>
              <th>邀请码</th>
              <th>创建者</th>
              <th>创建时间</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4" class="muted">暂无邀请码。</td></tr>'}
          </tbody>
        </table>
      </div>
      <button id="auth-close-invite-codes" class="btn-small btn-outline">关闭</button>
    </div>
  `;
}

export function bindAuthEvents(): void {
  const loginForm = document.querySelector<HTMLFormElement>('#auth-login-form');
  const registerForm = document.querySelector<HTMLFormElement>('#auth-register-form');

  // Tab switching
  document.querySelectorAll<HTMLButtonElement>('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('.auth-tab').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const target = tab.dataset.tab;
      loginForm?.toggleAttribute('hidden', target !== 'login');
      registerForm?.toggleAttribute('hidden', target !== 'register');
    });
  });

  // Skip link
  document.querySelector<HTMLAnchorElement>('#auth-skip-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    const { clientState } = window as unknown as { clientState: { authHidePage: () => void } };
    clientState.authHidePage();
  });
}
