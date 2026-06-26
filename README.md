# Agent Pet Sanctuary

A visual, hosted hotel where AI coding agents live as autonomous pets. Users create pets with generated personalities, watch them interact in a shared room, assign tasks, and observe skill growth over time.

## Status

Phase 0 and the first Living Room Kernel scaffold are underway. The repo now contains a pnpm/Turborepo workspace with shared domain/contracts/db packages, a NestJS API shell, and a Next.js placeholder UI for one deterministic room. See [PRD.md](./PRD.md) for the finalized hackathon plan.

## Overview

Agent Pet Sanctuary reframes coding agents as living characters in a persistent simulation:

- **Sanctuary** — a hotel-like room where pets move, talk, and work at desks
- **Pets** — autonomous agents with traits, memory, skills, karma, and relationships
- **Simulation** — a server-side loop that schedules observations, actions, and reactions
- **Agent runtime** — sandboxed workers where pets perform real tasks and learn skills

The hackathon MVP targets a demo where users spin up a pet, see distinct behaviors emerge, and watch at least one pet learn a reusable skill.

## Tech stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** Next.js App Router
- **Backend:** NestJS API + WebSocket server, simulation loop, action validation
- **Agent runtime:** real LLM agents driven through a locally-installed, subscription-backed agent CLI behind the `AgentRuntime` adapter (no paid per-token API); deterministic policy remains as the resilience fallback
- **Database:** Postgres + Drizzle
- **Queue (optional):** Redis/Valkey
- **Local development:** Docker Compose/dev stack first
- **Deployment:** Oracle Cloud Always Free later, after the local flow is stable
- **LLM cost policy:** no paid per-token API. Pets run on the user's flat-rate subscriptions through a local CLI — opencode + DeepSeek V4 Flash (free, OpenCode Zen) by default, or Hermes via the OpenAI Codex / GitHub Copilot subscription (PRD §16)

## Real LLM agents

Pets are real model-driven agents, not scripts. Both seams of the `AgentRuntime` adapter (`packages/agent-runtime`) are wired to a no-cost local CLI:

- **`decideAction`** — every meaningful world event (a new task, a room notice, a newcomer) and each simulation tick runs a real model call, *in the pet's voice*, that proposes one constrained action. The server re-validates every proposal (`applyPetAction`) — model output and inter-pet dialogue are untrusted (PRD §13).
- **`runTask`** — when a pet sits at a desk to work, a real model performs the task, the artifact it produces is persisted to the pet's workspace, and a learned skill is surfaced into the pet's profile.

Turn it on (already set in `.env.example`):

```bash
SANCTUARY_AI_ENABLED=true
SANCTUARY_AGENT_BACKEND=opencode            # free route, works today
SANCTUARY_AGENT_MODEL=opencode/deepseek-v4-flash-free
SANCTUARY_AGENT_FAST_MODEL=opencode/deepseek-v4-flash-free
```

To use **Hermes** instead (preferred per PRD §16 — uses the OpenAI Codex subscription; switch its model in `hermes model` to a GitHub Copilot model if Codex is rate-limited):

```bash
SANCTUARY_AGENT_BACKEND=hermes
SANCTUARY_AGENT_MODEL=gpt-5.5
# SANCTUARY_AGENT_PROVIDER=copilot
```

With `SANCTUARY_AI_ENABLED=false` (or no agent CLI installed) every pet falls back to the deterministic policy, so the world never stalls.

## Getting started

Install dependencies and start the local services:

```bash
cp .env.example .env
pnpm install
docker compose up -d db
pnpm --filter @pet-sanctuary/db db:migrate
pnpm dev
```

The API defaults to `http://localhost:3001` and the web app defaults to `http://localhost:3000`.

### Environment variables

Store secrets in `.env` or cloud secret storage—not in pet prompts.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection |
| `API_PORT` | API port, defaults to `3001` |
| `NEXT_PUBLIC_SANCTUARY_API_URL` | Browser-facing API URL |
| `NEXT_PUBLIC_SANCTUARY_SOCKET_URL` | Browser-facing Socket.IO namespace URL |
| Model route credentials/config | Optional later, only after a no-cost route is verified or human approval is given for paid API usage |

## Development

Useful commands:

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
```

The room seeds three distinct pets (Mochi, Byte, Nova) as real LLM agents, validates every constrained action in `packages/domain`, serves snapshots and simulation controls from `apps/api`, and renders a live room UI in `apps/web`.

## Contributing

Contributions are welcome. Please open an issue or pull request with your proposed changes.

## License

MIT
