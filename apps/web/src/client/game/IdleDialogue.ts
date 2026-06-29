/**
 * Idle small-talk between two agents who have nothing scheduled to do.
 *
 * The Phaser scene drives the *timing* and *staging* (who, where, when); a
 * DialogueProvider supplies the *words*. Today the default provider is fully
 * client-side and canned — it weaves each agent's personality `sayings` into a
 * lightweight opener → reply → closer rhythm so two idle agents look like
 * they're actually chatting.
 *
 * It is intentionally pluggable: when a backend LLM dialogue endpoint exists,
 * implement `DialogueProvider.nextLine` to call it (it may return a Promise) and
 * the scene needs no changes. See `setIdleDialogueProvider`.
 */
import { AGENT_DEF_BY_ID } from "../world/agentDefs";

export interface DialogueParticipant {
  id: string;
  name: string;
  role?: string;
}

export interface DialogueContext {
  /** Whoever is about to speak this turn. */
  speaker: DialogueParticipant;
  /** The agent being spoken to. */
  listener: DialogueParticipant;
  /** 0-based turn index within this conversation. */
  turn: number;
  /** Total number of turns the conversation will run. */
  totalTurns: number;
  /** Lines already spoken in this conversation, oldest first. */
  history: string[];
}

export interface DialogueProvider {
  /** Return the next line for `ctx.speaker`. May be sync or async. */
  nextLine(ctx: DialogueContext): string | Promise<string>;
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const OPENERS = [
  "Hey {listener}, got a sec?",
  "{listener} — how's it going over there?",
  "Quiet moment, {listener}. What are you noodling on?",
  "Yo {listener}, quick brain-pick?",
  "{listener}! Coffee-break sync?",
];

const REPLIES = [
  "Ha, yeah — same here.",
  "Right? I've been thinking the same.",
  "Good question. Honestly, I'm between things.",
  "Tell me about it.",
  "Makes sense. Want a hand?",
  "Fair. I'll keep that in mind.",
];

const CLOSERS = [
  "Anyway — back to it. Good chat!",
  "Cool, let's pick this up later.",
  "Alright, catch you in a bit.",
  "Nice. I'll ping you if anything comes up.",
];

/** The default, fully client-side conversational provider. */
export class CannedDialogueProvider implements DialogueProvider {
  nextLine(ctx: DialogueContext): string {
    const isLast = ctx.turn >= ctx.totalTurns - 1;
    if (isLast && ctx.turn > 0) return pick(CLOSERS);

    if (ctx.turn === 0) {
      return pick(OPENERS).replace("{listener}", firstName(ctx.listener.name));
    }

    // Middle turns: half the time drop a flavorful in-character line, otherwise
    // a short conversational reply so it reads as back-and-forth, not monologue.
    const sayings = AGENT_DEF_BY_ID.get(ctx.speaker.id)?.sayings;
    if (sayings && sayings.length > 0 && Math.random() < 0.55) {
      return pick(sayings);
    }
    return pick(REPLIES);
  }
}

let activeProvider: DialogueProvider = new CannedDialogueProvider();

/** Swap the idle-dialogue provider (e.g. an LLM-backed one). */
export function setIdleDialogueProvider(provider: DialogueProvider): void {
  activeProvider = provider;
}

export function getIdleDialogueProvider(): DialogueProvider {
  return activeProvider;
}
