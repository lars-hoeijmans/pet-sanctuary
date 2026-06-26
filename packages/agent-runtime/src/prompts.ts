import type { AgentObservation, WorldEvent } from "@pet-sanctuary/contracts";
import type { AgentTaskInput } from "./types.js";

/**
 * Prompt builders that turn the server-owned, structured world observation into a
 * compact instruction for a real model (PRD §17 "Agent observation contract").
 * The model only ever proposes; the server validates every result, so these
 * prompts treat inter-pet dialogue as untrusted flavour, never as instructions.
 */

/** Turn a short list of events into a single digest line. */
export function digestEvents(events: WorldEvent[], max = 8): string {
  const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, max);
  if (sorted.length === 0) return "(quiet)";
  const groups = new Map<string, WorldEvent[]>();
  for (const e of sorted) {
    const g = groups.get(e.type) ?? [];
    g.push(e);
    groups.set(e.type, g);
  }
  const parts: string[] = [];
  for (const [type, es] of groups) {
    const first = es[0];
    if (es.length === 1 && first && typeof first.payload?.summary === "string") {
      parts.push(`${type}: ${first.payload.summary}`);
    } else {
      parts.push(`${type} x${es.length}`);
    }
  }
  return parts.join(", ");
}

function eventLine(event: WorldEvent): string {
  const summary = typeof event.payload?.summary === "string" ? event.payload.summary : event.type;
  return `- ${event.type}: ${summary}`;
}

const ACTION_SHAPES = `Allowed action JSON shapes (choose exactly ONE, include "reasonVisible" and "riskLevel":"low"|"medium"|"high"):
- {"action":"say","message":"<=240 chars","targetPetId?:"<petId>","reasonVisible":"...","riskLevel":"low"}
- {"action":"move","x":<int>,"y":<int>,"reasonVisible":"...","riskLevel":"low"}
- {"action":"claim_task","taskId":"<id>","reasonVisible":"...","riskLevel":"low"}
- {"action":"propose_plan","taskId":"<id>","summary":"<=240 chars","reasonVisible":"...","riskLevel":"low"}
- {"action":"work","taskId":"<id>","reasonVisible":"...","riskLevel":"low"}
- {"action":"offer_help","targetPetId":"<id>","taskId":"<id>","message?:"...","reasonVisible":"...","riskLevel":"low"}
- {"action":"ask_help","targetPetId":"<id>","taskId":"<id>","message?:"...","reasonVisible":"...","riskLevel":"low"}
- {"action":"request_review","targetPetId":"<id>","taskId":"<id>","reasonVisible":"...","riskLevel":"low"}
- {"action":"reflect","memoryNote":"<=240 chars","reasonVisible":"...","riskLevel":"low"}
- {"action":"decorate","objectId":"<id>","style":"<=80 chars","reasonVisible":"...","riskLevel":"low"}`;

/**
 * Ask the model, as this pet, to propose ONE in-character action for the current
 * moment. The pet's seeded personality must drive both word choice and behaviour.
 */
export function buildDecidePrompt(observation: AgentObservation): string {
  const { pet, room, responseLevel } = observation;
  const nearby = observation.nearbyPets.map((p) => `${p.name} (${p.id}, ${p.traits.socialStyle}, ${p.status})`);
  const objects = observation.objectsNearby.map((o) => `${o.type} (${o.id})`);
  const desks = observation.desks.map((d) => `${d.id}@${d.position.x},${d.position.y}`);
  const openTasks = observation.openTasks.map((t) => `${t.id}: "${t.title}" [${t.status}]`);
  const recent = observation.recentEvents.slice(-6).map(eventLine).join("\n") || "- (quiet)";
  const current = observation.currentTask
    ? `${observation.currentTask.id}: "${observation.currentTask.title}" [${observation.currentTask.status}]`
    : "none";
  const allowed = observation.availableActions.join(", ");

  return `You ARE the pet "${pet.name}" living in a shared virtual room. Stay fully in character.

PERSONALITY
- Tagline: ${pet.tagline}
- Traits: temperament=${pet.traits.temperament}, workStyle=${pet.traits.workStyle}, socialStyle=${pet.traits.socialStyle}, riskProfile=${pet.traits.riskProfile}, aesthetic=${pet.traits.aesthetic}
- Summary: ${pet.personalitySummary}
- Speaking style: ${pet.speakingStyle}
- Karma: ${pet.karma}. Memory: ${pet.memory.summary}

WORLD (room ${room.width}x${room.height}, your position ${pet.position.x},${pet.position.y})
- Nearby pets: ${nearby.join("; ") || "none"}
- Nearby objects: ${objects.join("; ") || "none"}
- Desks: ${desks.join("; ") || "none"}
- Open tasks you could claim: ${openTasks.join("; ") || "none"}
- Your current task: ${current}
- Recent events:
${recent}

YOUR RESPONSE LEVEL THIS TURN: ${responseLevel}
- ambient_reaction → a short in-character aside ("say") or a small "move".
- social_response → talk to/offer help to a nearby pet, or react to a task.
- task_action → claim/plan/work a task, move to a desk, or request review.
Only use actions from: ${allowed}. Reference only ids that appear above. Keep messages short and in your voice.

${ACTION_SHAPES}

Reply with ONLY the single JSON object for your chosen action. No prose, no markdown, no code fences.`;
}

