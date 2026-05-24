import { GameError } from '../../shared/errors.js';
import {
  DEFAULT_PHASE_DURATIONS_MS,
  PHASES,
  ROLE_BY_PHASE,
  ROLES,
  type ActionTarget,
  type IdentityCard,
  type Phase,
  type PlayerSeat,
  type Role,
  type RoleAction,
  type RolePhase,
  type Room,
  type SeatIndex,
  type Settlement,
  type Vote
} from '../../shared/types.js';

export interface EngineOptions {
  now?: Date;
  seed?: string;
  phaseDurationsMs?: Partial<Record<Exclude<Phase, 'free_speech' | 'settlement'>, number>>;
  votingTimeoutMs?: number;
}

export interface ActionResult {
  phase: RolePhase;
  revealedCards: Array<{ location: string; role: Role }>;
  exchangePerformed: boolean;
}

export function cloneRoom(room: Room): Room {
  return JSON.parse(JSON.stringify(room)) as Room;
}

export function nowIso(now = new Date()): string {
  return now.toISOString();
}

export function occupiedSeats(room: Room): PlayerSeat[] {
  return room.seats.filter((seat): seat is PlayerSeat => seat !== null);
}

export function getSeatByIndex(room: Room, seatIndex: SeatIndex): PlayerSeat {
  const seat = room.seats[seatIndex];
  if (!seat) throw new GameError('INVALID_TARGET');
  return seat;
}

export function getSeatById(room: Room, seatId: string): PlayerSeat {
  const seat = occupiedSeats(room).find((candidate) => candidate.seatId === seatId);
  if (!seat) throw new GameError('INVALID_TARGET');
  return seat;
}

export function getCardById(room: Room, cardId: string): IdentityCard {
  const card = room.deck.find((candidate) => candidate.cardId === cardId);
  if (!card) throw new GameError('INVALID_TARGET');
  return card;
}

export function getCurrentCardForSeat(room: Room, seat: PlayerSeat): IdentityCard {
  if (!seat.currentCardId) throw new GameError('INVALID_PHASE');
  return getCardById(room, seat.currentCardId);
}

export function getInitialRoleForSeat(room: Room, seat: PlayerSeat): Role | null {
  if (!seat.initialCardId) return null;
  return getCardById(room, seat.initialCardId).role;
}

export function getCardAtUnderwater(room: Room, underwaterIndex: number): IdentityCard {
  if (!Number.isInteger(underwaterIndex) || underwaterIndex < 0 || underwaterIndex > 2) {
    throw new GameError('INVALID_TARGET');
  }
  const card = room.deck.find((candidate) => candidate.currentLocation === `underwater:${underwaterIndex}`);
  if (!card) throw new GameError('INVALID_TARGET');
  return card;
}

export function getPhaseDurationMs(phase: Phase, options: EngineOptions = {}): number | undefined {
  if (phase === 'free_speech' || phase === 'settlement') return undefined;
  if (phase === 'voting') {
    return options.votingTimeoutMs ?? DEFAULT_PHASE_DURATIONS_MS.voting;
  }
  return options.phaseDurationsMs?.[phase] ?? DEFAULT_PHASE_DURATIONS_MS[phase];
}

export function createGameStateFactory(baseRoom: Room, options: EngineOptions = {}): Room {
  return initializeGame(baseRoom, options);
}

