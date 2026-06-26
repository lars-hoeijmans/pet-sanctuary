import { Injectable } from "@nestjs/common";
import { createSeedRoomSnapshot } from "@pet-sanctuary/domain";
import type { RoomSnapshot, WorldEvent } from "@pet-sanctuary/contracts";
import type { LivingRoomRepository } from "./living-room.repository.js";

export const DEFAULT_MAIN_ROOM_SEED = "living-room-demo-v1";

@Injectable()
export class InMemoryLivingRoomRepository implements LivingRoomRepository {
  private snapshot: RoomSnapshot = createApiSeedSnapshot(DEFAULT_MAIN_ROOM_SEED);

  async loadMainRoom(): Promise<RoomSnapshot> {
    return cloneSnapshot(this.snapshot);
  }

  async saveMainRoom(snapshot: RoomSnapshot): Promise<void> {
    this.snapshot = cloneSnapshot(snapshot);
  }

  async resetMainRoom(seed = DEFAULT_MAIN_ROOM_SEED): Promise<RoomSnapshot> {
    this.snapshot = createApiSeedSnapshot(seed);
    return cloneSnapshot(this.snapshot);
  }

  async appendEvent(event: WorldEvent): Promise<void> {
    this.snapshot.events.push(event);
  }
}

function cloneSnapshot(snapshot: RoomSnapshot): RoomSnapshot {
  return structuredClone(snapshot);
}

function createApiSeedSnapshot(seed: string): RoomSnapshot {
  const snapshot = createSeedRoomSnapshot();
  const seededEvent = snapshot.events[0];
  if (!seededEvent) {
    return snapshot;
  }

  return {
    ...snapshot,
    events: [
      {
        ...seededEvent,
        payload: {
          ...seededEvent.payload,
          seed
        }
      },
      ...snapshot.events.slice(1)
    ]
  };
}
