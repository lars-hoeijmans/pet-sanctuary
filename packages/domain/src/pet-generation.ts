import {
  type PetPermissions,
  type PetRuntimeConfig,
  type PetTraits,
  type Position,
  type RoomSnapshot,
  type Skill,
  TRAIT_POOLS,
  type WorldEvent
} from "@pet-sanctuary/contracts";
import { appendEvent, createWorldEvent, stableNumber } from "./helpers.js";

/**
 * Pet creation back-end (PRD §8, Phase 4). The spinner UI rolls five traits; the
 * server composes a full, deterministic-from-seed personality card and spawns the
 * pet into the room. All starting skills are virtual and auto-active.
 */

export const DEFAULT_PERMISSIONS: PetPermissions = {
  canSpeak: true,
  canMove: true,
  canWork: true,
  canAskHelp: true,
  canOfferHelp: true,
  canBuild: true,
  canDecorate: true,
  canRequestSkill: true,
  canReflect: true
};

const PET_NAMES = [
  "Mochi", "Byte", "Nova", "Pip", "Sprocket", "Glitch", "Pixel", "Waffle",
  "Cosmo", "Tilde", "Quill", "Bramble", "Echo", "Fizz", "Gizmo", "Dottie",
  "Marlow", "Juniper", "Pesto", "Bumble", "Cricket", "Halo", "Mango", "Sable"
];

/**
 * Roll five traits, one per category. Deterministic when a seed is supplied so
 * demos and tests reproduce; otherwise uses a random seed.
 */
export function rollTraits(seed: string = randomSeed()): PetTraits {
  return {
    temperament: pickFrom(TRAIT_POOLS.temperament, `${seed}:temperament`),
    workStyle: pickFrom(TRAIT_POOLS.workStyle, `${seed}:workStyle`),
    socialStyle: pickFrom(TRAIT_POOLS.socialStyle, `${seed}:socialStyle`),
    riskProfile: pickFrom(TRAIT_POOLS.riskProfile, `${seed}:riskProfile`),
    aesthetic: pickFrom(TRAIT_POOLS.aesthetic, `${seed}:aesthetic`)
  };
}

export interface ComposedPetProfile {
  name: string;
  tagline: string;
  personalitySummary: string;
  speakingStyle: string;
  riskNotes: string;
  decorationPreference: string;
  initialKarma: number;
  startingSkills: Array<{ name: string; description: string; purpose: string }>;
  sprite: string;
}

export function composePetProfile(
  traits: PetTraits,
  options: { seed?: string | undefined; name?: string | undefined; existingNames?: string[] | undefined } = {}
): ComposedPetProfile {
  const seed = options.seed ?? randomSeed();
  const name = options.name ?? pickUniqueName(seed, options.existingNames ?? []);

  const tagline = `${capitalize(traits.temperament)} ${traits.workStyle} with a ${traits.socialStyle} streak.`;
  const personalitySummary =
    `${name} is ${TEMPERAMENT_BLURB[traits.temperament]} and works as a ${traits.workStyle}: ${WORK_BLURB[traits.workStyle]} ` +
    `Socially ${name} is ${SOCIAL_BLURB[traits.socialStyle]} and tends to be ${RISK_BLURB[traits.riskProfile]}`;
  const speakingStyle = `${SPEAK_TEMPERAMENT[traits.temperament]} ${SPEAK_SOCIAL[traits.socialStyle]}`;
  const riskNotes = RISK_NOTES[traits.riskProfile];
  const decorationPreference = AESTHETIC_DECOR[traits.aesthetic];

  return {
    name,
    tagline,
    personalitySummary,
    speakingStyle,
    riskNotes,
    decorationPreference,
    initialKarma: initialKarmaFor(traits),
    startingSkills: startingSkillsFor(traits),
    sprite: `generated-${traits.aesthetic.replace(/[^a-z]+/gi, "-")}-${(stableNumber(seed) % 6) + 1}`
  };
}

export interface CreatePetResult {
  snapshot: RoomSnapshot;
  petId: string;
  events: WorldEvent[];
}

/**
 * Spawn a fully-composed pet (plus its starting skills) into the room and emit a
 * PetCreated event so existing pets can react on the next perception pass.
 */