export function initializeGame(baseRoom: Room, options: EngineOptions = {}): Room {
  const room = cloneRoom(baseRoom);
  const seats = occupiedSeats(room).sort((a, b) => a.seatIndex - b.seatIndex);
  if (seats.length !== 3 || seats.some((seat) => seat.connectionStatus !== 'connected')) {
    throw new GameError('ROOM_UNAVAILABLE', '需要三名已连接玩家才能开始游戏。');
  }

  const shuffledRoles = shuffleRoles(options.seed ?? `${room.roomCode}:${room.version}`);
  const deck: IdentityCard[] = shuffledRoles.map((role, index) => {
    if (index < 3) {
      const seat = seats[index];
      if (!seat) throw new GameError('ROOM_UNAVAILABLE');
      return {
        cardId: `card_${index}`,
        role,
        initialLocation: `playerSeat:${seat.seatId}`,
        currentLocation: `playerSeat:${seat.seatId}`,
        visibleToSeatIds: [seat.seatId]
      };
    }
    const underwaterIndex = index - 3;
    return {
      cardId: `card_${index}`,
      role,
      initialLocation: `underwater:${underwaterIndex}`,
      currentLocation: `underwater:${underwaterIndex}`,
      visibleToSeatIds: []
    };
  });

  for (const seat of seats) {
    const card = deck.find((candidate) => candidate.initialLocation === `playerSeat:${seat.seatId}`);
    if (!card) throw new GameError('ROOM_UNAVAILABLE');
    seat.initialCardId = card.cardId;
    seat.currentCardId = card.cardId;
    seat.hasCompletedCurrentAction = false;
    seat.voteSubmitted = false;
  }

  room.deck = deck;
  room.underwaterCardIds = [0, 1, 2].map((index) => getCardAtUnderwater({ ...room, deck }, index).cardId);
  room.status = 'in_game';
  room.actions = [];
  room.votes = {};
  delete room.settlement;
  return setPhase(room, 'close_eyes', options);
}

export function setPhase(inputRoom: Room, phase: Phase, options: EngineOptions = {}): Room {
  const room = cloneRoom(inputRoom);
  const now = options.now ?? new Date();
  room.phase = phase;
  room.phaseStartedAt = nowIso(now);
  const durationMs = getPhaseDurationMs(phase, options);
  if (durationMs === undefined) {
    delete room.phaseEndsAt;
  } else {
    room.phaseEndsAt = new Date(now.getTime() + durationMs).toISOString();
  }
  for (const seat of occupiedSeats(room)) {
    seat.hasCompletedCurrentAction = false;
    if (phase === 'voting') seat.voteSubmitted = Boolean(room.votes[seat.seatId]);
  }
  touch(room, now);
  return room;
}

export function advanceTimedPhase(inputRoom: Room, options: EngineOptions = {}): Room {
  let room = cloneRoom(inputRoom);
  const phase = room.phase;
  if (!phase || phase === 'free_speech' || phase === 'settlement') return room;

  if (phase === 'troublemaker_action') room = autoCompleteMandatoryAction(room, '捣蛋鬼', options);
  if (phase === 'water_ghost_action') room = autoCompleteMandatoryAction(room, '水鬼', options);
  if (phase === 'voting') {
    room = autoVoteMissingSeats(room, options);
    return settleRoom(room, options);
  }

  const index = PHASES.indexOf(phase);
  const nextPhase = PHASES[index + 1];
  if (!nextPhase) return room;
  return setPhase(room, nextPhase, options);
}

export function advanceFreeSpeechToVoting(inputRoom: Room, ownerSeatIndex: SeatIndex, options: EngineOptions = {}): Room {
  const room = cloneRoom(inputRoom);
  const owner = getSeatByIndex(room, ownerSeatIndex);
  if (owner.seatId !== room.ownerSeatId) throw new GameError('NOT_ROOM_OWNER');
  if (room.phase !== 'free_speech') throw new GameError('INVALID_PHASE');
  return setPhase(room, 'voting', options);
}

