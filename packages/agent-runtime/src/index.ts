import type { AgentObservation, PetAction, PetRuntimeConfig } from "@pet-sanctuary/contracts";
import { chooseDeterministicPetAction, type TaskRunOutcome } from "@pet-sanctuary/domain";

/**
 * Agent runtime boundary (PRD §15/§17). The product owns the world engine; agent
 * frameworks sit behind this small adapter. Implementations are staged:
 *
 *  1. DeterministicRuntime — seeded hard-coded policy (Living Room Kernel).
 *  2. AiSdkRuntime         — optional structured model-call adapter; proposals only.
 *  3. HermesRuntime        — real coding-agent task execution + skill growth.
 *  4. PiRuntime            — optional self-modifying pet (stretch).
 *
 * Per PRD §14 the MVP must not depend on paid per-token LLM APIs. The AI/Hermes
 * adapters here are intentionally gated: they never call a paid provider on their
 * own and fall back to deterministic behavior unless a no-cost route is explicitly
 * enabled and wired in. This keeps the demo working with zero incremental cost.
 */

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

export interface AgentRuntime {
  readonly kind: PetRuntimeConfig["kind"];
  decideAction(input: AgentObservation): Promise<PetAction | null>;
  runTask?(input: AgentTaskInput): Promise<AgentTaskResult>;
}

/** Whether model-backed runtimes are allowed to attempt real model calls. Off by
 * default so no paid API is ever hit without an explicit, audited opt-in. */
export function isModelRouteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SANCTUARY_AI_ENABLED === "true";
}

// --- 1. Deterministic --------------------------------------------------------

export class DeterministicRuntime implements AgentRuntime {
  readonly kind = "deterministic" as const;

  async decideAction(input: AgentObservation): Promise<PetAction | null> {
    return chooseDeterministicPetAction(input);
  }

  async runTask(input: AgentTaskInput): Promise<AgentTaskResult> {
    return deterministicTaskRun(input);
  }
}

/**
 * Deterministic, zero-cost simulation of a pet doing focused work at its desk.
 * Streams a few progress notes flavored by work style and produces a reusable
 * procedural skill — proving the end-to-end "task → progress → learned skill"
 * loop without any external runtime or paid API.
 */
export function deterministicTaskRun(input: AgentTaskInput): AgentTaskResult {
  const key = input.workStyle && input.workStyle in WORK_STEPS ? input.workStyle : "builder";
  const steps = WORK_STEPS[key] ?? WORK_STEPS.builder ?? [];
  const learnedSkill = LEARNED_SKILL[key] ?? LEARNED_SKILL.builder ?? null;

  return {
    status: "completed",
    summary: `${input.petName} finished "${input.title}" with small, reviewable steps.`,
    outputRef: `artifact://${input.taskId}/summary.md`,
    steps: steps.map((step) => step.replace("{title}", input.title)),
    learnedSkill
  };
}

const WORK_STEPS: Record<string, string[]> = {
  builder: ["Sketched a tiny reversible change for {title}.", "Built the smallest working version.", "Left notes so it is easy to review."],
  reviewer: ["Listed the edge cases for {title}.", "Checked each path against the room state.", "Wrote a short review summary."],
  planner: ["Drafted a step plan for {title}.", "Validated the plan against constraints.", "Handed the plan off for execution."],
  debugger: ["Reproduced the issue behind {title}.", "Logged a visible trace.", "Confirmed the fix with the trace."],
  refactorer: ["Renamed the unclear parts of {title}.", "Reshaped the structure without changing behavior.", "Verified nothing observable changed."],
  researcher: ["Summarized context for {title}.", "Compared two approaches.", "Recommended the safer one."]
};