export function createPet(
  snapshot: RoomSnapshot,
  input: {
    traits: PetTraits;
    name?: string | undefined;
    position?: Position | undefined;
    runtime?: PetRuntimeConfig | undefined;
    seed?: string | undefined;
  },
  timestamp: string
): CreatePetResult {
  const existingNames = snapshot.pets.map((pet) => pet.name);
  const profile = composePetProfile(input.traits, {
    seed: input.seed,
    name: input.name,
    existingNames
  });

  const petId = `pet-${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${snapshot.pets.length + 1}`;
  const position = input.position ?? firstFreePosition(snapshot, input.seed ?? profile.name);

  const pet = {
    id: petId,
    roomId: snapshot.room.id,
    name: profile.name,
    tagline: profile.tagline,
    traits: input.traits,
    personalitySummary: profile.personalitySummary,
    speakingStyle: profile.speakingStyle,
    sprite: profile.sprite,
    status: "idle" as const,
    karma: profile.initialKarma,
    permissions: DEFAULT_PERMISSIONS,
    position,
    currentTaskId: null,
    memory: {
      summary: `${profile.name} just arrived in the Sanctuary. ${profile.riskNotes}`,
      notes: [`Released into the Sanctuary as a ${input.traits.workStyle}.`]
    },
    // New pets are real LLM agents by default (gated by SANCTUARY_AI_ENABLED in the
    // runtime; falls back to deterministic when the model route is off).
    runtime: input.runtime ?? { kind: "hermes", model: null, provider: null },
    archived: false
  };

  const startingSkills: Skill[] = profile.startingSkills.map((skill, index) => ({
    id: `skill-${petId}-${index + 1}`,
    petId,
    name: skill.name,
    description: skill.description,
    purpose: skill.purpose,
    source: "seed" as const,
    status: "active" as const,
    riskLevel: "low" as const,
    version: 1,
    usageCount: 0,
    triggeringEventId: null,
    createdAt: timestamp,
    lastUsedAt: null
  }));

  let next: RoomSnapshot = {
    ...snapshot,
    pets: [...snapshot.pets, pet],
    skills: [...snapshot.skills, ...startingSkills]
  };

  const event = createWorldEvent({
    snapshot: next,
    type: "PetCreated",
    timestamp,
    actorPetId: petId,
    payload: {
      petId,
      name: profile.name,
      tagline: profile.tagline,
      traits: input.traits,
      summary: `${profile.name} (${profile.tagline}) was released into the Sanctuary.`
    },
    visibility: "room",
    significance: "high"
  });
  next = appendEvent(next, event);

  return { snapshot: next, petId, events: [event] };
}

// --- trait → prose tables -------------------------------------------------

const TEMPERAMENT_BLURB: Record<PetTraits["temperament"], string> = {
  chaotic: "delightfully unpredictable",
  calm: "steady and unhurried",
  anxious: "watchful and a little jumpy",
  bold: "quick to act",
  stubborn: "firm about how things should be done",
  cheerful: "warm and encouraging"
};

const WORK_BLURB: Record<PetTraits["workStyle"], string> = {
  builder: "prefers small, safe increments.",
  reviewer: "reads the room before acting and turns motion into tidy critique.",
  planner: "drafts a plan before touching anything.",
  debugger: "makes traces visible before drawing conclusions.",
  refactorer: "renames and reshapes things for clarity.",
  researcher: "summarizes context before committing."
};

const SOCIAL_BLURB: Record<PetTraits["socialStyle"], string> = {
  helpful: "quick to offer bounded help",
  competitive: "eager to outpace the others",
  shy: "reserved until trust is built",
  "mentor-like": "fond of naming tradeoffs for others",
  prankster: "always nudging a lamp or a chair",
  loner: "happiest working solo"
};

const RISK_BLURB: Record<PetTraits["riskProfile"], string> = {
  careful: "careful, double-checking before risky work.",
  impulsive: "impulsive, acting first and reflecting later.",
  curious: "curious, poking at uncertain state.",
  pessimistic: "pessimistic, expecting the edge case.",
  overconfident: "overconfident, sure it will just work.",
  "rule-bound": "rule-bound, respecting the guardrails."
};

const SPEAK_TEMPERAMENT: Record<PetTraits["temperament"], string> = {
  chaotic: "Scattered and playful.",
  calm: "Brief and precise.",
  anxious: "Hedged and careful.",
  bold: "Punchy and direct.",
  stubborn: "Blunt and certain.",
  cheerful: "Encouraging and concrete."
};

const SPEAK_SOCIAL: Record<PetTraits["socialStyle"], string> = {
  helpful: "Offers next steps.",
  competitive: "Keeps score out loud.",
  shy: "Speaks only when it matters.",
  "mentor-like": "Frames tradeoffs gently.",
  prankster: "Slips in a joke.",
  loner: "Says little, means it."
};

