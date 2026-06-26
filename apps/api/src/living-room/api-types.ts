import type { RoomSnapshot, WorldEvent } from "@pet-sanctuary/contracts";

export interface SimulationStatus {
  paused: boolean;
  tick: number;
  tickIntervalMs: number;
}

export interface RoomResponse {
  snapshot: RoomSnapshot;
  simulation: SimulationStatus;
}

export interface RoomUpdate {
  snapshot: RoomSnapshot;
  event?: WorldEvent;
  simulation: SimulationStatus;
}
