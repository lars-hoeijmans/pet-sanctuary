/**
 * Smoke test — exercises the pure protocol layer end to end with no server.
 * Run with: npm run smoke
 *
 * Exits non-zero on any failed assertion so it can gate CI / the build.
 */
import {
  applyWorldEvent,
  createEmptyWorld,
  humanizeEvent,
  parseWorldEvent,
  type WorldEvent,
  type WorldSnapshot,
} from "../protocol/index";

let failures = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    failures += 1;
    console.error(`  ✗ ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

function ts(offset: number): number {
  // Fixed base time keeps the smoke test deterministic.
  return 1_760_000_000_000 + offset;
}

const events: WorldEvent[] = [
  {
    type: "agent.register",
    eventId: "evt-1",
    ts: ts(1),
    agent: {
      id: "backend-agent",
      name: "Backend Agent",
      role: "API Engineer",
      avatar: "robot",
      color: "#34d399",
      runtime: "mock",
    },
    initialPosition: { x: 3, y: 4, roomId: "Backend Lab" },
  },
  {
    type: "agent.heartbeat",
    eventId: "evt-2",
    ts: ts(2),
    agentId: "backend-agent",
    status: "thinking",
  },
  {
    type: "agent.move",
    eventId: "evt-3",
    ts: ts(3),
    agentId: "backend-agent",
    to: { x: 5, y: 6, roomId: "Backend Lab" },
    reason: "Inspecting the API contract",
  },
  {
    type: "agent.say",
    eventId: "evt-4",
    ts: ts(4),
    agentId: "backend-agent",
    text: "I found a failing API contract.",
  },
  {
    type: "agent.build",
    eventId: "evt-5",
    ts: ts(5),
    agentId: "backend-agent",
    object: {
      id: "obj-rack-1",
      kind: "server_rack",
      position: { x: 2, y: 3 },
      ownerAgentId: "backend-agent",
      label: "Edge cache",
    },
  },
  {
    type: "task.created",
    eventId: "evt-6",
    ts: ts(6),
    task: {
      id: "task-1",
      title: "Validate API contract",
      description: "Ensure the auth endpoints match the published schema.",
      status: "open",
      createdByAgentId: "backend-agent",
      createdAt: ts(6),
      updatedAt: ts(6),
    },
  },
  {
    type: "task.claimed",
    eventId: "evt-7",
    ts: ts(7),
    taskId: "task-1",
    agentId: "backend-agent",
  },
  {
    type: "agent.artifact",
    eventId: "evt-8",
    ts: ts(8),
    artifact: {
      id: "art-1",
      agentId: "backend-agent",
      kind: "test_result",
      title: "Contract suite passed",
      summary: "42 passing, 0 failing.",
      createdAt: ts(8),
    },
  },
  {
    type: "task.completed",
    eventId: "evt-9",
    ts: ts(9),
    taskId: "task-1",
    agentId: "backend-agent",
    result: "Contract validated",
    artifactIds: ["art-1"],
  },
  {
    type: "agent.skill.learned",
    eventId: "evt-10",
    ts: ts(10),
    agentId: "backend-agent",
    skill: "contract testing",
  },
];

console.log("Agent City smoke test\n");

// 1. Validation: every fixture event must pass Zod parsing.
console.log("Schema validation:");
for (const event of events) {
  try {
    parseWorldEvent(event);
    assert(true, `valid event: ${event.type}`);
  } catch {
    assert(false, `valid event: ${event.type}`);
  }
}

// 1b. Reject an obviously malformed event.
let rejected = false;
try {
  parseWorldEvent({ type: "agent.say", eventId: "x", ts: ts(0) }); // missing text/agentId
} catch {
  rejected = true;
}
assert(rejected, "rejects malformed agent.say");

// 1c. Reject unknown event type.
let unknownRejected = false;
try {
  parseWorldEvent({ type: "agent.teleport", eventId: "x", ts: ts(0) });
} catch {
  unknownRejected = true;
}
assert(unknownRejected, "rejects unknown event type");

// 2. Reducer: fold the whole sequence and assert resulting state.
console.log("\nReducer state:");
const world: WorldSnapshot = events.reduce(applyWorldEvent, createEmptyWorld());

const agent = world.agents["backend-agent"];
assert(!!agent, "agent registered");
assert(agent?.position.x === 5 && agent?.position.y === 6, "agent moved to (5,6)");
assert(agent?.skills.includes("contract testing"), "agent learned contract testing");
assert(Object.keys(world.objects).length === 1, "one object built");
assert(world.artifacts.length === 1, "one artifact published");
assert(world.artifacts[0]?.id === "art-1", "newest artifact first");

const task = world.tasks.find((t) => t.id === "task-1");
assert(task?.status === "completed", "task completed");
assert(task?.assignedAgentId === "backend-agent", "task assigned correctly");
assert(world.seq === events.length, `seq advanced to ${events.length}`);
assert(world.events.length === events.length, "all events logged");

// 3. Idempotent register: re-registering keeps learned skills and position.
const reRegistered = applyWorldEvent(world, {
  type: "agent.register",
  eventId: "evt-re",
  ts: ts(11),
  agent: {
    id: "backend-agent",
    name: "Backend Agent",
    role: "API Engineer",
    avatar: "robot",
    color: "#34d399",
    runtime: "mock",
  },
});
assert(
  reRegistered.agents["backend-agent"]?.skills.includes("contract testing"),
  "re-register preserves skills",
);

// 4. Humanize: produces non-empty readable strings for every event.
console.log("\nHumanize:");
let humanizeOk = true;
for (const event of events) {
  const line = humanizeEvent(event, world);
  if (!line || line.length < 3) humanizeOk = false;
}
assert(humanizeOk, "humanizeEvent returns readable lines");

console.log("");
if (failures > 0) {
  console.error(`SMOKE FAILED — ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("SMOKE OK");