export function performWolfAction(inputRoom: Room, seatIndex: SeatIndex, underwaterIndex: number, options: EngineOptions = {}): { room: Room; result: ActionResult } {
  const room = prepareRoleAction(inputRoom, seatIndex, 'wolf_action', '狼人', options);
  const actor = getSeatByIndex(room, seatIndex);
  const card = getCardAtUnderwater(room, underwaterIndex);
  revealCardToSeat(card, actor.seatId);
  recordAction(room, {
    phase: 'wolf_action',
    role: '狼人',
    actingSeatId: actor.seatId,
    isMandatory: false,
    isAutomatic: false,
    selectedTargets: [{ kind: 'underwater', underwaterIndex }],
    revealedCardIds: [card.cardId],
    exchangedCardIds: []
  }, options.now);
  markActionComplete(room, actor.seatId);
  return { room: touch(room, options.now), result: actionResult('wolf_action', [{ location: `underwater:${underwaterIndex}`, role: card.role }], false) };
}

export function performSeerAction(
  inputRoom: Room,
  seatIndex: SeatIndex,
  payload: { mode: 'view_two_underwater'; underwaterIndexes: number[] } | { mode: 'view_one_player'; targetSeatIndex: SeatIndex },
  options: EngineOptions = {}
): { room: Room; result: ActionResult } {
  const room = prepareRoleAction(inputRoom, seatIndex, 'seer_action', '预言家', options);
  const actor = getSeatByIndex(room, seatIndex);
  const revealed: Array<{ card: IdentityCard; location: string }> = [];
  const targets: ActionTarget[] = [];

  if (payload.mode === 'view_two_underwater') {
    const unique = new Set(payload.underwaterIndexes);
    if (payload.underwaterIndexes.length !== 2 || unique.size !== 2) throw new GameError('INVALID_TARGET');
    for (const index of payload.underwaterIndexes) {
      const card = getCardAtUnderwater(room, index);
      revealCardToSeat(card, actor.seatId);
      revealed.push({ card, location: `underwater:${index}` });
      targets.push({ kind: 'underwater', underwaterIndex: index });
    }
  } else {
    const targetSeat = getSeatByIndex(room, payload.targetSeatIndex);
    const card = getCurrentCardForSeat(room, targetSeat);
    revealCardToSeat(card, actor.seatId);
    revealed.push({ card, location: `playerSeat:${payload.targetSeatIndex}` });
    targets.push({ kind: 'player', seatId: targetSeat.seatId, seatIndex: targetSeat.seatIndex });
  }

  recordAction(room, {
    phase: 'seer_action',
    role: '预言家',
    actingSeatId: actor.seatId,
    isMandatory: false,
    isAutomatic: false,
    selectedTargets: targets,
    revealedCardIds: revealed.map(({ card }) => card.cardId),
    exchangedCardIds: []
  }, options.now);
  markActionComplete(room, actor.seatId);
  return {
    room: touch(room, options.now),
    result: actionResult('seer_action', revealed.map(({ card, location }) => ({ location, role: card.role })), false)
  };
}

export function performRobberAction(inputRoom: Room, seatIndex: SeatIndex, targetSeatIndex: SeatIndex, options: EngineOptions = {}): { room: Room; result: ActionResult } {
  const room = prepareRoleAction(inputRoom, seatIndex, 'robber_action', '强盗', options);
  if (targetSeatIndex === seatIndex) throw new GameError('INVALID_TARGET');
  const actor = getSeatByIndex(room, seatIndex);
  const target = getSeatByIndex(room, targetSeatIndex);
  const actorCard = getCurrentCardForSeat(room, actor);
  const targetCard = getCurrentCardForSeat(room, target);
  revealCardToSeat(targetCard, actor.seatId);
  exchangeCards(room, actorCard, targetCard);
  recordAction(room, {
    phase: 'robber_action',
    role: '强盗',
    actingSeatId: actor.seatId,
    isMandatory: false,
    isAutomatic: false,
    selectedTargets: [{ kind: 'player', seatId: target.seatId, seatIndex: target.seatIndex }],
    revealedCardIds: [targetCard.cardId],
    exchangedCardIds: [actorCard.cardId, targetCard.cardId]
  }, options.now);
  markActionComplete(room, actor.seatId);
  return { room: touch(room, options.now), result: actionResult('robber_action', [{ location: `playerSeat:${targetSeatIndex}`, role: targetCard.role }], true) };
}

