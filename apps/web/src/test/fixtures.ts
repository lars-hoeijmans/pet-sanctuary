import type { RoomSnapshot } from "@/lib/contracts";
import { SEED_SNAPSHOT } from "@/lib/seed";

export function cloneSeedSnapshot(): RoomSnapshot {
  return JSON.parse(JSON.stringify(SEED_SNAPSHOT)) as RoomSnapshot;
}