const LEARNED_SKILL: Record<string, NonNullable<AgentTaskResult["learnedSkill"]>> = {
  builder: { name: "Reversible-first changes", description: "Always ship the smallest reversible step.", purpose: "Keep work easy to review and undo." },
  reviewer: { name: "Edge-case checklist", description: "Reuse a checklist of common edge cases.", purpose: "Catch problems before completion." },
  planner: { name: "Plan-then-handoff", description: "Write a short plan before handing work off.", purpose: "Make intent visible and reviewable." },
  debugger: { name: "Trace-before-conclude", description: "Reproduce and log before drawing conclusions.", purpose: "Turn uncertainty into evidence." },
  refactorer: { name: "Behavior-preserving cleanup", description: "Improve clarity without changing behavior.", purpose: "Reduce risk while improving readability." },
  researcher: { name: "Summarize-before-asking", description: "Compress context into a short summary first.", purpose: "Save everyone's time and tokens." }
};

// --- 2. AI SDK (gated proposal adapter) -------------------------------------

/**
 * Structured model-call adapter. By design this NEVER calls a paid provider in
 * the MVP. When a no-cost route is verified and wired in, the actual model call
 * goes here; until then it returns null so the orchestrator falls back to the
 * deterministic policy. Model output, when added, is a *proposal* the server
 * still validates — it must never mutate world state directly.
 */
export class AiSdkRuntime implements AgentRuntime {
  readonly kind = "ai_sdk" as const;

  constructor(private readonly config: PetRuntimeConfig) {}

  async decideAction(_input: AgentObservation): Promise<PetAction | null> {
    if (!isModelRouteEnabled()) {
      return null;
    }
    // No no-cost model route is wired in this build. Returning null keeps the
    // pet deterministic instead of silently hitting a paid API (PRD §14).
    return null;
  }

  async runTask(input: AgentTaskInput): Promise<AgentTaskResult> {
    // Falls back to the deterministic simulation until a model route is enabled.
    return deterministicTaskRun(input);
  }
}

// --- 3/4. Hermes / Pi (real execution, gated) -------------------------------

/**
 * Adapter for a real coding-agent harness (Hermes; Pi is the stretch variant).
 * Integrating live Hermes requires an external runtime + a verified model route,
 * which is out of scope for the local-first MVP. Until configured, task runs use
 * the deterministic simulation so the desk-work loop is demonstrable end to end.
 */
export class HermesRuntime implements AgentRuntime {
  readonly kind: PetRuntimeConfig["kind"];

  constructor(private readonly config: PetRuntimeConfig) {
    this.kind = config.kind === "pi" ? "pi" : "hermes";
  }

  async decideAction(_input: AgentObservation): Promise<PetAction | null> {
    return null;
  }

  async runTask(input: AgentTaskInput): Promise<AgentTaskResult> {
    return deterministicTaskRun(input);
  }
}

// --- factory + fallback wrapper ---------------------------------------------

export function createRuntime(config: PetRuntimeConfig): AgentRuntime {
  switch (config.kind) {
    case "ai_sdk":
      return new AiSdkRuntime(config);
    case "hermes":
    case "pi":
      return new HermesRuntime(config);
    case "deterministic":
    default:
      return new DeterministicRuntime();
  }
}

/**
 * Wrap a primary runtime so a null/failed decision or task run always falls back
 * to the deterministic policy. This is what the orchestrator should use: it gets
 * model-backed behavior when available and never stalls a pet otherwise.
 */
export class FallbackRuntime implements AgentRuntime {
  readonly kind: PetRuntimeConfig["kind"];
  private readonly fallback = new DeterministicRuntime();

  constructor(private readonly primary: AgentRuntime) {
    this.kind = primary.kind;
  }

  async decideAction(input: AgentObservation): Promise<PetAction | null> {
    try {
      const proposed = await this.primary.decideAction(input);
      if (proposed) {
        return proposed;
      }
    } catch {
      // fall through to deterministic
    }
    return this.fallback.decideAction(input);
  }

  async runTask(input: AgentTaskInput): Promise<AgentTaskResult> {
    if (this.primary.runTask) {
      try {
        return await this.primary.runTask(input);
      } catch {
        // fall through to deterministic
      }
    }
    return this.fallback.runTask(input);
  }
}

export function createRuntimeWithFallback(config: PetRuntimeConfig): AgentRuntime {
  return new FallbackRuntime(createRuntime(config));
}

export function createDeterministicRuntime(): AgentRuntime {
  return new DeterministicRuntime();
}
