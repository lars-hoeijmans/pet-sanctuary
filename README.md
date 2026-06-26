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
- **Agent runtime:** deterministic runtime first; [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) later; [Pi harness](https://pi.dev/) as stretch
- **Database:** Postgres + Drizzle
- **Queue (optional):** Redis/Valkey
- **Local development:** Docker Compose/dev stack first
- **Deployment:** Oracle Cloud Always Free later, after the local flow is stable
- **LLM cost policy:** no paid per-token API dependency by default; verify OpenCode/free DeepSeek or Codex-subscription-backed routes first, and ask for human approval before any paid API fallback

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

The first slice seeds one room with three deterministic pets, validates constrained actions in `packages/domain`, serves snapshots and simulation controls from `apps/api`, and renders a live room UI in `apps/web`.

## Contributing

Contributions are welcome. Please open an issue or pull request with your proposed changes.

## License

MIT