export function performTroublemakerAction(inputRoom: Room, seatIndex: SeatIndex, targetSeatIndexes: SeatIndex[], options: EngineOptions = {}, isAutomatic = false): { room: Room; result: ActionResult } {
  const room = prepareRoleAction(inputRoom, seatIndex, 'troublemaker_action', '捣蛋鬼', options, isAutomatic);
  const actor = getSeatByIndex(room, seatIndex);
  const uniqueTargets = [...new Set(targetSeatIndexes)];
  const expectedTargets = occupiedSeats(room)
    .filter((seat) => seat.seatIndex !== seatIndex)
    .map((seat) => seat.seatIndex)
    .sort();
  if (uniqueTargets.length !== 2 || uniqueTargets.sort().join(',') !== expectedTargets.join(',')) {
    throw new GameError('INVALID_TARGET');
  }
  const firstTarget = getSeatByIndex(room, uniqueTargets[0] as SeatIndex);
  const secondTarget = getSeatByIndex(room, uniqueTargets[1] as SeatIndex);
  const firstCard = getCurrentCardForSeat(room, firstTarget);
  const secondCard = getCurrentCardForSeat(room, secondTarget);
  exchangeCards(room, firstCard, secondCard);
  recordAction(room, {
    phase: 'troublemaker_action',
    role: '捣蛋鬼',
    actingSeatId: actor.seatId,
    isMandatory: true,
    isAutomatic,
    selectedTargets: [
      { kind: 'player', seatId: firstTarget.seatId, seatIndex: firstTarget.seatIndex },
      { kind: 'player', seatId: secondTarget.seatId, seatIndex: secondTarget.seatIndex }
    ],
    revealedCardIds: [],
    exchangedCardIds: [firstCard.cardId, secondCard.cardId]
  }, options.now);
  markActionComplete(room, actor.seatId);
  return { room: touch(room, options.now), result: actionResult('troublemaker_action', [], true) };
}

export function performWaterGhostAction(inputRoom: Room, seatIndex: SeatIndex, underwaterIndex: number, options: EngineOptions = {}, isAutomatic = false): { room: Room; result: ActionResult } {
  const room = prepareRoleAction(inputRoom, seatIndex, 'water_ghost_action', '水鬼', options, isAutomatic);
  const actor = getSeatByIndex(room, seatIndex);
  const actorCard = getCurrentCardForSeat(room, actor);
  const underwaterCard = getCardAtUnderwater(room, underwaterIndex);
  exchangeCards(room, actorCard, underwaterCard);
  recordAction(room, {
    phase: 'water_ghost_action',
    role: '水鬼',
    actingSeatId: actor.seatId,
    isMandatory: true,
    isAutomatic,
    selectedTargets: [{ kind: 'underwater', underwaterIndex }],
    revealedCardIds: [],
    exchangedCardIds: [actorCard.cardId, underwaterCard.cardId]
  }, options.now);
  markActionComplete(room, actor.seatId);
  return { room: touch(room, options.now), result: actionResult('water_ghost_action', [], true) };
}

export function castVote(inputRoom: Room, voterSeatIndex: SeatIndex, targetSeatIndex: SeatIndex, options: EngineOptions = {}, isAutomatic = false): Room {
  let room = cloneRoom(inputRoom);
  if (room.phase !== 'voting') throw new GameError('INVALID_PHASE');
  const voter = getSeatByIndex(room, voterSeatIndex);
  const target = getSeatByIndex(room, targetSeatIndex);
  if (voter.seatId === target.seatId) throw new GameError('INVALID_TARGET');
  if (room.votes[voter.seatId]) throw new GameError('VOTE_ALREADY_SUBMITTED');

  const submittedAt = nowIso(options.now ?? new Date());
  const vote: Vote = {
    voterSeatId: voter.seatId,
    targetSeatId: target.seatId,
    submittedAt,
    isAutomatic
  };
  room.votes[voter.seatId] = vote;
  voter.voteSubmitted = true;
  touch(room, options.now);

  if (occupiedSeats(room).every((seat) => room.votes[seat.seatId])) {
    room = settleRoom(room, options);
  }
  return room;
}

