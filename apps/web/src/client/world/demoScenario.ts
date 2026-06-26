/**
 * Deterministic, timed demo sequence. Mirrors §17 of the build spec.
 * Returns a cancel function so /demo/stop and reset can halt it cleanly.
 */
import type { WorldEvent } from "../../protocol/index";
import { ev } from "./eventFactory";
import { AGENT_DEF_BY_ID } from "./agentDefs";
import { zoneCenter } from "./zones";

interface Step {
  at: number;
  run: () => void;
}

const A = {
  frontend: "frontend-agent",
  backend: "backend-agent",
  reviewer: "reviewer-agent",
  infra: "infra-agent",
  product: "product-agent",
} as const;

function home(agentId: string) {
  const zoneId = AGENT_DEF_BY_ID.get(agentId)?.homeZoneId;
  return zoneCenter(zoneId ?? "central-plaza");
}

/** A tile offset from a zone's centre — keeps demo coords robust to layout. */
function tile(zoneId: string, dx = 0, dy = 0) {
  const c = zoneCenter(zoneId);
  return { x: c.x + dx, y: c.y + dy, roomId: c.roomId };
}

/** Spread tiles around Central Plaza so agents don't stack at the finale. */
const PLAZA_GATHER = [
  tile("central-plaza", 0, -2),
  tile("central-plaza", -2, -2),
  tile("central-plaza", 2, -1),
  tile("central-plaza", -1, -1),
  tile("central-plaza", 1, -1),
];

export function runDemo(emit: (event: WorldEvent) => void, onDone: () => void): () => void {
  let taskId: string | null = null;
  let convId: string | null = null;

  const steps: Step[] = [
    {
      at: 0,
      run: () => {
        emit(ev.notification("Demo starting", "Watch the agent society collaborate.", "info"));
        emit(ev.move(A.product, home(A.product), "Heading to the Product Room"));
        emit(ev.move(A.backend, home(A.backend), "Back to the Backend Lab"));
        emit(ev.move(A.reviewer, home(A.reviewer), "Settling into the Review Lounge"));
        emit(ev.move(A.infra, home(A.infra), "Checking Infra Corner"));
        emit(ev.move(A.frontend, home(A.frontend), "Opening the Frontend Studio"));
      },
    },
    {
      at: 1500,
      run: () => {
        emit(ev.status(A.product, "thinking", { mood: "focused" }));
        emit(ev.say(A.product, "Let's sharpen the demo story."));
      },
    },
    {
      at: 2800,
      run: () => {
        const event = ev.taskCreated("Design auth flow demo", "Define the auth flow we showcase in the demo.", A.product);
        if (event.type === "task.created") taskId = event.task.id;
        emit(event);
      },
    },
    {
      at: 4200,
      run: () => {
        emit(ev.status(A.backend, "thinking", { mood: "focused" }));
        emit(ev.say(A.backend, "I'll validate the API contract."));
      },
    },
    {
      at: 5200,
      run: () => {
        if (taskId) emit(ev.taskClaimed(taskId, A.backend));
      },
    },
    {
      at: 5800,
      run: () => {
        emit(ev.move(A.backend, tile("backend-lab", 1, 1), "Inspecting the API contract"));
        emit(ev.status(A.backend, "coding", { currentTask: "Validate API contract" }));
      },
    },
    { at: 7200, run: () => emit(ev.say(A.backend, "I found a failing API contract.")) },
    {
      at: 8200,
      run: () => emit(ev.message(A.backend, A.reviewer, "Can you review the contract fix?")),
    },
    {
      at: 9200,
      run: () => {
        emit(ev.move(A.reviewer, tile("backend-lab", -1, 1), "Joining Backend Agent"));
        emit(ev.status(A.reviewer, "reviewing", { mood: "focused" }));
        emit(ev.say(A.reviewer, "I'll inspect the edge cases."));
      },
    },
    {
      at: 10800,
      run: () => {
        const event = ev.conversationStarted([A.backend, A.reviewer], "API contract review");
        if (event.type === "conversation.started") convId = event.conversation.id;
        emit(event);
      },
    },
    {
      at: 12200,
      run: () => {
        emit(ev.say(A.frontend, "I'll update the dashboard state model."));
        emit(ev.status(A.frontend, "coding", { currentTask: "Dashboard state model" }));
        emit(ev.move(A.frontend, tile("frontend-studio"), "Frontend Studio"));
      },
    },
    {
      at: 13800,
      run: () => {
        emit(ev.status(A.infra, "building"));
        emit(ev.build(A.infra, "server_rack", tile("infra-corner"), "Edge cache", 1200));
      },
    },
    {
      at: 15200,
      run: () => {
        emit(ev.status(A.product, "building"));
        emit(ev.build(A.product, "whiteboard", tile("product-room", 2, 1), "Auth Flow", 1000));
      },
    },
    {
      at: 16600,
      run: () =>
        emit(ev.artifact(A.backend, "test_result", "Contract suite passed", "42 passing, 0 failing.")),
    },
    {
      at: 18000,
      run: () =>
        emit(ev.artifact(A.frontend, "pull_request", "Fix dashboard layout", "Updated the agent inspector layout.")),
    },
    { at: 19200, run: () => emit(ev.skillLearned(A.reviewer, "contract testing", "Reviewed the contract fix")) },
    {
      at: 20200,
      run: () => {
        if (convId) emit(ev.conversationEnded(convId, "Agreed on the contract fix and added a regression test."));
      },
    },
    {
      at: 20800,
      run: () =>
        emit(ev.artifact(A.infra, "deployment", "Deploy v0.1 to staging", "Health checks green.")),
    },
    {
      at: 22200,
      run: () => {
        if (taskId) emit(ev.taskCompleted(taskId, A.backend, "API contract validated", []));
      },
    },
    {
      at: 23200,
      run: () => {
        emit(ev.move(A.product, PLAZA_GATHER[0], "Gathering in the plaza"));
        emit(ev.move(A.backend, PLAZA_GATHER[1], "Gathering in the plaza"));
        emit(ev.move(A.reviewer, PLAZA_GATHER[2], "Gathering in the plaza"));
        emit(ev.move(A.infra, PLAZA_GATHER[3], "Gathering in the plaza"));
        emit(ev.move(A.frontend, PLAZA_GATHER[4], "Gathering in the plaza"));
      },
    },
    {
      at: 25000,
      run: () => {
        emit(ev.memoryUpdated(A.reviewer, "Contract testing prevents regressions on the auth endpoints."));
        emit(ev.status(A.product, "shipping", { mood: "excited" }));
      },
    },
    {
      at: 26200,
      run: () => emit(ev.notification("Agent society shipped v0.1", "The first vertical slice is live.", "success")),
    },
    {
      at: 27800,
      run: () => {
        for (const id of Object.values(A)) emit(ev.status(id, "idle", { mood: "happy" }));
        onDone();
      },
    },
  ];

  const timers = steps.map((step) => setTimeout(step.run, step.at));

  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}
