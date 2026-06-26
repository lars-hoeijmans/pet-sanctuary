/**
 * The canonical set of lines we pre-render to audio: every resident agent's
 * `sayings` pool (also used for ambient + intro chatter) plus a few demo-only
 * lines from demoScenario.ts and the visitor greeting. Pulling straight from
 * AGENT_DEFS keeps this in sync with what the agents actually speak.
 */
import { AGENT_DEFS } from "../world/agentDefs";
import { voiceFor } from "./voices";

export interface VoiceLine {
  agentId: string;
  voiceId: string;
  text: string;
}

/** Lines spoken by the scripted demo that aren't in any agent's `sayings`. */
const EXTRA_LINES: Array<{ agentId: string; text: string }> = [
  { agentId: "backend-agent", text: "I'll validate the API contract." },
  { agentId: "*", text: "Hello, Agent City!" }, // visitor greeting (default voice)
];

export function collectVoiceLines(): VoiceLine[] {
  const seen = new Set<string>();
  const out: VoiceLine[] = [];
  const add = (agentId: string, text: string): void => {
    const k = `${agentId}|${text}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ agentId, voiceId: voiceFor(agentId).voiceId, text });
  };
  for (const def of AGENT_DEFS) for (const text of def.sayings) add(def.identity.id, text);
  for (const { agentId, text } of EXTRA_LINES) add(agentId, text);
  return out;
}
