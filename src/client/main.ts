import './styles/main.css';
import { clientState } from './state.js';
import { renderLobby } from './views/lobby.js';
import { renderGame } from './views/game.js';
import { renderChat } from './views/chat.js';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');

clientState.subscribe(render);
render();

function render(): void {
  const snapshot = clientState.getSnapshot();
  const inRoom = Boolean(snapshot.publicView || snapshot.currentRoomCode);
  app.innerHTML = `
    ${!snapshot.publicView || snapshot.publicView.status === 'waiting' ? renderLobby(snapshot) : renderGame(snapshot)}
    ${inRoom ? renderChat(snapshot.chatMessages, snapshot.publicView?.phase === 'free_speech') : ''}
  `;
  bindForms();
  bindGameControls();
}

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
  document.querySelector<HTMLButtonElement>('#start-game')?.addEventListener('click', () => clientState.startGame());
  document.querySelector<HTMLButtonElement>('#advance-vote')?.addEventListener('click', () => clientState.advanceToVote());

  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      const payload = button.dataset.payload ? JSON.parse(button.dataset.payload) : {};
      if (action) clientState.sendRoleAction(action, payload);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-vote]').forEach((button) => {
    button.addEventListener('click', () => clientState.castVote(Number(button.dataset.vote)));
  });
}

async function runAction(action: () => Promise<void>): Promise<void> {
  try {
    clientState.clearError();
    await action();
  } catch (error) {
    alert(error instanceof Error ? error.message : '操作失败');
  }
}
