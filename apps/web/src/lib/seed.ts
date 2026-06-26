import { createSeedRoomSnapshot } from "@pet-sanctuary/domain";
import type { RoomSnapshot } from "./contracts";
import { normalizeContractSnapshot } from "./sanctuary-client";

/**
 * The deterministic seed snapshot, derived from the SAME `@pet-sanctuary/domain`
 * kernel the server uses. This guarantees zero divergence: the offline fallback
 * shows the exact pets/objects the live API would serve (Mochi, Byte, Nova in the
 * Living Room Kernel). A fixed timestamp keeps it stable for SSR + tests.
 */
const SEED_TIMESTAMP = "2026-06-26T09:00:00.000Z";

export const SEED_SNAPSHOT: RoomSnapshot = normalizeContractSnapshot(
  createSeedRoomSnapshot(SEED_TIMESTAMP),
);
