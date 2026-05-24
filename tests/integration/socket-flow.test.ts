import { io as createClient } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setPhase } from '../../src/server/game/engine.js';
import { emitRoomState } from '../../src/server/realtime/socket-server.js';
import type { PrivateRoomView, PublicRoomView, SettlementView } from '../../src/shared/types.js';
import {
  closeSocketTestContext,
  connectSeats,
  createSocketTestContext,
  createThreeSeats,
  forceRoles,
  waitForEvent,
  type SocketTestContext
} from '../helpers/socket-fixtures.js';

let context: SocketTestContext;

beforeEach(async () => {
  context = await createSocketTestContext({ phaseTimeScale: 1, votingTimeoutMs: 1000 });
});

afterEach(async () => {
  await closeSocketTestContext(context);
});

describe('Socket.IO room flow contracts', () => {
  it('broadcasts start, chat, vote progress, per-update latency, and settlement', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    const publicEvent = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.phase === 'close_eyes');
    sockets[0]!.emit('room:start', {});
    const started = await publicEvent;
    expect(started.players).toHaveLength(3);

    const chatEvent = waitForEvent(sockets[1]!, 'chat:message');
    sockets[0]!.emit('chat:send', { text: '我觉得狼人不在场。' });
    expect((await chatEvent).text).toContain('狼人');

    const room = setPhase(context.store.requireRoom(seats.roomCode), 'voting', context.handle.timers.engineOptions());
    const votingBroadcast = waitForEvent<PublicRoomView>(sockets[2]!, 'state:public', (view) => view.phase === 'voting');
    context.handle.timers.replaceAndSchedule(room);
    const voting = await votingBroadcast;
    const receivedAt = Date.now();
    expect(receivedAt - new Date(voting.phaseStartedAt!).getTime()).toBeLessThan(2000);

    const settlementEvent0 = waitForEvent<SettlementView>(sockets[0]!, 'settlement:shown');
    const settlementEvent1 = waitForEvent<SettlementView>(sockets[1]!, 'settlement:shown');
    const settlementEvent2 = waitForEvent<SettlementView>(sockets[2]!, 'settlement:shown');
    sockets[0]!.emit('vote:cast', { targetSeatIndex: 1 });
    sockets[1]!.emit('vote:cast', { targetSeatIndex: 2 });
    sockets[2]!.emit('vote:cast', { targetSeatIndex: 0 });
    const [s0, s1, s2] = await Promise.all([settlementEvent0, settlementEvent1, settlementEvent2]);
    expect(s0.voteTotals.map((total) => total.votes)).toEqual([1, 1, 1]);
    expect(s1.voteTotals.map((total) => total.votes)).toEqual([1, 1, 1]);
    expect(s2.voteTotals.map((total) => total.votes)).toEqual([1, 1, 1]);
  });

  it('emits calibrated countdown timestamps and preserves deadlines across reconnect, actions, and votes', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);

    const startEvent = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.phase === 'close_eyes');
    sockets[0]!.emit('room:start', {});
    const started = await startEvent;
    expect(started.serverNow).toBeTruthy();
    expect(started.phaseEndsAt).toBeTruthy();

    sockets[1]!.disconnect();
    const reconnected = createClient(`${context.baseUrl}/rooms`, { auth: { roomCode: seats.roomCode, reconnectToken: seats.tokens[1] }, transports: ['websocket'] });
    context.clients.push(reconnected);
    const reconnectState = waitForEvent<PublicRoomView>(reconnected, 'state:public', (view) => view.phase === started.phase);
    await waitForEvent(reconnected, 'connect');
    const reconnectView = await reconnectState;
    expect(reconnectView.serverNow).toBeTruthy();
    expect(reconnectView.phaseEndsAt).toBe(started.phaseEndsAt);

    forceRoles(context, seats.roomCode, ['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);
    const wolfPhase = setPhase(context.store.requireRoom(seats.roomCode), 'wolf_action', context.handle.timers.engineOptions());
    const wolfDeadline = wolfPhase.phaseEndsAt;
    context.store.replaceRoom(wolfPhase);
    emitRoomState(context.handle.namespace, context.store, seats.roomCode);
    const actionUpdate = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.phase === 'wolf_action' && view.version > wolfPhase.version);
    sockets[0]!.emit('action:wolf', { underwaterIndex: 0 });
    expect((await actionUpdate).phaseEndsAt).toBe(wolfDeadline);

    const votingPhase = setPhase(context.store.requireRoom(seats.roomCode), 'voting', context.handle.timers.engineOptions());
    const votingDeadline = votingPhase.phaseEndsAt;
    const votingBroadcast = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.phase === 'voting');
    context.handle.timers.replaceAndSchedule(votingPhase);
    await votingBroadcast;
    const voteUpdate = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.phase === 'voting' && view.version > votingPhase.version);
    sockets[0]!.emit('vote:cast', { targetSeatIndex: 1 });
    expect((await voteUpdate).phaseEndsAt).toBe(votingDeadline);
  });

  it('validates all role action contracts and emits private action results', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    forceRoles(context, seats.roomCode, ['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);

    context.store.replaceRoom(setPhase(context.store.requireRoom(seats.roomCode), 'wolf_action', context.handle.timers.engineOptions()));
    emitRoomState(context.handle.namespace, context.store, seats.roomCode);
    const wolfResult = waitForEvent(sockets[0]!, 'action:result');
    sockets[0]!.emit('action:wolf', { underwaterIndex: 0 });
    expect((await wolfResult).revealedCards[0].role).toBe('捣蛋鬼');

    context.store.replaceRoom(setPhase(context.store.requireRoom(seats.roomCode), 'seer_action', context.handle.timers.engineOptions()));
    const seerResult = waitForEvent(sockets[1]!, 'action:result');
    sockets[1]!.emit('action:seer', { mode: 'view_two_underwater', underwaterIndexes: [0, 1] });
    expect((await seerResult).revealedCards).toHaveLength(2);

    context.store.replaceRoom(setPhase(context.store.requireRoom(seats.roomCode), 'robber_action', context.handle.timers.engineOptions()));
    const robberResult = waitForEvent(sockets[2]!, 'action:result');
    sockets[2]!.emit('action:robber', { targetSeatIndex: 0 });
    expect((await robberResult).exchangePerformed).toBe(true);

    forceRoles(context, seats.roomCode, ['捣蛋鬼', '水鬼', '平民'], ['狼人', '预言家', '强盗']);
    context.store.replaceRoom(setPhase(context.store.requireRoom(seats.roomCode), 'troublemaker_action', context.handle.timers.engineOptions()));
    const troubleResult = waitForEvent(sockets[0]!, 'action:result');
    sockets[0]!.emit('action:troublemaker', { targetSeatIndexes: [1, 2] });
    expect((await troubleResult).exchangePerformed).toBe(true);

    context.store.replaceRoom(setPhase(context.store.requireRoom(seats.roomCode), 'water_ghost_action', context.handle.timers.engineOptions()));
    const waterResult = waitForEvent(sockets[1]!, 'action:result');
    sockets[1]!.emit('action:water-ghost', { underwaterIndex: 0 });
    expect((await waterResult).exchangePerformed).toBe(true);
  });

  it('supports explicit skip for optional role actions without reveals', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    forceRoles(context, seats.roomCode, ['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);

    const wolfRoom = setPhase(context.store.requireRoom(seats.roomCode), 'wolf_action', context.handle.timers.engineOptions());
    context.store.replaceRoom(wolfRoom);
    emitRoomState(context.handle.namespace, context.store, seats.roomCode);

    const resultEvent = waitForEvent(sockets[0]!, 'action:result');
    const privateEvent = waitForEvent<PrivateRoomView>(sockets[0]!, 'state:private', (view) => view.currentEligibleAction === null);
    sockets[0]!.emit('action:skip', { phase: 'wolf_action' });

    const [result, privateView] = await Promise.all([resultEvent, privateEvent]);
    expect(result.revealedCards).toHaveLength(0);
    expect(result.exchangePerformed).toBe(false);
    expect(privateView.revealedCards.filter((card) => card.location.startsWith('underwater:'))).toHaveLength(0);
    expect(context.store.requireRoom(seats.roomCode).actions[0]).toMatchObject({ phase: 'wolf_action', selectedTargets: [] });
  });

  it('validates at least 95% of visible room state updates within 2 seconds', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    const latencies: number[] = [];

    for (let i = 0; i < 20; i += 1) {
      const room = context.store.requireRoom(seats.roomCode);
      room.version += 1;
      context.store.replaceRoom(room);
      const expectedVersion = room.version;
      const start = Date.now();
      const update = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.version === expectedVersion);
      emitRoomState(context.handle.namespace, context.store, seats.roomCode);
      await update;
      latencies.push(Date.now() - start);
    }

    const withinTarget = latencies.filter((value) => value < 2000).length;
    expect(withinTarget / latencies.length).toBeGreaterThanOrEqual(0.95);
  });

  it('rejects socket auth failure and invalid operations without state mutation', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    const badSocket = createClient(`${context.baseUrl}/rooms`, { auth: { roomCode: seats.roomCode, reconnectToken: 'invalid-token-value-that-is-long-enough' }, transports: ['websocket'] });
    context.clients.push(badSocket);
    const connectError = await waitForEvent<Error>(badSocket, 'connect_error');
    expect(connectError.message).toContain('INVALID_RECONNECT_TOKEN');

    forceRoles(context, seats.roomCode, ['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);
    context.store.replaceRoom(setPhase(context.store.requireRoom(seats.roomCode), 'seer_action', context.handle.timers.engineOptions()));
    const errorEvent = waitForEvent(sockets[0]!, 'error');
    sockets[0]!.emit('action:seer', { mode: 'view_one_player', targetSeatIndex: 1 });
    expect((await errorEvent).code).toBe('INELIGIBLE_PLAYER');
    expect(context.store.requireRoom(seats.roomCode).actions).toHaveLength(0);
  });

  it('seer reveal: state:private contains revealedCards, hides on phase change, respects privacy', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    forceRoles(context, seats.roomCode, ['预言家', '狼人', '强盗'], ['捣蛋鬼', '水鬼', '平民']);

    // Set phase to seer_action and emit state so clients receive it
    const seerRoom = setPhase(context.store.requireRoom(seats.roomCode), 'seer_action', context.handle.timers.engineOptions());
    context.store.replaceRoom(seerRoom);
    emitRoomState(context.handle.namespace, context.store, seats.roomCode);

    // Capture state:private for seer (seat 0) after action
    const privateEvent = waitForEvent<PrivateRoomView>(sockets[0]!, 'state:private', (view) => view.revealedCards.some((card) => card.location === 'underwater:0'));

    // Seer performs two-underwater action
    sockets[0]!.emit('action:seer', { mode: 'view_two_underwater', underwaterIndexes: [0, 1] });
    const privateView = await privateEvent;

    // Verify revealedCards contain both underwater roles for the seer
    const underwaterReveals = privateView.revealedCards.filter((card) => card.location.startsWith('underwater:'));
    expect(underwaterReveals.map((card) => card.role)).toEqual(expect.arrayContaining(['捣蛋鬼', '水鬼']));
    expect(underwaterReveals).toHaveLength(2);

    // Wait for state:private from other seat (wolf, seat 1) — should NOT have seer reveals
    const otherPrivate = await waitForEvent<PrivateRoomView>(sockets[1]!, 'state:private');
    const otherUnderwaterReveals = otherPrivate.revealedCards.filter((card) => card.location.startsWith('underwater:'));
    expect(otherUnderwaterReveals).toHaveLength(0);

    // Advance phase to robber_action
    const afterPhaseChangeEvent = waitForEvent<PrivateRoomView>(sockets[0]!, 'state:private');
    const robberRoom = setPhase(context.store.requireRoom(seats.roomCode), 'robber_action', context.handle.timers.engineOptions());
    context.store.replaceRoom(robberRoom);
    emitRoomState(context.handle.namespace, context.store, seats.roomCode);

    // Capture state:private for seer — revealedCards should no longer have underwater reveals
    const afterPhaseChange = await afterPhaseChangeEvent;
    const afterChangeReveals = afterPhaseChange.revealedCards.filter((card) => card.location.startsWith('underwater:'));
    expect(afterChangeReveals).toHaveLength(0);
  });

  it('wolf reveal: state:private contains one underwater role, respects privacy, clears on phase change', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    forceRoles(context, seats.roomCode, ['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);

    // Set phase to wolf_action
    const wolfRoom = setPhase(context.store.requireRoom(seats.roomCode), 'wolf_action', context.handle.timers.engineOptions());
    context.store.replaceRoom(wolfRoom);
    emitRoomState(context.handle.namespace, context.store, seats.roomCode);

    // Capture state:private for wolf (seat 0) after action
    const privateEvent = waitForEvent<PrivateRoomView>(sockets[0]!, 'state:private', (view) => view.revealedCards.some((card) => card.location === 'underwater:0'));

    // Wolf views one underwater card
    sockets[0]!.emit('action:wolf', { underwaterIndex: 0 });
    const privateView = await privateEvent;

    // Verify exactly one underwater reveal for the wolf
    const underwaterReveals = privateView.revealedCards.filter((card) => card.location.startsWith('underwater:'));
    expect(underwaterReveals).toHaveLength(1);
    expect(underwaterReveals[0].location).toBe('underwater:0');
    expect(underwaterReveals[0].role).toBe('捣蛋鬼');

    // Other seat should see no underwater reveals
    const otherPrivate = await waitForEvent<PrivateRoomView>(sockets[1]!, 'state:private');
    const otherReveals = otherPrivate.revealedCards.filter((card) => card.location.startsWith('underwater:'));
    expect(otherReveals).toHaveLength(0);

    // Advance phase → reveals cleared
    const afterPhaseChangeEvent = waitForEvent<PrivateRoomView>(sockets[0]!, 'state:private');
    const seerRoom = setPhase(context.store.requireRoom(seats.roomCode), 'seer_action', context.handle.timers.engineOptions());
    context.store.replaceRoom(seerRoom);
    emitRoomState(context.handle.namespace, context.store, seats.roomCode);

    const afterPhaseChange = await afterPhaseChangeEvent;
    const afterReveals = afterPhaseChange.revealedCards.filter((card) => card.location.startsWith('underwater:'));
    expect(afterReveals).toHaveLength(0);
  });

  it('robber reveal+swap: state:private shows target role and confirms swap via action result', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    forceRoles(context, seats.roomCode, ['强盗', '狼人', '平民'], ['捣蛋鬼', '水鬼', '预言家']);

    // Set phase to robber_action
    const robberRoom = setPhase(context.store.requireRoom(seats.roomCode), 'robber_action', context.handle.timers.engineOptions());
    context.store.replaceRoom(robberRoom);
    emitRoomState(context.handle.namespace, context.store, seats.roomCode);

    // Set up listeners for both seats before the action
    const privateEvent = waitForEvent<PrivateRoomView>(sockets[0]!, 'state:private', (view) => view.revealedCards.some((card) => card.location === 'playerSeat:1'));
    const otherPrivateEvent = waitForEvent<PrivateRoomView>(sockets[2]!, 'state:private');

    // Robber (seat 0) views and swaps with seat 1
    sockets[0]!.emit('action:robber', { targetSeatIndex: 1 });

    const [privateView, otherPrivate] = await Promise.all([privateEvent, otherPrivateEvent]);

    // Verify target player's card is revealed to robber
    const playerReveals = privateView.revealedCards.filter((card) => card.location === 'playerSeat:1');
    expect(playerReveals).toHaveLength(1);
    expect(playerReveals[0].role).toBe('狼人');

    // Robber's own initial card is always visible
    const ownInitial = privateView.revealedCards.find((card) => card.location === 'playerSeat:0:initial');
    expect(ownInitial?.role).toBe('强盗');

    // Other seat should not see the reveals
    const otherPlayerReveals = otherPrivate.revealedCards.filter((card) => card.location === 'playerSeat:1');
    expect(otherPlayerReveals).toHaveLength(0);
  });

  it('supports disconnect, reconnect, and room leave status broadcasts', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    sockets[1]!.disconnect();
    await waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.players.some((player) => player.seatIndex === 1 && player.connectionStatus === 'disconnected'));

    const reconnected = createClient(`${context.baseUrl}/rooms`, { auth: { roomCode: seats.roomCode, reconnectToken: seats.tokens[1] }, transports: ['websocket'] });
    context.clients.push(reconnected);
    await waitForEvent(reconnected, 'connect');
    await waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.players.some((player) => player.seatIndex === 1 && player.connectionStatus === 'connected'));

    reconnected.emit('room:leave', {});
    await waitForEvent(reconnected, 'disconnect');
  });

});
