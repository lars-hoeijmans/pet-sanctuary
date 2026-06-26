import type {
  Approval,
  Pet,
  PetTraits,
  RoomSnapshot,
  Skill,
  Task,
  WorldEvent
} from "@pet-sanctuary/contracts";

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

export interface CreateTaskResponse extends RoomResponse {
  task: Task;
}

export interface CreatePetResponse extends RoomResponse {
  pet: Pet;
}

export interface RollTraitsResponse {
  rollId: string;
  traits: PetTraits;
}

export interface ResolveApprovalResponse extends RoomResponse {
  approval: Approval;
}

export interface SkillsResponse {
  skills: Skill[];
}

export interface TasksResponse {
  tasks: Task[];
}

export interface ApprovalsResponse {
  approvals: Approval[];
}

export interface PetsResponse {
  pets: Pet[];
}
