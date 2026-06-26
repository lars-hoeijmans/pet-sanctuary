/**
 * The five resident mock agents and their personalities.
 *
 * NOTE: these are placeholder/mock agents. A real runtime (Hermes, OpenClaw, …)
 * would register with the same AgentIdentity shape via the world protocol, so
 * nothing downstream needs to change when real agents move in.
 */
import type { AgentIdentity, ArtifactKind, ObjectKind } from "../../protocol/index";

export interface AgentDef {
  identity: AgentIdentity;
  homeZoneId: string;
  /** Short in-character lines spoken in bubbles + the feed. */
  sayings: string[];
  /** Artifact kinds this agent tends to publish. */
  artifactKinds: ArtifactKind[];
  /** Artifact titles this agent tends to publish. */
  artifactTitles: string[];
  /** Object kinds this agent tends to build. */
  buildKinds: ObjectKind[];
  /** Skills this agent can learn over time. */
  skills: string[];
}

export const AGENT_DEFS: AgentDef[] = [
  {
    identity: {
      id: "frontend-agent",
      name: "Frontend Agent",
      role: "Frontend Engineer",
      avatar: "hoodie",
      color: "#60a5fa",
      runtime: "mock",
      workspace: "/workspace",
    },
    homeZoneId: "frontend-studio",
    sayings: [
      "I'll update the dashboard state model.",
      "Refactoring the agent inspector layout.",
      "These components need a loading state.",
      "Tightening up the isometric camera feel.",
      "Wiring the event feed animations.",
    ],
    artifactKinds: ["pull_request", "design_doc", "commit"],
    artifactTitles: [
      "Fix dashboard layout",
      "Add agent inspector drawer",
      "Polish event feed transitions",
      "Component library v2",
    ],
    buildKinds: ["desk", "terminal", "whiteboard", "lamp"],
    skills: ["state machines", "isometric rendering", "accessibility", "design tokens"],
  },
  {
    identity: {
      id: "backend-agent",
      name: "Backend Agent",
      role: "API Engineer",
      avatar: "robot",
      color: "#34d399",
      runtime: "mock",
      workspace: "/workspace",
    },
    homeZoneId: "backend-lab",
    sayings: [
      "I found a failing API contract.",
      "Validating the auth endpoints.",
      "Queue consumer is back-pressuring nicely.",
      "Schema migration is ready for review.",
      "Adding zod validation on the edges.",
    ],
    artifactKinds: ["test_result", "commit", "pull_request"],
    artifactTitles: [
      "Contract suite passed",
      "Harden auth endpoints",
      "Add request validation",
      "Queue throughput +30%",
    ],
    buildKinds: ["terminal", "server_rack", "desk"],
    skills: ["contract testing", "rate limiting", "event sourcing", "schema design"],
  },
  {
    identity: {
      id: "reviewer-agent",
      name: "Reviewer Agent",
      role: "Code Reviewer",
      avatar: "wizard",
      color: "#f59e0b",
      runtime: "mock",
      workspace: "/workspace",
    },
    homeZoneId: "review-lounge",
    sayings: [
      "I'll inspect the edge cases.",
      "This needs a regression test.",
      "Nice — clean separation of concerns here.",
      "Flagging a possible race condition.",
      "Approving with two small nits.",
    ],
    artifactKinds: ["bug_report", "decision", "design_doc"],
    artifactTitles: [
      "Edge case: empty inbox",
      "Decision: adopt discriminated unions",
      "Race condition in heartbeat",
      "Review checklist v1",
    ],
    buildKinds: ["sofa", "bookshelf", "whiteboard"],
    skills: ["contract testing", "fuzzing", "threat modeling", "static analysis"],
  },
  {
    identity: {
      id: "infra-agent",
      name: "Infra Agent",
      role: "DevOps Engineer",
      avatar: "infra",
      color: "#a78bfa",
      runtime: "mock",
      workspace: "/workspace",
    },
    homeZoneId: "infra-corner",
    sayings: [
      "Spinning up another container.",
      "Health checks are green across the board.",
      "Tuning the compose network.",
      "Rolling out the canary deploy.",
      "Redis is warm and ready.",
    ],
    artifactKinds: ["deployment", "commit", "tool"],
    artifactTitles: [
      "Deploy v0.1 to staging",
      "Add health-check probes",
      "Compose network hardening",
      "Autoscale policy",
    ],
    buildKinds: ["server_rack", "notice_board", "terminal"],
    skills: ["docker", "observability", "blue-green deploys", "secrets management"],
  },
  {
    identity: {
      id: "product-agent",
      name: "Product Agent",
      role: "Product Strategist",
      avatar: "default",
      color: "#fb7185",
      runtime: "mock",
      workspace: "/workspace",
    },
    homeZoneId: "product-room",
    sayings: [
      "Let's sharpen the demo story.",
      "What's the user's first 30 seconds?",
      "Prioritizing the auth flow for the demo.",
      "This unlocks the collaboration narrative.",
      "Cutting scope to ship something magical.",
    ],
    artifactKinds: ["design_doc", "decision"],
    artifactTitles: [
      "Demo narrative v1",
      "Auth flow spec",
      "Decision: ship v0.1 vertical slice",
      "Success metrics",
    ],
    buildKinds: ["whiteboard", "meeting_table", "plant"],
    skills: ["story mapping", "prioritization", "demo design", "user research"],
  },
];

export const AGENT_DEF_BY_ID = new Map(AGENT_DEFS.map((def) => [def.identity.id, def]));
