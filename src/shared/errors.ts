export const ERROR_CODES = [
  'ROOM_NOT_FOUND',
  'ROOM_UNAVAILABLE',
  'ROOM_FULL',
  'DUPLICATE_NICKNAME',
  'INVALID_NICKNAME',
  'INVALID_RECONNECT_TOKEN',
  'NOT_ROOM_OWNER',
  'INVALID_PHASE',
  'INELIGIBLE_PLAYER',
  'INVALID_TARGET',
  'ACTION_WINDOW_CLOSED',
  'VOTE_ALREADY_SUBMITTED',
  'VALIDATION_ERROR',
  'UNAUTHORIZED'
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  ROOM_NOT_FOUND: '房间不存在或已失效。',
  ROOM_UNAVAILABLE: '房间当前不可加入。',
  ROOM_FULL: '房间已满，无法加入。',
  DUPLICATE_NICKNAME: '该昵称已被使用，请更换昵称。',
  INVALID_NICKNAME: '昵称不能为空，且长度不能超过 20 个字符。',
  INVALID_RECONNECT_TOKEN: '重连令牌无效，无法取回原席位。',
  NOT_ROOM_OWNER: '只有房主可以执行该操作。',
  INVALID_PHASE: '当前阶段不能执行该操作。',
  INELIGIBLE_PLAYER: '当前玩家不能执行该身份操作。',
  INVALID_TARGET: '目标无效，请重新选择。',
  ACTION_WINDOW_CLOSED: '该行动阶段已经结束或你已完成本阶段行动。',
  VOTE_ALREADY_SUBMITTED: '你已经提交过投票。',
  VALIDATION_ERROR: '提交内容格式不正确。',
  UNAUTHORIZED: '请先登录。'
};

export class GameError extends Error {
  code: ErrorCode;
  status: number;

  constructor(code: ErrorCode, message = ERROR_MESSAGES[code], status = statusForCode(code)) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.status = status;
  }
}

export function statusForCode(code: ErrorCode): number {
  switch (code) {
    case 'ROOM_NOT_FOUND':
      return 404;
    case 'ROOM_FULL':
    case 'DUPLICATE_NICKNAME':
    case 'ROOM_UNAVAILABLE':
    case 'INVALID_RECONNECT_TOKEN':
    case 'NOT_ROOM_OWNER':
    case 'INVALID_PHASE':
    case 'INELIGIBLE_PLAYER':
    case 'INVALID_TARGET':
    case 'ACTION_WINDOW_CLOSED':
    case 'VOTE_ALREADY_SUBMITTED':
      return 409;
    case 'INVALID_NICKNAME':
    case 'VALIDATION_ERROR':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    default:
      return 400;
  }
}

export function toErrorPayload(error: unknown): { error: { code: ErrorCode; message: string } } {
  if (error instanceof GameError) {
    return { error: { code: error.code, message: error.message } };
  }
  return { error: { code: 'VALIDATION_ERROR', message: ERROR_MESSAGES.VALIDATION_ERROR } };
}
