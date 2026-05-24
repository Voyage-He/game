import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PrivateRoomView, PublicRoomView, Role } from '../../src/shared/types.js';
import {
  closeSocketTestContext,
  connectSeat,
  connectSeats,
  createSocketTestContext,
  createThreeSeats,
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

describe('Socket.IO identity allocation and stability', () => {
  it('varies repeated room:start allocations with same players/order and never leaks roles in public state', async () => {
    const rolesBySeat = [new Set<Role>(), new Set<Role>(), new Set<Role>()];

    for (let i = 0; i < 30; i += 1) {
      const seats = await createFixedCodeSeats('FIXED1');
      const sockets = await connectSeats(context, seats);
      const privateWaits = sockets.map((socket) => waitForEvent<PrivateRoomView>(socket, 'state:private', (view) => Boolean(view.initialRole)));
      const publicWait = waitForEvent<PublicRoomView>(sockets[0]!, 'state:public', (view) => view.phase === 'close_eyes');

      sockets[0]!.emit('room:start', {});
      const publicView = await publicWait;
      expect(JSON.stringify(publicView)).not.toMatch(/狼人|预言家|强盗|捣蛋鬼|水鬼|平民/u);

      const privateViews = await Promise.all(privateWaits);
      for (const view of privateViews) {
        expect(view.initialRole).toBeTruthy();
        rolesBySeat[view.seatIndex]!.add(view.initialRole!);
      }

      for (const socket of sockets) socket.disconnect();
      context.handle.timers.clear(seats.roomCode);
      context.store.deleteRoom(seats.roomCode);
    }

    expect(rolesBySeat.every((roles) => roles.size > 1)).toBe(true);
  });

  it('keeps the same active-game identity after browser reconnect', async () => {
    const seats = await createFixedCodeSeats('STABLE1');
    const sockets = await connectSeats(context, seats);
    const firstPrivate = waitForEvent<PrivateRoomView>(sockets[1]!, 'state:private', (view) => Boolean(view.initialRole));
    sockets[0]!.emit('room:start', {});
    const beforeReconnect = await firstPrivate;

    sockets[1]!.disconnect();
    const reconnected = connectSeat(context, seats.roomCode, seats.tokens[1]!);
    const reconnectedPrivate = waitForEvent<PrivateRoomView>(reconnected, 'state:private', (view) => Boolean(view.initialRole));
    await waitForEvent(reconnected, 'connect');
    const afterReconnect = await reconnectedPrivate;

    expect(afterReconnect.seatIndex).toBe(beforeReconnect.seatIndex);
    expect(afterReconnect.initialRole).toBe(beforeReconnect.initialRole);
  });
});

async function createFixedCodeSeats(fixedCode: string): Promise<{ roomCode: string; tokens: string[] }> {
  const seats = await createThreeSeats(context);
  const room = context.store.requireRoom(seats.roomCode);
  context.store.deleteRoom(seats.roomCode);
  room.roomCode = fixedCode;
  context.store.replaceRoom(room);
  return { roomCode: fixedCode, tokens: seats.tokens };
}
