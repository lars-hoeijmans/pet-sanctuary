/**
 * Chooses the active world source from env.
 *  - default / "mock": fully client-side resident agents (no backend needed)
 *  - "socket": connect to a real Society Server (set VITE_WORLD_SERVER_URL)
 */
import type { WorldSource } from "./WorldSource";
import { MockWorldSource } from "./MockWorldSource";
import { SocketWorldSource } from "./SocketWorldSource";

export function createWorldSource(): WorldSource {
  const mode = import.meta.env.VITE_WORLD_SOURCE ?? "mock";
  const baseUrl = import.meta.env.VITE_WORLD_SERVER_URL ?? "http://localhost:3001";

  if (mode === "socket") {
    console.info(`[Agent City] Using SocketWorldSource -> ${baseUrl}`);
    return new SocketWorldSource(baseUrl);
  }
  console.info("[Agent City] Using MockWorldSource (no backend required)");
  return new MockWorldSource();
}
