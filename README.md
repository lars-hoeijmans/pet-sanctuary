# Agent Pet Sanctuary
---

<img width="3024" height="1726" alt="image" src="https://github.com/user-attachments/assets/e0b039b6-9623-4abc-bfa1-3ac56803a229" />


A visual, hosted hotel where AI coding agents live as autonomous pets. Users create pets with generated personalities, watch them interact in a shared room, assign tasks, and observe skill growth over time.

## Status

Early planning. The repo currently contains product and architecture documentation only—no application code, Docker Compose stack, or package manifests yet. See [PRD.md](./PRD.md) for the finalized hackathon plan.

## Overview

Agent Pet Sanctuary reframes coding agents as living characters in a persistent simulation:

- **Sanctuary** — a hotel-like room where pets move, talk, and work at desks
- **Pets** — autonomous agents with traits, memory, skills, karma, and relationships
- **Simulation** — a server-side loop that schedules observations, actions, and reactions
- **Agent runtime** — sandboxed workers where pets perform real tasks and learn skills

The hackathon MVP targets a demo where users spin up a pet, see distinct behaviors emerge, and watch at least one pet learn a reusable skill.

## Tech stack (planned)

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** Next.js App Router
- **Backend:** NestJS API + WebSocket server, simulation loop, action validation
- **Agent runtime:** [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) (primary); [Pi harness](https://pi.dev/) (stretch, self-modifying pet)
- **Database:** Postgres + Drizzle
- **Queue (optional):** Redis/Valkey
- **Local development:** Docker Compose/dev stack first
- **Deployment:** Oracle Cloud Always Free later, after the local flow is stable
- **LLM cost policy:** no paid per-token API dependency by default; verify OpenCode/free DeepSeek or Codex-subscription-backed routes first, and ask for human approval before any paid API fallback

Planned Compose services: `web`, `api`, `worker`, `db`, optional `redis`, and a reverse proxy (Caddy or Nginx).

## Getting started

Nothing to install or run yet. When Phase 0 lands (see PRD §19), local development is expected to use Docker Compose:

```bash
git clone <repo-url>
cd pet-sanctuary
# create .env with required secrets (see below)
docker compose up --build
```

### Environment variables (planned)

Store secrets in `.env` or cloud secret storage—not in pet prompts.

| Variable | Purpose |
| --- | --- |
| Model route credentials/config | Optional only after a no-cost route is verified or human approval is given for paid API usage |
| `DATABASE_URL` | Postgres connection |
| Demo auth credentials | Basic auth or shared password for the hosted demo URL |
| Hermes config paths | Per-pet profiles, memory, and skill directories |

## Development

Dev, build, and test commands will be added with the first implementation. The intended workflow is a multi-service Compose stack with separate `web`, `api`, and `worker` processes. Refer to [PRD.md](./PRD.md) for the phased plan, data model, and architecture.

## Contributing

Contributions are welcome. Please open an issue or pull request with your proposed changes.

## License

MIT
