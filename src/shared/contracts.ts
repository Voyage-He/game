import { z } from 'zod';
import { ERROR_CODES } from './errors.js';
import { PHASES } from './types.js';

const nicknameRegex = /^[^<>\\{}]{1,20}$/u;

export const NicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(nicknameRegex);

export const RoomCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(12)
  .regex(/^[A-Z0-9]+$/u);

export const ReconnectTokenSchema = z.string().min(16).max(256);

export const CreateRoomRequestSchema = z.object({
  nickname: NicknameSchema
});

export const JoinRoomRequestSchema = z.object({
  nickname: NicknameSchema
});

export const ReconnectRoomRequestSchema = z.object({
  reconnectToken: ReconnectTokenSchema
});

export const SocketAuthSchema = z.object({
  roomCode: RoomCodeSchema,
  reconnectToken: ReconnectTokenSchema
});

export const EmptyPayloadSchema = z.object({}).passthrough();

export const UnderwaterIndexSchema = z.number().int().min(0).max(2);
export const SeatIndexSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);

export const WolfActionSchema = z.object({
  underwaterIndex: UnderwaterIndexSchema
});

export const SeerActionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('view_two_underwater'),
    underwaterIndexes: z.array(UnderwaterIndexSchema).length(2)
  }),
  z.object({
    mode: z.literal('view_one_player'),
    targetSeatIndex: SeatIndexSchema
  })
]);

export const RobberActionSchema = z.object({
  targetSeatIndex: SeatIndexSchema
});

export const TroublemakerActionSchema = z.object({
  targetSeatIndexes: z.array(SeatIndexSchema).length(2)
});

export const WaterGhostActionSchema = z.object({
  underwaterIndex: UnderwaterIndexSchema
});

export const VoteCastSchema = z.object({
  targetSeatIndex: SeatIndexSchema
});

export const ChatSendSchema = z.object({
  text: z.string().trim().min(1).max(500)
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string().min(1)
  })
});

export const PhaseChangedSchema = z.object({
  phase: z.enum(PHASES),
  phaseStartedAt: z.string(),
  phaseEndsAt: z.string().optional()
});

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type ReconnectRoomRequest = z.infer<typeof ReconnectRoomRequestSchema>;
export type SocketAuth = z.infer<typeof SocketAuthSchema>;
export type WolfActionPayload = z.infer<typeof WolfActionSchema>;
export type SeerActionPayload = z.infer<typeof SeerActionSchema>;
export type RobberActionPayload = z.infer<typeof RobberActionSchema>;
export type TroublemakerActionPayload = z.infer<typeof TroublemakerActionSchema>;
export type WaterGhostActionPayload = z.infer<typeof WaterGhostActionSchema>;
export type VoteCastPayload = z.infer<typeof VoteCastSchema>;
export type ChatSendPayload = z.infer<typeof ChatSendSchema>;
