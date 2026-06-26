import { createSeedRoomSnapshot } from "@pet-sanctuary/domain";
import type { RoomSnapshot, WorldEvent } from "@pet-sanctuary/contracts";
import {
  appendWorldEvent,
  type SanctuaryDb,
  loadRoomSnapshot,
  replaceRoomSnapshot,
  upsertRoomSnapshot
} from "@pet-sanctuary/db";
import { DEFAULT_MAIN_ROOM_SEED } from "./in-memory-living-room.repository.js";
import type { LivingRoomRepository } from "./living-room.repository.js";

export class DrizzleLivingRoomRepository implements LivingRoomRepository {
  constructor(private readonly db: SanctuaryDb) {}

  async loadMainRoom(): Promise<RoomSnapshot> {
    const snapshot = await loadRoomSnapshot(this.db, "living-room");
    if (snapshot) {
      return snapshot;
    }

    return this.resetMainRoom();
  }

  async saveMainRoom(snapshot: RoomSnapshot): Promise<void> {
    await upsertRoomSnapshot(this.db, snapshot);
  }

  async resetMainRoom(seed = DEFAULT_MAIN_ROOM_SEED): Promise<RoomSnapshot> {
    const snapshot = createSeedRoomSnapshot();
    const seededEvent = snapshot.events[0];
    if (seededEvent) {
      snapshot.events[0] = {
        ...seededEvent,
        payload: {
          ...seededEvent.payload,
          seed
        }
      };
    }
    return replaceRoomSnapshot(this.db, snapshot);
  }

  async appendEvent(event: WorldEvent): Promise<void> {
    await appendWorldEvent(this.db, event);
  }
}
