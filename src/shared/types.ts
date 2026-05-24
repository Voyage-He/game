export const ROLES = ['狼人', '预言家', '强盗', '捣蛋鬼', '水鬼', '平民'] as const;
export type Role = (typeof ROLES)[number];

export const CAMPS = ['好人', '狼人'] as const;
export type Camp = (typeof CAMPS)[number];

export const ROOM_STATUSES = ['waiting', 'in_game', 'settled', 'closed'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const PHASES = [
  'close_eyes',
  'wolf_action',
  'seer_action',
  'robber_action',
  'troublemaker_action',
  'water_ghost_action',
  'open_eyes',
  'free_speech',
  'voting',
  'settlement'
] as const;
export type Phase = (typeof PHASES)[number];

export const ROLE_PHASES = [
  'wolf_action',
  'seer_action',
  'robber_action',
  'troublemaker_action',
  'water_ghost_action'
] as const;
export type RolePhase = (typeof ROLE_PHASES)[number];

export const ROLE_BY_PHASE: Partial<Record<Phase, Role>> = {
  wolf_action: '狼人',
  seer_action: '预言家',
  robber_action: '强盗',
  troublemaker_action: '捣蛋鬼',
  water_ghost_action: '水鬼'
};

export const PHASE_BY_ROLE: Partial<Record<Role, RolePhase>> = {
  狼人: 'wolf_action',
  预言家: 'seer_action',
  强盗: 'robber_action',
  捣蛋鬼: 'troublemaker_action',
  水鬼: 'water_ghost_action'
};

export const DEFAULT_PHASE_DURATIONS_MS: Record<Exclude<Phase, 'free_speech' | 'settlement'>, number> = {
  close_eyes: 5000,
  wolf_action: 10000,
  seer_action: 10000,
  robber_action: 10000,
  troublemaker_action: 5000,
  water_ghost_action: 5000,
  open_eyes: 1000,
  voting: 60000
};

export type SeatIndex = 0 | 1 | 2;
export type ConnectionStatus = 'connected' | 'disconnected';
export type CardLocation = `playerSeat:${string}` | `underwater:${number}`;

export interface IdentityCard {
  cardId: string;
  role: Role;
  initialLocation: CardLocation;
  currentLocation: CardLocation;
  visibleToSeatIds: string[];
}

export interface PlayerSeat {
  seatId: string;
  seatIndex: SeatIndex;
  nickname: string;
  isOwner: boolean;
  connectionStatus: ConnectionStatus;
  socketIds: string[];
  reconnectTokenHash: string;
  initialCardId?: string;
  currentCardId?: string;
  hasCompletedCurrentAction: boolean;
  voteSubmitted: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface ActionTarget {
  kind: 'player' | 'underwater';
  seatId?: string;
  seatIndex?: SeatIndex;
  underwaterIndex?: number;
}

export interface RoleAction {
  actionId: string;
  phase: RolePhase;
  actingSeatId?: string;
  role: Exclude<Role, '平民'>;
  isMandatory: boolean;
  isAutomatic: boolean;
  selectedTargets: ActionTarget[];
  revealedCardIds: string[];
  exchangedCardIds: string[];
  completedAt: string;
}

export interface Vote {
  voterSeatId: string;
  targetSeatId: string;
  submittedAt: string;
  isAutomatic: boolean;
}

export interface Settlement {
  voteTotals: Array<{ seatId: string; seatIndex: SeatIndex; votes: number }>;
  eliminatedSeatId: string | null;
  eliminatedSeatIndex: SeatIndex | null;
  winningCamp: Camp;
  finalPlayerCards: Array<{ seatId: string; seatIndex: SeatIndex; nickname: string; role: Role }>;
  finalUnderwaterCards: Array<{ index: number; role: Role }>;
  roleActionsSummary: Array<{ phase: RolePhase; role: Role; seatIndex: SeatIndex | null; isAutomatic: boolean }>;
  automaticVotes: Array<{ voterSeatIndex: SeatIndex; targetSeatIndex: SeatIndex }>;
  settledAt: string;
}

export interface ChatMessage {
  messageId: string;
  roomCode: string;
  senderSeatId: string;
  seatIndex: SeatIndex;
  nickname: string;
  text: string;
  sentAt: string;
}

export interface Room {
  roomCode: string;
  ownerSeatId: string;
  status: RoomStatus;
  seats: Array<PlayerSeat | null>;
  deck: IdentityCard[];
  underwaterCardIds: string[];
  phase?: Phase;
  phaseStartedAt?: string;
  phaseEndsAt?: string;
  actions: RoleAction[];
  votes: Record<string, Vote>;
  settlement?: Settlement;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  version: number;
}

export interface PlayerPublicView {
  seatIndex: SeatIndex;
  nickname: string;
  isOwner: boolean;
  connectionStatus: ConnectionStatus;
}

export interface PublicRoomView {
  roomCode: string;
  status: RoomStatus;
  version: number;
  players: PlayerPublicView[];
  phase?: Phase;
  phaseStartedAt?: string;
  phaseEndsAt?: string;
  phaseCompletion?: { currentRoleCompleted: boolean };
  voteCompletion?: { submittedCount: number; requiredCount: number };
}

export interface PrivateRoomView {
  seatIndex: SeatIndex;
  initialRole: Role | null;
  currentEligibleAction: null | {
    phase: RolePhase;
    options: string[];
  };
  revealedCards: Array<{ location: string; role: Role }>;
  submittedVote: null | { targetSeatIndex: SeatIndex; isAutomatic: boolean };
}

export interface SettlementView {
  voteTotals: Array<{ seatIndex: SeatIndex; votes: number }>;
  eliminatedSeatIndex: SeatIndex | null;
  winningCamp: Camp;
  finalPlayerCards: Array<{ seatIndex: SeatIndex; nickname: string; role: Role }>;
  finalUnderwaterCards: Array<{ index: number; role: Role }>;
  automaticActions: Array<{ phase: RolePhase; seatIndex: SeatIndex | null }>;
  automaticVotes: Array<{ voterSeatIndex: SeatIndex; targetSeatIndex: SeatIndex }>;
}

export type CreateRoomResponse = {
  roomCode: string;
  seatIndex: SeatIndex;
  isOwner: boolean;
  reconnectToken: string;
};

export type JoinRoomResponse = CreateRoomResponse;

export type ReconnectResponse = {
  roomCode: string;
  seatIndex: SeatIndex;
  isOwner: boolean;
};
