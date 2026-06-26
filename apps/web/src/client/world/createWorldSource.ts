/**
 * Chooses the active world source from env.
 *  - default / "petcore": live pet-core backend (REST + Socket.IO) with a
 *    deterministic seed fallback when the API is unreachable.
 *  - "mock": fully client-side resident agents (no backend needed) — kept for
 *    self-contained demos.
 *
 * Configure with `NEXT_PUBLIC_WORLD_SOURCE`. The pet-core transport reuses the
 * existing `NEXT_PUBLIC_SANCTUARY_*` env vars (see lib/sanctuary-client).
 */
import type { WorldSource } from "./WorldSource";
import { MockWorldSource } from "./MockWorldSource";
import { PetCoreWorldSource } from "./PetCoreWorldSource";

export function createWorldSource(): WorldSource {
  const mode = process.env.NEXT_PUBLIC_WORLD_SOURCE ?? "petcore";

  if (mode === "mock") {
    console.info("[Agent City] MockWorldSource (no backend required)");
    return new MockWorldSource();
  }

  console.info("[Agent City] PetCoreWorldSource → pet-core API");
  return new PetCoreWorldSource();
}