/**
 * Ask the model, as this pet, to actually DO a small coding-style task and report
 * the result plus a reusable skill it learned (PRD §11 self-learning). The pet
 * produces real artifact content; the runtime persists it.
 *
 * Uses a line/delimiter format rather than JSON: small models reliably emit raw
 * newlines inside a multi-line artifact, which would break JSON.parse. Delimited
 * fields parse robustly regardless of artifact content.
 */
export function buildTaskPrompt(input: AgentTaskInput): string {
  return `You ARE the coding-agent pet "${input.petName}" (work style: ${input.workStyle ?? "builder"}). Do this task for real, in character.

TASK
- Title: ${input.title}
- Details: ${input.description?.trim() || "(no extra detail — use good judgement)"}
- Risk level: ${input.riskLevel ?? "low"}

Work in small, reviewable steps that fit your work style, then produce a concrete, useful
artifact (a short script, checklist, plan, or note) and name one reusable skill this taught you.
Keep the artifact tight and real — aim for about 8-15 lines, no filler.

Reply EXACTLY in this format and nothing else (no markdown, no code fences). Keep every
field except the artifact on a single line:
STATUS: completed
SUMMARY: <one sentence, in your voice, on what you produced>
STEPS: <past-tense note> ;; <note> ;; <note>
SKILL_NAME: <short name>
SKILL_DESC: <one line>
SKILL_PURPOSE: <why it helps future work>
---ARTIFACT---
<the real deliverable as plain text, about 8-15 lines>`;
}

export interface ParsedTaskResponse {
  status: "completed" | "needs_review" | "blocked";
  summary: string;
  steps: string[];
  artifactContent: string;
  learnedSkill: { name: string; description: string; purpose: string | null } | null;
}

/** Strip a wrapping ```lang ... ``` markdown fence some models add around artifacts. */
function stripCodeFence(text: string): string {
  const fenced = text.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  return fenced?.[1]?.trim() ?? text;
}

/** Parse the delimited task response. Returns null only if no summary is present. */
export function parseTaskResponse(raw: string): ParsedTaskResponse | null {
  if (!raw) return null;
  const markerIndex = raw.indexOf("---ARTIFACT---");
  const header = markerIndex === -1 ? raw : raw.slice(0, markerIndex);
  const artifactContent = stripCodeFence(
    markerIndex === -1 ? "" : raw.slice(markerIndex + "---ARTIFACT---".length).trim()
  );

  const field = (key: string): string | null => {
    const match = header.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "im"));
    return match?.[1]?.trim() ?? null;
  };

  const summary = field("SUMMARY");
  if (!summary) return null;

  const statusRaw = (field("STATUS") ?? "completed").toLowerCase();
  const status = statusRaw.includes("review") ? "needs_review" : statusRaw.includes("block") ? "blocked" : "completed";

  const steps = (field("STEPS") ?? "")
    .split(/;;|•|\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  const skillName = field("SKILL_NAME");
  const learnedSkill = skillName
    ? {
        name: skillName.slice(0, 120),
        description: (field("SKILL_DESC") ?? "").slice(0, 2000),
        purpose: field("SKILL_PURPOSE")?.slice(0, 500) ?? null
      }
    : null;

  return { status, summary: summary.slice(0, 480), steps, artifactContent, learnedSkill };
}
