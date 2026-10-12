// The ONLY place app code imports protocol types from. Types are re-exported (erased at build time)
// and the version constant is duplicated so the zod schemas in @tysiac/protocol never reach the bundle.
export type {
  ClientMessage,
  CreateRoomRequest,
  CreateRoomResponse,
  ErrorCode,
  HistoryResponse,
  LobbyOp,
  RoomExistsResponse,
  RoomInfo,
  RoomSeat,
  RoomStatus,
  ServerMessage,
} from '@tysiac/protocol';

export const PROTOCOL_VERSION = 1 as const;
