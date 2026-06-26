/**
 * Society Server — PLACEHOLDER backend (reference implementation).
 *
 * The frontend ships standalone using the client-side MockWorldSource, so this
 * server is NOT required to run the demo. It exists so a colleague can connect
 * real agent containers later: it validates every inbound event with the shared
 * Zod schema, folds it through the shared reducer, and broadcasts over Socket.IO.
 *
 * Run with: npm run dev:server   (after installing express + socket.io)
 * Excluded from the frontend build (see tsconfig.json).
 */
import http from "node:http";
import express from "express";
import { Server } from "socket.io";
import { parseWorldEvent } from "../../../src/protocol/index";
import { WorldStore } from "./worldStore";

// Minimal base furniture so the city isn't empty on reset.
import { baseWorldObjects } from "../../../src/client/world/zones";

const PORT = Number(process.env.PORT ?? 3001);

const store = new WorldStore(baseWorldObjects);
const app = express();
app.use(express.json());
// CORS for the Vite dev origin.
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "content-type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  next();
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

function broadcast(event: ReturnType<typeof store.apply>): void {
  io.emit("world:event", event);
}

io.on("connection", (socket) => {
  socket.emit("world:snapshot", store.getSnapshot());
  socket.on("world:event", (raw: unknown) => {
    try {
      broadcast(store.apply(parseWorldEvent(raw)));
    } catch {
      socket.emit("world:error", { message: "invalid event" });
    }
  });
});

// ---- REST API ----

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/world", (_req, res) => res.json(store.getSnapshot()));

app.post("/api/world/events", (req, res) => {
  try {
    broadcast(store.apply(parseWorldEvent(req.body)));
    res.json({ ok: true, seq: store.getSnapshot().seq });
  } catch {
    res.status(400).json({ ok: false, error: "invalid event" });
  }
});

app.get("/api/agents/:agentId/inbox", (req, res) => res.json(store.getInbox(req.params.agentId)));

app.post("/api/agents/:agentId/messages", (req, res) => {
  const { fromAgentId, message, threadId } = req.body ?? {};
  broadcast(store.apply(store.message(fromAgentId, req.params.agentId, message, threadId)));
  res.json({ ok: true });
});

app.get("/api/tasks", (_req, res) => res.json(store.getTasks()));

app.post("/api/tasks", (req, res) => {
  const { title, description, createdByAgentId } = req.body ?? {};
  broadcast(store.apply(store.taskCreated(title, description ?? "", createdByAgentId)));
  res.json({ ok: true });
});

app.post("/api/tasks/:taskId/claim", (req, res) => {
  broadcast(store.apply(store.taskClaimed(req.params.taskId, req.body?.agentId)));
  res.json({ ok: true });
});

app.post("/api/tasks/:taskId/complete", (req, res) => {
  const { agentId, result, artifactIds } = req.body ?? {};
  broadcast(store.apply(store.taskCompleted(req.params.taskId, agentId, result ?? "done", artifactIds)));
  res.json({ ok: true });
});

app.post("/api/demo/reset", (_req, res) => {
  const snapshot = store.reset();
  io.emit("world:reset", snapshot);
  res.json({ ok: true });
});

// NOTE: the rich deterministic demo lives client-side (MockWorldSource). When
// real agents are connected, demo orchestration would live here instead.
app.post("/api/demo/play", (_req, res) => res.json({ ok: true, note: "demo orchestration is a TODO for the live backend" }));
app.post("/api/demo/stop", (_req, res) => res.json({ ok: true }));

server.listen(PORT, () => {
  console.info(`[world-server] listening on http://localhost:${PORT}`);
});
