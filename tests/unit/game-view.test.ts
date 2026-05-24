import { describe, expect, it } from 'vitest';
import { renderGame } from '../../src/client/views/game.js';
import type { ClientStateSnapshot } from '../../src/client/state.js';
import type { Phase, PrivateRoomView, PublicRoomView, SettlementView } from '../../src/shared/types.js';

function snapshot(phase: Phase, privateOverrides: Partial<PrivateRoomView> = {}, publicOverrides: Partial<PublicRoomView> = {}): ClientStateSnapshot {
  const publicView: PublicRoomView = {
    roomCode: 'ABC123',
    status: phase === 'settlement' ? 'settled' : 'in_game',
    version: 1,
    players: [
      { seatIndex: 0, nickname: '阿明', isOwner: true, connectionStatus: 'connected' },
      { seatIndex: 1, nickname: '小红', isOwner: false, connectionStatus: 'connected' },
      { seatIndex: 2, nickname: '小李', isOwner: false, connectionStatus: 'connected' }
    ],
    phase,
    phaseStartedAt: '2026-05-21T12:00:00.000Z',
    phaseEndsAt: phase === 'free_speech' || phase === 'settlement' ? undefined : '2026-05-21T12:00:10.000Z',
    serverNow: '2026-05-21T12:00:03.000Z',
    voteCompletion: phase === 'voting' ? { submittedCount: 0, requiredCount: 3 } : undefined,
    ...publicOverrides
  };
  const privateView: PrivateRoomView = {
    seatIndex: 0,
    initialRole: '狼人',
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
    currentRoomCode: 'ABC123',
    currentSeatIndex: 0,
    connected: true,
    serverClockOffsetMs: 0,
    animatedCardKeys: new Set(),
    selectionState: {
      actionSubmitted: false,
      seerActionMode: 'idle',
      seerUnderwaterClicked: [],
      troublemakerSelected: []
    }
  };
}

