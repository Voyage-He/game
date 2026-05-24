import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PrivateRoomView, PublicRoomView, SettlementView } from '../../src/shared/types.js';
import {
  closeSocketTestContext,
  connectSeats,
  createSocketTestContext,
  createThreeSeats,
  forceRoles,
  setRoomPhase,
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

describe('privacy boundaries and Chinese socket errors', () => {
  it('keeps roles private before settlement and reveals final cards only in settlement', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    const publicWait = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.phase === 'close_eyes');
    const privateWait = waitForEvent<PrivateRoomView>(sockets[0]!, 'state:private', (view) => Boolean(view.initialRole));
    sockets[0]!.emit('room:start', {});

    const publicView = await publicWait;
    expect(JSON.stringify(publicView)).not.toMatch(/狼人|预言家|强盗|捣蛋鬼|水鬼|平民/u);
    expect((await privateWait).initialRole).toBeTruthy();

    setRoomPhase(context, seats.roomCode, 'voting');
    const settlementWait = waitForEvent<SettlementView>(sockets[0]!, 'settlement:shown');
    sockets[0]!.emit('vote:cast', { targetSeatIndex: 1 });
    sockets[1]!.emit('vote:cast', { targetSeatIndex: 2 });
    sockets[2]!.emit('vote:cast', { targetSeatIndex: 0 });
    const settlement = await settlementWait;

    expect(settlement.finalPlayerCards).toHaveLength(3);
    expect(settlement.finalUnderwaterCards).toHaveLength(3);
    expect(JSON.stringify(settlement)).toMatch(/狼人|预言家|强盗|捣蛋鬼|水鬼|平民/u);
  });

  it('returns specific Chinese errors for duplicate actions, duplicate votes, self-votes, and invalid targets', async () => {
    const seats = await createThreeSeats(context);
    const sockets = await connectSeats(context, seats);
    forceRoles(context, seats.roomCode, ['狼人', '预言家', '强盗'], ['捣蛋鬼', '水鬼', '平民']);
    setRoomPhase(context, seats.roomCode, 'wolf_action');

    const firstResult = waitForEvent(sockets[0]!, 'action:result');
    sockets[0]!.emit('action:wolf', { underwaterIndex: 0 });
    await firstResult;

    const duplicateActionError = waitForEvent<{ code: string; message: string }>(sockets[0]!, 'error', (error) => error.code === 'ACTION_WINDOW_CLOSED');
    sockets[0]!.emit('action:wolf', { underwaterIndex: 1 });
    expect((await duplicateActionError).message).toContain('已经完成');

    setRoomPhase(context, seats.roomCode, 'seer_action');
    const invalidTargetError = waitForEvent<{ code: string; message: string }>(sockets[1]!, 'error', (error) => error.code === 'INVALID_TARGET');
    sockets[1]!.emit('action:seer', { mode: 'view_two_underwater', underwaterIndexes: [0, 0] });
    expect((await invalidTargetError).message).toContain('目标');

    setRoomPhase(context, seats.roomCode, 'voting');
    const selfVoteError = waitForEvent<{ code: string; message: string }>(sockets[0]!, 'error', (error) => error.code === 'INVALID_TARGET');
    sockets[0]!.emit('vote:cast', { targetSeatIndex: 0 });
    expect((await selfVoteError).message).toContain('不能投给自己');

    const firstVoteUpdate = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.phase === 'voting' && view.voteCompletion?.submittedCount === 1);
    sockets[0]!.emit('vote:cast', { targetSeatIndex: 1 });
    await firstVoteUpdate;

    const duplicateVoteError = waitForEvent<{ code: string; message: string }>(sockets[0]!, 'error', (error) => error.code === 'VOTE_ALREADY_SUBMITTED');
    sockets[0]!.emit('vote:cast', { targetSeatIndex: 2 });
    expect((await duplicateVoteError).message).toContain('已经提交过投票');
  });
});