export function autoVoteMissingSeats(inputRoom: Room, options: EngineOptions = {}): Room {
  let room = cloneRoom(inputRoom);
  if (room.phase !== 'voting') return room;
  for (const voter of occupiedSeats(room).sort((a, b) => a.seatIndex - b.seatIndex)) {
    if (room.votes[voter.seatId]) continue;
    const target = occupiedSeats(room)
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .find((seat) => seat.seatId !== voter.seatId);
    if (!target) throw new GameError('INVALID_TARGET');
    room = castVote(room, voter.seatIndex, target.seatIndex, options, true);
  }
  return room;
}

export function settleRoom(inputRoom: Room, options: EngineOptions = {}): Room {
  const room = cloneRoom(inputRoom);
  const seats = occupiedSeats(room).sort((a, b) => a.seatIndex - b.seatIndex);
  if (seats.some((seat) => !room.votes[seat.seatId])) throw new GameError('INVALID_PHASE', '投票尚未完成。');

  const totals = seats.map((seat) => ({ seatId: seat.seatId, seatIndex: seat.seatIndex, votes: 0 }));
  for (const vote of Object.values(room.votes)) {
    const total = totals.find((candidate) => candidate.seatId === vote.targetSeatId);
    if (total) total.votes += 1;
  }
  const maxVotes = Math.max(...totals.map((total) => total.votes));
  const leaders = totals.filter((total) => total.votes === maxVotes);
  const eliminated = leaders.length === 1 ? leaders[0] : null;

  const finalPlayerCards = seats.map((seat) => {
    const card = getCurrentCardForSeat(room, seat);
    return { seatId: seat.seatId, seatIndex: seat.seatIndex, nickname: seat.nickname, role: card.role };
  });
  const finalUnderwaterCards = [0, 1, 2].map((index) => ({ index, role: getCardAtUnderwater(room, index).role }));
  const playerWolf = finalPlayerCards.find((entry) => entry.role === '狼人');
  const winningCamp = playerWolf
    ? eliminated?.seatId === playerWolf.seatId
      ? '好人'
      : '狼人'
    : eliminated === null
      ? '好人'
      : '狼人';

  const settlement: Settlement = {
    voteTotals: totals,
    eliminatedSeatId: eliminated?.seatId ?? null,
    eliminatedSeatIndex: eliminated?.seatIndex ?? null,
    winningCamp,
    finalPlayerCards,
    finalUnderwaterCards,
    roleActionsSummary: room.actions.map((action) => ({
      phase: action.phase,
      role: action.role,
      seatIndex: action.actingSeatId ? getSeatById(room, action.actingSeatId).seatIndex : null,
      isAutomatic: action.isAutomatic
    })),
    automaticVotes: Object.values(room.votes)
      .filter((vote) => vote.isAutomatic)
      .map((vote) => ({
        voterSeatIndex: getSeatById(room, vote.voterSeatId).seatIndex,
        targetSeatIndex: getSeatById(room, vote.targetSeatId).seatIndex
      })),
    settledAt: nowIso(options.now ?? new Date())
  };

  room.settlement = settlement;
  room.status = 'settled';
  room.phase = 'settlement';
  room.phaseStartedAt = settlement.settledAt;
  delete room.phaseEndsAt;
  touch(room, options.now);
  return room;
}

