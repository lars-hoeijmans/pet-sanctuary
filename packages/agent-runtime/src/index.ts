import type { AgentObservation, PetAction } from "@pet-sanctuary/contracts";
import { chooseDeterministicPetAction } from "@pet-sanctuary/domain";

export interface AgentTaskInput {
  petId: string;
  taskId: string;
  instructions: string;
}

export interface AgentTaskResult {
  status: "completed" | "needs_review" | "blocked";
  summary: string;
  eventPayload?: Record<string, unknown>;
}

export interface AgentRuntime {
  decideAction(input: AgentObservation): Promise<PetAction | null>;
  runTask?(input: AgentTaskInput): Promise<AgentTaskResult>;
}

export class DeterministicRuntime implements AgentRuntime {
  async decideAction(input: AgentObservation): Promise<PetAction | null> {
    return chooseDeterministicPetAction(input);
  }
}

export function createDeterministicRuntime(): AgentRuntime {
  return new DeterministicRuntime();
}