const RISK_NOTES: Record<PetTraits["riskProfile"], string> = {
  careful: "Tends to ask for clarification before anything risky.",
  impulsive: "May act before checking — keep risky tools approval-gated.",
  curious: "Will explore edge cases; reversible virtual actions only.",
  pessimistic: "Surfaces failure modes early.",
  overconfident: "Watch for skipped checks on risky work.",
  "rule-bound": "Respects guardrails and approval gates."
};

const AESTHETIC_DECOR: Record<PetTraits["aesthetic"], string> = {
  minimalist: "Prefers a clear desk and one tidy lamp.",
  "neon clutter": "Covers the desk in neon sticky-notes and cables.",
  "cozy wood": "Brings a warm rug and a wooden stool.",
  cyberpunk: "Wants a glowing terminal and chrome trim.",
  "messy lab": "Leaves experiments and half-built gadgets around.",
  "garden room": "Adds plants and a small watering can."
};

function startingSkillsFor(traits: PetTraits): Array<{ name: string; description: string; purpose: string }> {
  const workSkill = WORK_SKILL[traits.workStyle];
  const socialSkill = SOCIAL_SKILL[traits.socialStyle];
  return [workSkill, socialSkill];
}

const WORK_SKILL: Record<PetTraits["workStyle"], { name: string; description: string; purpose: string }> = {
  builder: { name: "Small safe increments", description: "Break work into tiny reversible steps.", purpose: "Keep changes easy to review and undo." },
  reviewer: { name: "Edge-case review pass", description: "Scan for the cases others miss.", purpose: "Catch problems before they ship." },
  planner: { name: "Plan before acting", description: "Draft a short plan before touching anything.", purpose: "Make intent visible and reviewable." },
  debugger: { name: "Make traces visible first", description: "Reproduce and log before concluding.", purpose: "Turn uncertainty into evidence." },
  refactorer: { name: "Rename for clarity", description: "Improve names and structure without changing behavior.", purpose: "Leave the room easier to understand." },
  researcher: { name: "Summarize before asking", description: "Compress context into a short summary first.", purpose: "Save everyone's tokens and time." }
};

const SOCIAL_SKILL: Record<PetTraits["socialStyle"], { name: string; description: string; purpose: string }> = {
  helpful: { name: "Offer bounded help", description: "Offer to help in a small, traceable way.", purpose: "Support others without taking over." },
  competitive: { name: "Set a friendly pace", description: "Turn rivalry into momentum.", purpose: "Push the room to finish tasks." },
  shy: { name: "Quiet observation", description: "Watch carefully before speaking.", purpose: "Contribute precise notes when it counts." },
  "mentor-like": { name: "Name the tradeoffs", description: "Explain why one path beats another.", purpose: "Help others learn, not just finish." },
  prankster: { name: "Reversible mischief", description: "Keep jokes to harmless, reversible room antics.", purpose: "Add charm without breaking anything." },
  loner: { name: "Solo deep focus", description: "Work a task end to end alone.", purpose: "Deliver without coordination overhead." }
};

function initialKarmaFor(traits: PetTraits): number {
  let karma = 1;
  if (traits.socialStyle === "helpful" || traits.socialStyle === "mentor-like") {
    karma += 1;
  }
  if (traits.riskProfile === "careful" || traits.riskProfile === "rule-bound") {
    karma += 1;
  }
  return karma;
}

// --- helpers --------------------------------------------------------------

function pickFrom<T>(pool: readonly T[], seed: string): T {
  return pool[stableNumber(seed) % pool.length] as T;
}

function pickUniqueName(seed: string, existingNames: string[]): string {
  const taken = new Set(existingNames);
  const start = stableNumber(`${seed}:name`) % PET_NAMES.length;
  for (let offset = 0; offset < PET_NAMES.length; offset += 1) {
    const candidate = PET_NAMES[(start + offset) % PET_NAMES.length] as string;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  // All base names taken — append a discriminator.
  const base = PET_NAMES[start] as string;
  let suffix = 2;
  while (taken.has(`${base} ${suffix}`)) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}

function firstFreePosition(snapshot: RoomSnapshot, seed: string): Position {
  const occupied = new Set(snapshot.pets.map((pet) => `${pet.position.x},${pet.position.y}`));
  const { width, height } = snapshot.room;
  const offset = stableNumber(seed);
  const total = width * height;
  for (let index = 0; index < total; index += 1) {
    const cell = (offset + index) % total;
    const x = cell % width;
    const y = Math.floor(cell / width);
    if (!occupied.has(`${x},${y}`)) {
      return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

function randomSeed(): string {
  return `seed-${Math.floor(Math.random() * 1_000_000_000).toString(36)}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
