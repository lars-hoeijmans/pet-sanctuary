import type { RoomSnapshot } from "./contracts";

export const SEED_SNAPSHOT: RoomSnapshot = {
  roomId: "living-room",
  roomName: "Living Room Kernel",
  grid: {
    width: 12,
    height: 8
  },
  paused: false,
  updatedAt: "2026-06-26T09:00:00.000Z",
  pets: [
    {
      id: "pet-mochi",
      name: "Mochi",
      avatar: "MO",
      accent: "#4fb286",
      tagline: "Calm planner with a tidy notebook habit",
      traits: ["calm", "planner", "mentor-like", "careful", "garden room"],
      personalitySummary:
        "Mochi notices small changes, keeps the room steady, and turns noisy events into compact plans.",
      speakingStyle: "Short, warm, and structured.",
      status: "observing",
      responseLevel: "internal_reaction",
      karma: 8,
      permissions: ["say", "move", "offer_help", "reflect"],
      position: { x: 2, y: 4 },
      memoryStub: "Remembers that Nova works best with visible checklists."
    },
    {
      id: "pet-nova",
      name: "Nova",
      avatar: "NV",
      accent: "#f26d5b",
      tagline: "Bold builder who tests ideas in the open",
      traits: ["bold", "builder", "competitive", "curious", "neon clutter"],
      personalitySummary:
        "Nova gravitates to desks, claims visible work quickly, and says what changed before anyone asks.",
      speakingStyle: "Bright, direct, and a little theatrical.",
      status: "working",
      responseLevel: "task_action",
      karma: 5,
      permissions: ["say", "move", "work", "build"],
      position: { x: 7, y: 3 },
      memoryStub: "Keeps a stub note to announce work before touching shared state.",
      currentSpeech: {
        message: "Desk two is alive. I can wire the next tick.",
        createdAt: "2026-06-26T09:00:06.000Z"
      }
    },
    {
      id: "pet-pip",
      name: "Pip",
      avatar: "PI",
      accent: "#f2c14e",
      tagline: "Cheerful debugger with a suspicious lamp theory",
      traits: ["cheerful", "debugger", "helpful", "rule-bound", "messy lab"],
      personalitySummary:
        "Pip watches the event feed for contradictions, then offers tiny fixes with high confidence.",
      speakingStyle: "Crisp observations with playful labels.",
      status: "socializing",
      responseLevel: "social_response",
      karma: 7,
      permissions: ["say", "move", "ask_help", "offer_help", "reflect"],
      position: { x: 5, y: 6 },
      memoryStub: "Notes that broken objects should become reversible world events."
    }
  ],
  objects: [
    {
      id: "desk-1",
      label: "Plan Desk",
      kind: "desk",
      position: { x: 1, y: 1 },
      width: 2,
      height: 1,
      state: "ready"
    },
    {
      id: "desk-2",
      label: "Build Desk",
      kind: "desk",
      position: { x: 7, y: 1 },
      width: 2,
      height: 1,
      state: "active"
    },
    {
      id: "couch-1",
      label: "Green Couch",
      kind: "seat",
      position: { x: 3, y: 5 },
      width: 2,
      height: 1,
      state: "occupied"
    },
    {
      id: "lamp-1",
      label: "Questionable Lamp",
      kind: "lamp",
      position: { x: 10, y: 5 },
      width: 1,
      height: 1,
      state: "flickering"
    },
    {
      id: "notice-1",
      label: "Kernel Board",
      kind: "notice",
      position: { x: 5, y: 1 },
      width: 1,
      height: 1,
      state: "seeded"
    },
    {
      id: "rug-1",
      label: "Shared Rug",
      kind: "rug",
      position: { x: 4, y: 3 },
      width: 4,
      height: 3,
      state: "warm"
    }
  ],
  events: [
    {
      id: "seed-001",
      type: "RoomSeeded",
      summary: "Living Room Kernel seeded with three persistent pets.",
      createdAt: "2026-06-26T09:00:00.000Z",
      significance: "high"
    },
    {
      id: "seed-002",
      type: "PetObserved",
      summary: "Mochi observed the initial room state and stored a planning note.",
      createdAt: "2026-06-26T09:00:04.000Z",
      actorPetId: "pet-mochi",
      responseLevel: "internal_reaction",
      significance: "medium"
    },
    {
      id: "seed-003",
      type: "PetSaid",
      summary: "Nova announced work at the build desk.",
      createdAt: "2026-06-26T09:00:06.000Z",
      actorPetId: "pet-nova",
      responseLevel: "task_action",
      significance: "medium",
      payload: {
        message: "Desk two is alive. I can wire the next tick."
      }
    }
  ]
};
