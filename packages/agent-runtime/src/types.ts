import type { TaskRunOutcome } from "@pet-sanctuary/domain";

export interface AgentTaskInput {
  petId: string;
  petName: string;
  taskId: string;
  title: string;
  description?: string;
  workStyle?: string;
  riskLevel?: "low" | "medium" | "high";
}

/** The shape a runtime returns for a task run; consumed by the world engine's
 * `applyTaskResult`. */
export type AgentTaskResult = TaskRunOutcome;