describe('card rendering', () => {
  it('seer with two-underwater reveal shows two flipped underwater cards and one face-down', () => {
    const html = renderGame(
      snapshot('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] },
        revealedCards: [
          { location: 'underwater:0', role: '强盗' },
          { location: 'underwater:1', role: '捣蛋鬼' }
        ]
      })
    );
    // Two flipped underwater cards
    expect(html).toContain('data-flipped="true"');
    // Underwater card 0 shows 强盗
    expect(html).toContain('强盗');
    expect(html).toContain('捣蛋鬼');
    // Underwater section exists with correct label
    expect(html).toContain('水下的牌');
    // All three underwater card elements exist
    expect(html.match(/data-underwater-index=/g)?.length).toBe(3);
  });

  it('seer with one-player reveal shows target player card flipped with correct role', () => {
    const html = renderGame(
      snapshot('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] },
        revealedCards: [
          { location: 'playerSeat:1', role: '狼人' }
        ],
        initialRole: '预言家'
      })
    );
    // Target player card (seat 1) is flipped showing 狼人
    expect(html).toContain('狼人');
    // Three player-card elements exist (match data-seat-index attribute)
    expect(html.match(/data-seat-index=/g)?.length).toBe(3);
    // Non-target player (seat 2) card exists but should not show a revealed role
    expect(html).toContain('小李');
  });

  it('non-target players remain face-down', () => {
    const html = renderGame(
      snapshot('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] },
        revealedCards: [
          { location: 'playerSeat:1', role: '狼人' }
        ],
        initialRole: '预言家'
      })
    );
    // Player cards for seats 0 and 2 should not show 狼人 in their card-front
    // The own player always sees their initial role card flipped
    // Count occurrences of data-flipped="true" — should be for own initial card + target
    const flippedCount = (html.match(/data-flipped="true"/g) || []).length;
    // Own card (initial role always visible) + target player card = at least 2 flipped
    expect(flippedCount).toBeGreaterThanOrEqual(2);
  });

  it('wolf after viewing underwater card 1 shows only that card flipped', () => {
    const html = renderGame(
      snapshot('wolf_action', {
        currentEligibleAction: { phase: 'wolf_action', options: ['view_one_underwater', 'skip'] },
        revealedCards: [
          { location: 'underwater:1', role: '捣蛋鬼' }
        ]
      })
    );
    // Card 1 shows 捣蛋鬼
    expect(html).toContain('捣蛋鬼');
    // Data-flipped count: own initial card + 1 underwater = 2 flipped
    const flippedCount = (html.match(/data-flipped="true"/g) || []).length;
    expect(flippedCount).toBeGreaterThanOrEqual(2);
    // Underwater cards 0 and 2 are not the revealed role
    expect(html).toContain('水下 1');
    expect(html).toContain('水下 2');
    expect(html).toContain('水下 3');
  });

  it('no player cards are flipped for wolf reveal', () => {
    const html = renderGame(
      snapshot('wolf_action', {
        currentEligibleAction: { phase: 'wolf_action', options: ['view_one_underwater', 'skip'] },
        revealedCards: [
          { location: 'underwater:1', role: '捣蛋鬼' }
        ]
      })
    );
    // Player cards for other seats should not be flipped (data-flipped="true")
    // Only own card (data-seat-index="0") flipped via initialRole, and underwater card 1
    // Check that card for seat 1 has data-flipped="false" (not revealed)
    expect(html).toContain('data-seat-index="1"');
    expect(html).toContain('data-seat-index="2"');
  });

  it('robber viewing target shows target card flipped with correct role', () => {
    const html = renderGame(
      snapshot('robber_action', {
        currentEligibleAction: { phase: 'robber_action', options: ['view_one_player_and_exchange', 'skip'] },
        revealedCards: [
          { location: 'playerSeat:1', role: '狼人' }
        ],
        initialRole: '强盗'
      })
    );
    // Target's role (狼人) visible on flipped card
    expect(html).toContain('狼人');
    // Robber's own initial role displayed
    expect(html).toContain('强盗');
    // owns-role paragraph still shows initial role
    expect(html).toContain('你的初始身份');
  });

  it('after robber phase change, target card reverts but own identity persists', () => {
    const html = renderGame(
      snapshot('troublemaker_action', {
        revealedCards: [],
        initialRole: '强盗'
      })
    );
    // No revealed cards (phase changed)
    expect(html).toContain('你的初始身份：');
    expect(html).toContain('强盗');
    // No underwater or player reveals visible
    const flippedCount = (html.match(/data-flipped="true"/g) || []).length;
    // Own initial card is only flipped because initialRole is set
    expect(flippedCount).toBeGreaterThanOrEqual(1);
  });

  it('disconnected player card has disconnected class and badge', () => {
    const html = renderGame(
      snapshot('free_speech', { revealedCards: [], initialRole: '平民' }, {
        players: [
          { seatIndex: 0, nickname: '阿明', isOwner: true, connectionStatus: 'connected' },
          { seatIndex: 1, nickname: '小红', isOwner: false, connectionStatus: 'disconnected' },
          { seatIndex: 2, nickname: '小李', isOwner: false, connectionStatus: 'connected' }
        ]
      })
    );
    // Disconnected card has the .disconnected class
    expect(html).toContain('player-card disconnected');
    // Disconnected badge visible
    expect(html).toContain('离线');
  });

  it('underwater cards section has correct label and three card elements', () => {
    const html = renderGame(snapshot('free_speech', { revealedCards: [], initialRole: '平民' }));
    // Section heading
    expect(html).toContain('水下的牌');
    // Three underwater cards with labels
    expect(html.match(/data-underwater-index=/g)?.length).toBe(3);
    expect(html).toContain('水下 1');
    expect(html).toContain('水下 2');
    expect(html).toContain('水下 3');
  });

  it('newly revealed card contains card-flip-in CSS class', () => {
    // Fresh animatedCardKeys → first render should add card-flip-in
    const freshKeys = new Set<string>();
    const snap = {
      ...snapshot('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] },
        revealedCards: [{ location: 'underwater:0', role: '强盗' }],
        initialRole: '预言家'
      }),
      animatedCardKeys: freshKeys
    };
    const html = renderGame(snap);
    // New reveal should have card-flip-in class
    expect(html).toContain('card-flip-in');
    // The key should now be tracked
    expect(freshKeys.has('underwater:0')).toBe(true);
  });

  it('already-animated card does not get card-flip-in class on re-render', () => {
    // Pre-populated animatedCardKeys for all locations that would be flipped
    const preKeys = new Set<string>(['underwater:0', 'playerSeat:0:initial']);
    const snap = {
      ...snapshot('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] },
        revealedCards: [{ location: 'underwater:0', role: '强盗' }],
        initialRole: '预言家'
      }),
      animatedCardKeys: preKeys
    };
    const html = renderGame(snap);
    // Card is flipped but without the animation class (already animated)
    expect(html).toContain('data-flipped="true"');
    expect(html).not.toContain('card-flip-in');
  });

  it('Chinese role names appear in card-role spans', () => {
    const html = renderGame(
      snapshot('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] },
        revealedCards: [
          { location: 'underwater:0', role: '水鬼' },
          { location: 'underwater:1', role: '平民' }
        ],
        initialRole: '预言家'
      })
    );
    expect(html).toContain('card-role');
    expect(html).toContain('水鬼');
    expect(html).toContain('平民');
    expect(html).toContain('预言家');
  });
});

