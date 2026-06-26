import type { RoomSnapshot, WorldEvent } from "@pet-sanctuary/contracts";

export const LIVING_ROOM_REPOSITORY = Symbol("LivingRoomRepository");

export interface LivingRoomRepository {
  loadMainRoom(): Promise<RoomSnapshot>;
  saveMainRoom(snapshot: RoomSnapshot): Promise<void>;
  resetMainRoom(seed?: string): Promise<RoomSnapshot>;
  appendEvent(event: WorldEvent): Promise<void>;
}
