import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentObservation, PetAction, PetRuntimeConfig } from "@pet-sanctuary/contracts";
import { PetActionSchema } from "@pet-sanctuary/contracts";
import { chooseDeterministicPetAction, type TaskRunOutcome } from "@pet-sanctuary/domain";
import { agentComplete, extractJson } from "./llm.js";
import { buildDecidePrompt, buildTaskPrompt, parseTaskResponse } from "./prompts.js";
import type { AgentTaskInput, AgentTaskResult } from "./types.js";

export type { AgentTaskInput, AgentTaskResult } from "./types.js";
export * from "./llm.js";
export { buildDecidePrompt, buildTaskPrompt, parseTaskResponse, digestEvents } from "./prompts.js";

/**
 * Agent runtime boundary (PRD §15/§17). The product owns the world engine; agent
 * frameworks sit behind this small adapter.
 *
 *  1. DeterministicRuntime — seeded hard-coded policy (resilience fallback).
 *  2. LlmAgentRuntime      — REAL model-driven behaviour + real task execution,
 *                            routed through a no-cost local agent CLI (Hermes via
 *                            the Codex subscription, or opencode via GitHub Copilot).
 *
 * Per PRD §14 the MVP must not depend on paid per-token LLM APIs: the LLM runtime
 * only ever uses subscription-backed local CLIs, is gated by `SANCTUARY_AI_ENABLED`,
 * and the FallbackRuntime drops to deterministic on any null/error so a pet never
 * stalls. Model output is always a *proposal* the server still validates.
 */

export interface AgentRuntime {
  readonly kind: PetRuntimeConfig["kind"];
  decideAction(input: AgentObservation): Promise<PetAction | null>;
  runTask?(input: AgentTaskInput): Promise<AgentTaskResult>;
}

/** Whether model-backed runtimes are allowed to attempt real model calls. Off by
 * default so no provider is ever hit without an explicit, audited opt-in. */
export function isModelRouteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SANCTUARY_AI_ENABLED === "true";
}

// --- 1. Deterministic (resilience fallback) ---------------------------------

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
 * Used only when the model route is disabled or a real call fails, so the
 * end-to-end "task → progress → learned skill" loop always resolves.
 */
export function deterministicTaskRun(input: AgentTaskInput): AgentTaskResult {
  const key = input.workStyle && input.workStyle in WORK_STEPS ? input.workStyle : "builder";
  const steps = WORK_STEPS[key] ?? WORK_STEPS.builder ?? [];

  return {
    status: "completed",
    summary: `${input.petName} finished "${input.title}" with small, reviewable steps.`,
    outputRef: `artifact://${input.taskId}/summary.md`,
    steps: steps.map((step) => step.replace("{title}", input.title)),
    // A deterministic fallback did no genuine novel work, so it claims no learned
    // skill — skills are occasional and meaningful (PRD §11), never per-task.
    learnedSkill: null
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

// --- 2. Real LLM agent (subscription-backed, no per-token cost) --------------

/**
 * The real agent. `decideAction` asks the model — in this pet's voice — for one
 * constrained, schema-valid action. `runTask` asks the model to actually perform
 * the task, persists the artifact it produces, and surfaces a learned skill.
 * Every result is parsed/validated; anything malformed returns null (decide) or
 * deterministic output (task) so the world keeps moving.
 */
export class LlmAgentRuntime implements AgentRuntime {
  readonly kind: PetRuntimeConfig["kind"];

  constructor(private readonly config: PetRuntimeConfig) {
    this.kind = config.kind;
  }

  async decideAction(input: AgentObservation): Promise<PetAction | null> {
    if (!isModelRouteEnabled()) {
      return null;
    }
    const raw = await agentComplete(buildDecidePrompt(input), { fast: true });
    if (!raw) return null;
    const json = extractJson(raw);
    if (!json) return null;
    const parsed = PetActionSchema.safeParse(json);
    // Untrusted model output: only a fully schema-valid action survives. The
    // server still re-validates against permissions/world state downstream.
    return parsed.success ? parsed.data : null;
  }

  async runTask(input: AgentTaskInput): Promise<AgentTaskResult> {
    if (!isModelRouteEnabled()) {
      return deterministicTaskRun(input);
    }
    const raw = await agentComplete(buildTaskPrompt(input), { fast: false });
    const parsed = raw ? parseTaskResponse(raw) : null;
    if (!parsed) {
      // Real call failed or returned nothing usable — still resolve the task.
      return deterministicTaskRun(input);
    }

    const outputRef = await persistArtifact(input, parsed.artifactContent);
    return {
      status: parsed.status,
      summary: parsed.summary,
      outputRef,
      steps: parsed.steps.length > 0 ? parsed.steps : [`${input.petName} worked through "${input.title}".`],
      learnedSkill: parsed.learnedSkill
    };
  }
}

/** Write the artifact the model produced to a per-pet workspace and return a ref. */
async function persistArtifact(input: AgentTaskInput, content: unknown): Promise<string> {
  const fallbackRef = `artifact://${input.taskId}/summary.md`;
  if (typeof content !== "string" || !content.trim()) {
    return fallbackRef;
  }
  try {
    const dir = join(process.env.SANCTUARY_WORKSPACE_DIR || join(tmpdir(), "pet-sanctuary-workspaces"), input.petId);
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${input.taskId}.md`);
    await writeFile(file, content, "utf8");
    return `file://${file}`;
  } catch {
    return fallbackRef;
  }
}

// --- factory + fallback wrapper ---------------------------------------------

export function createRuntime(config: PetRuntimeConfig): AgentRuntime {
  switch (config.kind) {
    case "ai_sdk":
    case "hermes":
    case "pi":
      return new LlmAgentRuntime(config);
    case "deterministic":
    default:
      return new DeterministicRuntime();
  }
}

/**
 * Wrap a primary runtime so a null/failed decision or task run always falls back
 * to the deterministic policy. This is what the orchestrator uses: it gets real
 * model-backed behaviour when available and never stalls a pet otherwise.
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