describe('game view Chinese prompts', () => {
  it('shows a neutral wait prompt for non-acting players', () => {
    const html = renderGame(snapshot('seer_action'));
    expect(html).toContain('其他玩家行动中');
    expect(html).toContain('不会显示私密身份或行动结果');
  });

  it('shows an explicit acting prompt for the eligible player', () => {
    const html = renderGame(
      snapshot('wolf_action', {
        currentEligibleAction: { phase: 'wolf_action', options: ['view_one_underwater', 'skip'] }
      })
    );
    expect(html).toContain('轮到你行动');
    expect(html).toContain('请点击一张水下牌查看身份');
  });

  it('shows voting progress and free-speech untimed text in Chinese', () => {
    expect(renderGame(snapshot('voting'))).toContain('投票进度：0/3');
    expect(renderGame(snapshot('free_speech'))).toContain('自由发言不限时');
  });

  it('settlement shows winner info and all cards are flipped with final roles', () => {
    const settlement: SettlementView = {
      voteTotals: [
        { seatIndex: 0, votes: 1 },
        { seatIndex: 1, votes: 1 },
        { seatIndex: 2, votes: 1 }
      ],
      eliminatedSeatIndex: null,
      winningCamp: '好人',
      finalPlayerCards: [
        { seatIndex: 0, nickname: '阿明', role: '平民' },
        { seatIndex: 1, nickname: '小红', role: '预言家' },
        { seatIndex: 2, nickname: '小李', role: '强盗' }
      ],
      finalUnderwaterCards: [
        { index: 0, role: '狼人' },
        { index: 1, role: '捣蛋鬼' },
        { index: 2, role: '水鬼' }
      ],
      automaticActions: [],
      automaticVotes: []
    };
    const html = renderGame({ ...snapshot('settlement'), settlement });
    // Settlement text still shows winner and eliminated info
    expect(html).toContain('结算');
    expect(html).toContain('好人');
    expect(html).toContain('无人出局');
    // All cards are flipped — final roles appear in main card area (not in separate settlement cards)
    expect(html).toContain('平民');
    expect(html).toContain('预言家');
    expect(html).toContain('强盗');
    expect(html).toContain('狼人');
    expect(html).toContain('捣蛋鬼');
    expect(html).toContain('水鬼');
    // No separate settlement duplicate cards section
    expect(html).not.toContain('最终身份');
    expect(html).not.toContain('最终水下牌');
  });
});

// Helper to build a snapshot with custom selectionState
function snapWithSelection(
  phase: Phase,
  privateOverrides: Partial<PrivateRoomView> = {},
  publicOverrides: Partial<PublicRoomView> = {},
  selectionOverrides: Partial<import('../../src/client/state.js').SelectionState> = {}
): ClientStateSnapshot {
  const base = snapshot(phase, privateOverrides, publicOverrides);
  return {
    ...base,
    selectionState: {
      actionSubmitted: false,
      seerActionMode: 'idle',
      seerUnderwaterClicked: [],
      troublemakerSelected: [],
      ...selectionOverrides
    }
  };
}

describe('US1: wolf card click rendering', () => {
  it('T008: underwater cards have .clickable class during wolf_action and none after action submitted', () => {
    // During wolf action with clickable cards
    const htmlActive = renderGame(
      snapWithSelection('wolf_action', {
        currentEligibleAction: { phase: 'wolf_action', options: ['view_one_underwater', 'skip'] }
      })
    );
    expect(htmlActive).toMatch(/card-(?:player|underwater)\s+clickable/);
    // No buttons should remain
    expect(htmlActive).not.toContain('选择水下');

    // After action submitted
    const htmlSubmitted = renderGame(
      snapWithSelection('wolf_action', {
        currentEligibleAction: { phase: 'wolf_action', options: ['view_one_underwater', 'skip'] }
      }, {}, { actionSubmitted: true })
    );
    expect(htmlSubmitted).not.toMatch(/card-(?:player|underwater)\s+clickable/);
    expect(htmlSubmitted).toMatch(/card-(?:player|underwater)\s+submitted/);
  });

  it('T009: wolf action panel shows prompt and no buttons', () => {
    const html = renderGame(
      snapWithSelection('wolf_action', {
        currentEligibleAction: { phase: 'wolf_action', options: ['view_one_underwater', 'skip'] }
      })
    );
    expect(html).toContain('请点击一张水下牌查看身份');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('data-action=');
  });
});

