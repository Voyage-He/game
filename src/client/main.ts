import './styles/main.css';
import { clientState, isTimedPhaseView } from './state.js';
import { renderLobby } from './views/lobby.js';
import { renderGame, bindCardClickHandlers } from './views/game.js';
import { renderChat } from './views/chat.js';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');

let countdownRenderLoop: number | null = null;

clientState.subscribe(render);
render();

function render(): void {
  // Preserve in-progress chat input across re-renders
  const chatInput = document.querySelector<HTMLInputElement>('#chat-form input[name="text"]');
  const pendingChatText = chatInput?.value ?? '';

  const snapshot = clientState.getSnapshot();
  const inRoom = Boolean(snapshot.publicView || snapshot.currentRoomCode);
  app.innerHTML = `
    ${!snapshot.publicView || snapshot.publicView.status === 'waiting' ? renderLobby(snapshot) : renderGame(snapshot)}
    ${inRoom ? renderChat(snapshot.chatMessages, snapshot.publicView?.phase === 'free_speech') : ''}
  `;
  bindForms();
  bindGameControls();
  syncCountdownRenderLoop(snapshot);

  // Restore in-progress chat input text
  if (pendingChatText) {
    const newInput = document.querySelector<HTMLInputElement>('#chat-form input[name="text"]');
    if (newInput && !newInput.disabled) {
      newInput.value = pendingChatText;
    }
  }
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