export function autoCompleteMandatoryAction(inputRoom: Room, role: '捣蛋鬼' | '水鬼', options: EngineOptions = {}): Room {
  const room = cloneRoom(inputRoom);
  const actor = findSeatByInitialRole(room, role);
  if (!actor) return room;
  const phase = role === '捣蛋鬼' ? 'troublemaker_action' : 'water_ghost_action';
  if (room.actions.some((action) => action.phase === phase && action.actingSeatId === actor.seatId)) return room;
  if (role === '捣蛋鬼') {
    const targets = occupiedSeats(room)
      .filter((seat) => seat.seatId !== actor.seatId)
      .map((seat) => seat.seatIndex) as SeatIndex[];
    return performTroublemakerAction(room, actor.seatIndex, targets, options, true).room;
  }
  return performWaterGhostAction(room, actor.seatIndex, 0, options, true).room;
}

export function findSeatByInitialRole(room: Room, role: Role): PlayerSeat | undefined {
  return occupiedSeats(room).find((seat) => getInitialRoleForSeat(room, seat) === role);
}

function prepareRoleAction(inputRoom: Room, seatIndex: SeatIndex, phase: RolePhase, role: Role, options: EngineOptions, isAutomatic = false): Room {
  const room = cloneRoom(inputRoom);
  if (room.phase !== phase) throw new GameError('INVALID_PHASE');
  if (!isAutomatic && room.phaseEndsAt && options.now && options.now.getTime() > new Date(room.phaseEndsAt).getTime()) {
    throw new GameError('ACTION_WINDOW_CLOSED');
  }
  const actor = getSeatByIndex(room, seatIndex);
  const initialRole = getInitialRoleForSeat(room, actor);
  if (initialRole !== role) throw new GameError('INELIGIBLE_PLAYER');
  if (room.actions.some((action) => action.phase === phase && action.actingSeatId === actor.seatId)) {
    throw new GameError('ACTION_WINDOW_CLOSED');
  }
  return room;
}

function recordAction(room: Room, action: Omit<RoleAction, 'actionId' | 'completedAt'>, now?: Date): void {
  room.actions.push({
    actionId: `action_${room.actions.length + 1}`,
    completedAt: nowIso(now ?? new Date()),
    ...action
  });
}

function markActionComplete(room: Room, seatId: string): void {
  const seat = getSeatById(room, seatId);
  seat.hasCompletedCurrentAction = true;
}

function revealCardToSeat(card: IdentityCard, seatId: string): void {
  if (!card.visibleToSeatIds.includes(seatId)) card.visibleToSeatIds.push(seatId);
}

function exchangeCards(room: Room, first: IdentityCard, second: IdentityCard): void {
  const firstLocation = first.currentLocation;
  first.currentLocation = second.currentLocation;
  second.currentLocation = firstLocation;
  syncCardReferences(room);
}

function syncCardReferences(room: Room): void {
  for (const seat of occupiedSeats(room)) {
    const currentCard = room.deck.find((card) => card.currentLocation === `playerSeat:${seat.seatId}`);
    if (currentCard) seat.currentCardId = currentCard.cardId;
  }
  room.underwaterCardIds = [0, 1, 2].map((index) => getCardAtUnderwater(room, index).cardId);
}

function touch(room: Room, now?: Date): Room {
  room.updatedAt = nowIso(now ?? new Date());
  room.version += 1;
  return room;
}

function actionResult(phase: RolePhase, revealedCards: Array<{ location: string; role: Role }>, exchangePerformed: boolean): ActionResult {
  return { phase, revealedCards, exchangePerformed };
}

function shuffleRoles(seed: string): Role[] {
  const roles = [...ROLES];
  const random = seededRandom(seed);
  for (let i = roles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = roles[i];
    roles[i] = roles[j] as Role;
    roles[j] = temp as Role;
  }
  return roles;
}

function seededRandom(seed: string): () => number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function phaseRole(phase: Phase | undefined): Role | undefined {
  return phase ? ROLE_BY_PHASE[phase] : undefined;
}