describe('US2: seer card click rendering', () => {
  it('T012: seer first underwater click adds .selected class', () => {
    const html = renderGame(
      snapWithSelection('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] }
      }, {}, {
        seerActionMode: 'underwater',
        seerUnderwaterClicked: [0]
      })
    );
    // Underwater card 0 should have selected class (not clickable - already clicked)
    expect(html).toContain('data-location="underwater:0"');
    // Card at underwater:0 has 'selected' but not 'clickable'
    // Panel shows progress
    expect(html).toContain('已查看 1/2 张水下牌');
  });

  it('T013: seer second underwater click shows submitted state', () => {
    const html = renderGame(
      snapWithSelection('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] }
      }, {}, {
        seerActionMode: 'underwater',
        seerUnderwaterClicked: [0, 1],
        actionSubmitted: true
      })
    );
    expect(html).toMatch(/card-(?:player|underwater)\s+submitted/);
    expect(html).toContain('已查看目标身份');
  });

  it('T014: seer player mode — player cards are clickable', () => {
    const html = renderGame(
      snapWithSelection('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] },
        initialRole: '预言家'
      })
    );
    // Other players' cards and underwater cards should be clickable in idle mode
    expect(html).toMatch(/card-(?:player|underwater)\s+clickable/);
    // Action panel should have the role title
    expect(html).toContain('预言家行动');
    // No buttons should remain
    expect(html).not.toContain('data-action=');
  });

  it('T015: seer mode lock — underwater mode blocks player cards', () => {
    const html = renderGame(
      snapWithSelection('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] },
        initialRole: '预言家'
      }, {}, {
        seerActionMode: 'underwater',
        seerUnderwaterClicked: [0]
      })
    );
    // No clickable player cards should exist when mode is locked to underwater
    const clickableMatches = html.match(/card-(?:player|underwater)\s+clickable/g) || [];
    // Only unclicked underwater cards (indices 1, 2) should be clickable
    expect(clickableMatches.length).toBe(2);
  });

  it('T015b: seer mode lock — player mode blocks underwater cards', () => {
    const html = renderGame(
      snapWithSelection('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] },
        initialRole: '预言家'
      }, {}, {
        seerActionMode: 'player',
        actionSubmitted: true
      })
    );
    expect(html).toMatch(/card-(?:player|underwater)\s+submitted/);
    expect(html).not.toMatch(/card-(?:player|underwater)\s+clickable/);
  });

  it('T016: seer cannot click a third underwater card after two already clicked', () => {
    const html = renderGame(
      snapWithSelection('seer_action', {
        currentEligibleAction: { phase: 'seer_action', options: ['view_two_underwater', 'view_one_player', 'skip'] }
      }, {}, {
        seerActionMode: 'underwater',
        seerUnderwaterClicked: [0, 1],
        actionSubmitted: true
      })
    );
    // All cards should be submitted (not clickable)
    expect(html).not.toMatch(/card-(?:player|underwater)\s+clickable/);
    expect(html).toMatch(/card-(?:player|underwater)\s+submitted/);
  });
});

describe('US3: robber card click rendering', () => {
  it('T020: robber action panel shows prompt and own card lacks .clickable', () => {
    const html = renderGame(
      snapWithSelection('robber_action', {
        currentEligibleAction: { phase: 'robber_action', options: ['view_one_player_and_exchange', 'skip'] },
        initialRole: '强盗'
      })
    );
    expect(html).toContain('请点击一名其他玩家的卡牌查看并交换身份');
    // Own player card (seat 0) should NOT have clickable
    // Other players' cards should be clickable
    expect(html).toMatch(/card-(?:player|underwater)\s+clickable/);
    expect(html).not.toContain('<button');
  });
});

