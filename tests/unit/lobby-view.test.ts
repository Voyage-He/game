import { describe, expect, it } from 'vitest';
import { renderLobby } from '../../src/client/views/lobby.js';
import type { ClientStateSnapshot } from '../../src/client/state.js';
import type { PrivateRoomView, PublicRoomView } from '../../src/shared/types.js';

function snapshot(publicOverrides: Partial<PublicRoomView> = {}, privateOverrides: Partial<PrivateRoomView> = {}): ClientStateSnapshot {
  const publicView: PublicRoomView = {
    roomCode: 'ABC123',
    status: 'waiting',
    version: 1,
    players: [
      { seatIndex: 0, nickname: '阿明', isOwner: true, connectionStatus: 'connected' }
    ],
    serverNow: '2026-05-24T12:00:00.000Z',
    ...publicOverrides
  };
  const privateView: PrivateRoomView = {
    seatIndex: 0,
    initialRole: null,
    currentEligibleAction: null,
    revealedCards: [],
    submittedVote: null,
    ...privateOverrides
  };
  return {
    publicView,
    privateView,
    settlement: null,
    chatMessages: [],
    error: null,
    currentRoomCode: publicView.roomCode,
    currentSeatIndex: privateView.seatIndex,
    connected: true,
    serverClockOffsetMs: 0,
    animatedCardKeys: new Set(),
    selectionState: {
      actionSubmitted: false,
      wolfSelectedUnderwater: null,
      seerActionMode: 'idle',
      seerUnderwaterClicked: [],
      seerPlayerSelected: null,
      robberSelectedSeat: null,
      troublemakerSelected: [],
      waterGhostSelectedUnderwater: null
    }
  };
}

describe('waiting-room lobby personnel panel', () => {
  it('shows current personnel, owner/self markers, capacity, and missing-player reason', () => {
    const html = renderLobby(snapshot());

    expect(html).toContain('当前人员');
    expect(html).toContain('1/3');
    expect(html).toContain('阿明');
    expect(html).toContain('房主');
    expect(html).toContain('你');
    expect(html).toContain('还需 2 人加入后才能开始');
    expect(html.match(/等待加入/g)).toHaveLength(2);
    expect(html.match(/<button id="start-game"[^>]*>/)?.[0]).toContain('disabled');
  });

  it('enables the owner to start only when three players are online', () => {
    const html = renderLobby(snapshot({
      players: [
        { seatIndex: 0, nickname: '阿明', isOwner: true, connectionStatus: 'connected' },
        { seatIndex: 1, nickname: '小红', isOwner: false, connectionStatus: 'connected' },
        { seatIndex: 2, nickname: '小李', isOwner: false, connectionStatus: 'connected' }
      ]
    }));

    expect(html).toContain('3/3');
    expect(html).toContain('三名玩家已在线，房主可以开始游戏');
    expect(html.match(/<button id="start-game"[^>]*>/)?.[0]).not.toContain('disabled');
  });

  it('shows non-owners a waiting-for-owner prompt instead of a start button', () => {
    const html = renderLobby(snapshot({
      players: [
        { seatIndex: 0, nickname: '阿明', isOwner: true, connectionStatus: 'connected' },
        { seatIndex: 1, nickname: '小红', isOwner: false, connectionStatus: 'connected' },
        { seatIndex: 2, nickname: '小李', isOwner: false, connectionStatus: 'connected' }
      ]
    }, { seatIndex: 1 }));

    expect(html).toContain('三名玩家已在线，等待房主开始游戏');
    expect(html).not.toContain('id="start-game"');
  });

  it('explains that disconnected members block game start', () => {
    const html = renderLobby(snapshot({
      players: [
        { seatIndex: 0, nickname: '阿明', isOwner: true, connectionStatus: 'connected' },
        { seatIndex: 1, nickname: '小红', isOwner: false, connectionStatus: 'disconnected' },
        { seatIndex: 2, nickname: '小李', isOwner: false, connectionStatus: 'connected' }
      ]
    }));

    expect(html).toContain('需要所有成员在线后才能开始');
    expect(html).toContain('离线');
    expect(html.match(/<button id="start-game"[^>]*>/)?.[0]).toContain('disabled');
  });

  it('does not expose private identity or underwater card information before start', () => {
    const html = renderLobby(snapshot({}, { initialRole: '狼人' }));

    expect(html).not.toContain('狼人');
    expect(html).not.toContain('水下的牌');
  });
});