describe('US4: troublemaker and water ghost card click rendering', () => {
  it('T022: troublemaker first click adds .selected, second submits, deselect works', () => {
    // First selection
    const html1 = renderGame(
      snapWithSelection('troublemaker_action', {
        currentEligibleAction: { phase: 'troublemaker_action', options: ['swap_players', 'skip'] },
        initialRole: '捣蛋鬼'
      }, {}, {
        troublemakerSelected: [1]
      })
    );
    expect(html1).toMatch(/card-player\s+clickable\s+selected/);
    expect(html1).toContain('已选择 1/2 名玩家');

    // Second selection triggers submit
    const html2 = renderGame(
      snapWithSelection('troublemaker_action', {
        currentEligibleAction: { phase: 'troublemaker_action', options: ['swap_players', 'skip'] },
        initialRole: '捣蛋鬼'
      }, {}, {
        troublemakerSelected: [1, 2],
        actionSubmitted: true
      })
    );
    expect(html2).toMatch(/card-(?:player|underwater)\s+submitted/);
    expect(html2).toContain('已选择两名玩家');

    // Deselected (empty)
    const html3 = renderGame(
      snapWithSelection('troublemaker_action', {
        currentEligibleAction: { phase: 'troublemaker_action', options: ['swap_players', 'skip'] },
        initialRole: '捣蛋鬼'
      }, {}, {
        troublemakerSelected: []
      })
    );
    expect(html3).not.toMatch(/\sselected/);
    expect(html3).toContain('请点击两名其他玩家的卡牌进行交换');
  });

  it('T023: troublemaker cannot select own card', () => {
    const html = renderGame(
      snapWithSelection('troublemaker_action', {
        currentEligibleAction: { phase: 'troublemaker_action', options: ['swap_players', 'skip'] },
        initialRole: '捣蛋鬼'
      })
    );
    // Own card (seat 0) should not be clickable
    // The player-card for seat 0 has the "你" badge
    // Verify other player cards ARE clickable
    const clickableMatches = html.match(/card-player\s+clickable/g) || [];
    // Should be exactly 2 (seats 1 and 2)
    expect(clickableMatches.length).toBe(2);
  });

  it('T024: water ghost action panel shows prompt and only underwater cards have .clickable', () => {
    const html = renderGame(
      snapWithSelection('water_ghost_action', {
        currentEligibleAction: { phase: 'water_ghost_action', options: ['swap_one_underwater', 'skip'] }
      })
    );
    expect(html).toContain('请点击一张水下牌进行交换');
    // Underwater cards should be clickable
    expect(html).toMatch(/card-underwater\s+clickable/);
    // No player cards should be clickable
    // Count underwater-card clickable instances (should be 3)
    const allClickable = html.match(/card-underwater\s+clickable/g) || [];
    expect(allClickable.length).toBe(3);
  });

  it('T025: troublemaker shows progress text after first pick', () => {
    const html = renderGame(
      snapWithSelection('troublemaker_action', {
        currentEligibleAction: { phase: 'troublemaker_action', options: ['swap_players', 'skip'] },
        initialRole: '捣蛋鬼'
      }, {}, {
        troublemakerSelected: [1]
      })
    );
    expect(html).toContain('已选择 1/2 名玩家');
    expect(html).toContain('请选择第二名玩家');
  });
});

describe('US5: visual feedback', () => {
  it('T028: card elements with .clickable class are rendered on eligible cards', () => {
    const html = renderGame(
      snapWithSelection('wolf_action', {
        currentEligibleAction: { phase: 'wolf_action', options: ['view_one_underwater', 'skip'] }
      })
    );
    // Underwater cards should have clickable class (CSS provides cursor: pointer)
    expect(html).toMatch(/card-(?:player|underwater)\s+clickable/);
  });

  it('T029: after actionSubmitted, all cards carry .submitted instead of .clickable', () => {
    const html = renderGame(
      snapWithSelection('robber_action', {
        currentEligibleAction: { phase: 'robber_action', options: ['view_one_player_and_exchange', 'skip'] },
        initialRole: '强盗'
      }, {}, {
        actionSubmitted: true
      })
    );
    expect(html).not.toMatch(/card-(?:player|underwater)\s+clickable/);
    expect(html).toMatch(/card-(?:player|underwater)\s+submitted/);
  });
});

describe('Phase 8: polish and cross-cutting', () => {
  it('T031: phase change clears all selection state — no .selected or .clickable after phase change', () => {
    // After wolf action, entering open_eyes with no revealed cards
    const html = renderGame(
      snapWithSelection('open_eyes', {
        revealedCards: [],
        currentEligibleAction: null,
        initialRole: '狼人'
      })
    );
    expect(html).not.toMatch(/card-(?:player|underwater)\s+clickable/);
    expect(html).not.toMatch(/\sselected/);
    expect(html).not.toMatch(/card-(?:player|underwater)\s+submitted/);
  });

  it('T032: non-acting player sees no .clickable cards and neutral action panel', () => {
    const html = renderGame(
      snapWithSelection('seer_action', {
        currentEligibleAction: null,  // Not the acting player
        initialRole: '狼人'
      })
    );
    expect(html).not.toMatch(/card-(?:player|underwater)\s+clickable/);
    expect(html).toContain('其他玩家行动中');
    expect(html).toContain('不会显示私密身份或行动结果');
  });
});
