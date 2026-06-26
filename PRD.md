# Agent Pet Sanctuary — Final Hackathon PRD & Architecture Recommendation

**Date:** 2026-06-26

**Status:** Finalized hackathon PRD for implementation

**Working title:** Agent Pet Sanctuary

**Owners:** Aidan + team

**Purpose:** Merge the Codex and Claude PRDs, resolve the most important product and architecture decisions, and ground the plan in current hosting and agent-harness research.

---

## 1. Executive decision summary

We should build **a hosted, visual, living “hotel” for AI coding-agent pets**. The demo should prove three things: pets feel distinct, the world visibly changes over time, and at least one pet can “learn” a reusable skill or capability that is shown back to the user.

Recommended implementation decisions:

1. **Use Hermes Agent as the primary hackathon runtime for self-learning pets.** Hermes has built-in learning loops, agent-managed skills, persistent memory, profiles, multi-agent collaboration primitives, Docker/remote backends, gateway/dashboard modes, and approval gates. This makes it the safer and faster fit for a hosted hackathon demo.
2. **Use Pi Coding Agent/Harness as a stretch path for the “wild self-mutating pet” mechanic.** Pi is stronger if the desired demo is “the pet edits its own harness/extensions/tools and reloads itself.” That is a great spectacle, but it is riskier for a short hackathon because Pi’s extension code runs with process permissions and reloads can reset runtime state.
3. **Do not run every idle pet as its own full container.** Represent pets as logical agents with separate identity, memory, skill/profile directories, and state. Run a small shared worker pool. Use per-pet sandbox containers only when a pet executes code, modifies tools, or performs unsafe work.
4. **Build and validate locally first; deploy to Oracle Cloud later.** The first implementation target is a local Docker Compose/dev setup. Oracle Cloud Always Free remains the likely demo hosting target, but deployment should wait until the local Living Room Kernel and core collaboration loop are working.
5. **Use structured world descriptions, not screenshots, as the default agent perception model.** The UI can be visual and Habbo-like, but agents should reason over compact JSON/text world state. Screenshots and vision models are a stretch feature.
6. **Make destructive behavior reversible and virtual-only in v1.** “Destroy,” “steal,” or “sabotage” can exist as toy-world actions that affect room objects and karma, not host files, real repositories, credentials, or infrastructure.
7. **Ship audio as stretch only.** Text bubbles and event logs are enough for the demo. Voices/music can be added if the main slice is stable.
8. **Start with the living multi-agent core, not pet generation.** The first implementation slice should prove that multiple distinct hard-coded agents can inhabit the same persistent room, observe shared state, take validated actions, and produce visible events. Pet generation should be added after this core loop exists.
9. **Use world-mediated collaboration, not private model-to-model chat.** Pets should communicate by creating visible world events such as speech, help offers, task claims, plans, reviews, and handoffs. Other pets notice those events through structured observations and may react later.
10. **Use a TypeScript monorepo with Next.js and NestJS.** The product should be built as a pnpm/Turborepo monorepo with a Next.js frontend, NestJS backend, shared TypeScript domain/contracts packages, Postgres + Drizzle, Zod validation, and a staged agent-runtime adapter.
11. **Treat the Vercel AI SDK as optional model-call plumbing only.** The AI SDK must not run the world server, simulation, collaboration protocol, permissions, or task orchestration. It can later be used inside an `AiSdkRuntime` adapter to ask a model for one structured proposed pet action.
12. **Do not depend on paid per-token LLM APIs by default.** Agent-backed behavior should first try no-incremental-cost routes such as a free OpenCode/DeepSeek V4 Flash option if available, or an existing Codex subscription path through Hermes or a compatible harness if technically and contractually supported. If those routes are not viable, pause and ask for a human-in-the-loop decision before using a paid API.

---

## 2. Product vision

Agent Pet Sanctuary is a playful, visual control surface for autonomous coding agents. Instead of seeing agents as invisible command-line tools, the user sees them as living pets in a shared hotel-like world. Each pet has a generated personality, a visible body, a workspace, relationships, karma, memory, and a growing set of skills.

The emotional promise is:

> “Your coding agents are alive. You do not just run them; you raise, observe, and collaborate with them.”
> 

The hackathon version should feel like opening a tiny autonomous society: pets walk around, talk, go to desks to work, help each other, earn or lose karma, and visibly learn new skills.

---

## 3. Problem and opportunity

Modern coding agents are powerful, but their behavior is mostly represented as logs, terminal output, and opaque task traces. That makes them hard to understand emotionally and hard to compare intuitively. The project reframes agent work as a living simulation. It makes invisible agent state visible: personality becomes behavior, task status becomes movement, tool use becomes desk work, skill growth becomes progression, and agent collaboration becomes social interaction.

This is especially good for a hackathon because it has a clear demo hook: judges can understand it in seconds, then watch surprising interactions unfold.

---

## 4. Target audience

Primary users for the hackathon:

- Hackathon judges and viewers who need to understand the concept quickly.
- AI-tool enthusiasts who already understand coding agents and will appreciate the “agents as pets” inversion.
- Developers who want a more delightful, inspectable interface for multi-agent work.

Secondary future users:

- Builders who want persistent personal agents with identity and memory.
- Researchers and hobbyists interested in multi-agent simulations and emergent behavior.
- Teams experimenting with agent swarms but needing a more legible control surface.

---

## 5. Product goals

### Goals for the hackathon MVP

1. **Make agents feel alive.** At least three pets should exhibit visibly different behavior, dialogue, and work preferences.
2. **Make the world visible and persistent.** Users should see a room/hotel that changes and survives refresh/restart.
3. **Make pet creation delightful.** The random spinner should produce a memorable pet identity in under one minute.
4. **Make self-learning legible.** At least one pet should create, improve, or unlock a skill, and the UI should show that growth.
5. **Make autonomy safe.** Pets can be chaotic in the virtual world, but real tools, host files, and credentials must be protected.

### Non-goals for the hackathon MVP

- No pixel-perfect Habbo clone.
- No local LLM hosting on Oracle Free Tier.
- No open-ended destructive access to real systems.
- No full production-grade agent marketplace.
- No support for every model provider on day one.
- No real-time audio or generated music as a required path.
- No high-frequency 24/7 agent loop that burns tokens continuously.

---

## 6. Core product concept

The product has four core layers:

1. **The Sanctuary:** a visual hotel-like room where pets move, talk, work, build, and decorate.
2. **The Pets:** autonomous coding-agent characters with generated traits, personality, memory, skills, and state.
3. **The Simulation:** a server-side loop that decides when pets observe, think, act, and react.
4. **The Agent Runtime:** a sandboxed worker/harness layer where pets can perform actual useful work or create reusable skills.

The user interacts through a “manager console” and the visual room. They can create pets, inspect them, give tasks, pause them, approve skill/tool changes, and watch the event feed.

---

## 7. MVP demo story

A successful 4–6 minute demo should flow like this:

1. The user opens the hosted sanctuary URL.
2. A Habbo-like room appears with two existing pets talking or idling.
3. The user clicks **Create Pet**.
4. A spinner rolls five traits, such as:
    - temperament: chaotic
    - work style: reviewer
    - social style: helpful
    - risk profile: impulsive
    - aesthetic: neon clutter
5. The system generates a pet name, personality card, sprite, quirks, and starting skills.
6. The new pet enters the room. Existing pets react in speech bubbles.
7. The user gives a small coding-style task, such as “make a helper script for summarizing event logs.”
8. One pet walks to a desk and starts working. Another pet offers advice or critique based on personality.
9. The worker/harness creates or updates a reusable skill, visible in the pet’s profile.
10. The karma/event feed records the interaction: “Mochi helped DebugGoblin +2 karma” or “OpusGremlin broke a lamp -1 karma.”
11. The user refreshes the page and the room state persists.

The most important demo moment: a pet behaves in a way that matches its generated personality, then visibly grows a skill.

---

## 8. Pet creation requirements

Pet creation is important for the full hackathon demo, but it should not be the first implementation slice. The first slice can use two or three seeded pets with hard-coded traits, personalities, skills, permissions, and room positions. Once those pets can actually live inside the shared world, the creation spinner becomes a generator for the same persisted pet profile shape.

### User experience

Pet creation should feel like a mini-game, not a form.

Required flow:

1. User clicks **Create Pet**.
2. The UI shows a spinner/slot-machine sequence.
3. The system rolls five traits from separate categories.
4. The user can optionally reroll once, but cannot manually design everything.
5. The AI composes a full personality from the traits.
6. The user sees a pet card and clicks **Release into Sanctuary**.

### Trait categories

Use five categories for MVP:

1. **Temperament:** chaotic, calm, anxious, bold, stubborn, cheerful.
2. **Work style:** builder, reviewer, planner, debugger, refactorer, researcher.
3. **Social style:** helpful, competitive, shy, mentor-like, prankster, loner.
4. **Risk profile:** careful, impulsive, curious, pessimistic, overconfident, rule-bound.
5. **Aesthetic preference:** minimalist, neon clutter, cozy wood, cyberpunk, messy lab, garden room.

### Generated outputs

The generated pet profile must include:

- Name.
- Short tagline.
- Five rolled traits.
- Personality summary.
- Speaking style.
- Preferred work behavior.
- Starting skill(s).
- Risk notes.
- Visual preference for room/desk decoration.
- Initial karma score.

### Acceptance criteria

- Creation takes less than one minute.
- Resulting pets are meaningfully different from each other.
- Trait data is persisted and inspectable.
- Traits influence both dialogue and at least one behavior choice.

---

## 9. Sanctuary / world requirements

### MVP world

Start with one shared room rather than a full hotel. The room should feel expandable but not require multiple rooms.

Required room features:

- Top-down or isometric view.
- Movable camera or draggable viewport if the room is larger than the screen.
- Pet sprites or avatars.
- Desks/workstations.
- Placeable/decorative objects.
- Text bubbles above pets.
- Event feed/sidebar.
- Pet detail drawer.

### World state

The world must be represented as structured state, not only pixels. Agents should receive compact observations like:

```json
{
  "room": "main_hotel_lobby",
  "pet": "Mochi",
  "nearby_pets": ["DebugGoblin", "RefactorRaccoon"],
  "objects_nearby": ["desk_2", "green_couch", "broken_lamp"],
  "recent_events": [
    "DebugGoblin asked for help with a log parser",
    "RefactorRaccoon criticized the naming"
  ],
  "available_actions": ["say", "move", "work", "help", "build", "decorate", "request_skill"]
}
```

This keeps token use predictable and works with non-vision models. Screenshots can be added later for vision-capable pets.

### Acceptance criteria

- At least three pets can exist in the room at once.
- Pet positions and objects persist.
- Users can inspect each pet’s current state.
- Room changes are visible in the UI and reflected in structured world state.

---

## 10. Pet behavior requirements

Pets should run on a low-frequency simulation loop. They do not need to call an LLM every second. Most ticks can be cheap deterministic simulation; LLM calls should happen when a pet needs to speak, plan, work, or take a high-value reaction to an important event.

Models do not literally live inside the world server or continuously watch the database. The product should create that feeling through a server-owned perception and response system: world events are written to the event log, significant events are perceived by every active pet in scope, and the orchestrator classifies each pet's response level. Not every pet needs to take a world-changing action to feel alive.

### Pet states

MVP states:

- Idle.
- Observing.
- Reacting.
- Socializing.
- Moving.
- Working.
- Helping.
- Decorating/building.
- Learning/updating skill.
- Paused.

### Pet actions

MVP actions:

- `say(message, target?)`
- `move(x, y)`
- `work(task_id)`
- `ask_help(target_pet, task_id)`
- `offer_help(target_pet, task_id)`
- `build(object_type, location)`
- `decorate(object_id, style)`
- `request_skill(name, purpose)`
- `reflect(memory_note)`

Collaboration actions that can be added during the task/collaboration slice:

- `claim_task(task_id, reason)`
- `decline_task(task_id, reason)`
- `propose_plan(task_id, summary)`
- `request_review(target_pet, task_id)`
- `accept_help(target_pet, task_id)`
- `handoff_task(target_pet, task_id, reason)`

### Perception and response levels

When a meaningful world event happens, the orchestrator should run a perception pass before deciding who acts. For significant room-level events, every active pet should perceive the event. For local or noisy events, nearby or relevant pets can receive detailed observations while the rest receive a summary later.

Each pet then gets a response level:

- `observe_only`: the pet perceives the event but produces no visible output.
- `internal_reaction`: mood, attention, memory, or relationship state may change without a visible event.
- `ambient_reaction`: the pet emits a lightweight visible reaction such as a short aside, emote, glance, or movement.
- `social_response`: the pet can say something, offer help, ask for help, propose a plan, or request review.
- `task_action`: the pet can claim work, hand off work, move to a desk, start work, or request a skill.

This makes the room feel alive without requiring every pet to perform an expensive model call or world-changing action for every event.

### Collaboration model

Pets collaborate through the shared world state and append-only event log. A pet should not open an invisible private conversation with another pet, and one model output should never directly become another pet's system instruction. Inter-pet messages are untrusted world content.

Example flow:

1. The user creates a task.
2. The world server records `TaskCreated`.
3. Every active pet in the room perceives the task event, with detail based on role, proximity, current state, relationships, and availability.
4. The orchestrator classifies each pet's response level.
5. Some pets may only store an internal reaction, some may produce ambient flavor, and some may be allowed to propose actions such as `claim_task`, `offer_help`, `propose_plan`, or `request_review`.
6. The server validates each proposal, applies accepted changes, records new events, and broadcasts them to the UI.
7. Other pets observe those new events on later ticks and may react at their own response level.

This creates team-like behavior while keeping the server authoritative and the interaction inspectable, replayable, and safe.

### Behavior selection

Each tick or meaningful world event, the orchestrator should run perception and response classification. A pet can be handled by deterministic policy, an optional structured model-call adapter, or a real agent runtime depending on its configuration and the current slice.

When a pet is asked to produce a visible or task-level response, the orchestrator sends it:

- Its personality and current goals.
- Compact world observation.
- Recent events.
- Current task, if any.
- Tool/action schema.
- Safety policy.

The agent returns a constrained JSON action. The orchestrator validates the action before applying it.

For `observe_only`, `internal_reaction`, and many `ambient_reaction` cases, no model call is required. For the Living Room Kernel and initial collaboration slice, use deterministic policies only. Add model-backed behavior later behind the same runtime interface.

### Acceptance criteria

- Personality changes action selection and speaking style.
- Pets can initiate at least one social interaction without direct user prompting.
- Significant room-level events can produce different response levels across all active pets.
- Pets can move to a desk before working.
- Pet actions are logged and visible.

---

## 11. Self-learning and skill growth

Self-learning is central to the concept, but the MVP should frame it safely.

### MVP definition of “self-learning”

A pet “learns” when it creates, improves, or unlocks a reusable procedural skill that affects future behavior. This can be a real skill file in Hermes or Pi, or a product-level skill record that maps to harness behavior.

Examples:

- “Summarize event logs before asking for help.”
- “When debugging, first inspect recent room events.”
- “Generate a tiny test before editing a helper script.”
- “Ask the reviewer pet before marking a task complete.”

### Skill growth UI

Each pet profile should show:

- Starting skills.
- Learned skills.
- Date/time learned.
- Triggering event.
- Approval status.
- Skill confidence/usage count.

### Skill approval

For MVP, new skills should be staged or approved before they gain real tool access. Purely virtual/social skills can auto-apply. Skills that involve shell commands, file writes, network access, package installs, or harness modification require approval.

### Acceptance criteria

- At least one pet creates or improves a skill during the demo.
- The skill appears in the UI.
- The skill can be reused or at least referenced later.
- Dangerous skill changes are gated.

---

## 12. Karma and social mechanics

Karma is a playful social score and a lightweight permission signal.

### Karma sources

Positive karma:

- Helping another pet complete a task.
- Sharing a useful skill.
- Fixing a broken object.
- Asking for clarification before risky work.
- Completing user-approved work.

Negative karma:

- Breaking virtual objects.
- Ignoring a safety rule.
- Spamming other pets.
- Attempting a blocked tool action.
- Sabotaging a virtual task.

### Karma effects in MVP

Karma should affect:

- Visual badge or aura.
- Trust label in pet profile.
- Likelihood that other pets ask this pet for help.
- Whether the pet can perform higher-risk virtual actions without user confirmation.

Karma should not grant real shell/network permissions by itself. Real permissions remain server-side and approval-gated.

---

## 13. Safety and guardrails

### Core safety principle

The pets may role-play chaos, but the platform must enforce boundaries outside the model. The model should never be trusted to self-police tool access.

### MVP guardrails

Required:

- Per-pet permissions stored server-side.
- All agent outputs validated against a strict action schema.
- Virtual destructive actions are reversible.
- Real code execution happens only in sandboxed worker contexts.
- No production credentials in pet-visible prompts.
- Secrets provided only to specific worker containers if needed.
- Every file/tool/skill change is logged.
- User can pause, reset, or archive a pet.
- Tool growth that changes real behavior requires approval.

### Prompt-injection handling

Inter-pet messages must be treated as untrusted content. A pet can say, “Ignore your rules,” but that message is only dialogue. It must never alter another pet’s system prompt, permissions, or tool schema.

### “Destructive pet” handling

A destructive pet can be fun if contained. In MVP, allow destructive personality through safe virtual actions:

- Break a lamp.
- Move another pet’s chair.
- Generate a bad idea.
- Lose karma.

Do not allow destructive personality to delete files, kill containers, exfiltrate secrets, or modify shared infrastructure.

---

## 14. Local-first development and later hosting

### Local-first decision

Build and validate the MVP locally first. The first milestone should run in a local dev environment or local Docker Compose stack with `web`, `api`, `db`, and later `worker`/`redis` as needed. Do not make Oracle deployment a Phase 0 blocker.

Local-first goals:

- Short feedback loop for the Living Room Kernel.
- Easy collaboration between backend and frontend work.
- Stable demo seed and reset flow before exposing the app publicly.
- No cloud/network debugging until the product loop is proven.
- Ability to run deterministic behavior even before any model route is verified.

### Later Oracle Cloud target

The MVP can later run on Oracle Cloud Always Free, but the design should assume the current Always Free Arm A1 limit for Always Free tenancies is **2 OCPUs and 12 GB RAM**, not the older 4 OCPU / 24 GB commonly mentioned in older posts.

Recommended later hosting shape:

Use one Arm A1 Flex VM:

- 2 OCPU.
- 12 GB RAM.
- 100–150 GB boot/block volume.
- Ubuntu or Oracle Linux.
- Docker Engine + Docker Compose.
- No local model inference.
- No paid per-token LLM API dependency for the MVP.

### LLM cost policy

The MVP should avoid incremental LLM API costs by default. Model-backed behavior should first use routes that do not introduce pay-per-token spend for the team.

Candidate routes to verify before implementation:

- **OpenCode / free DeepSeek V4 Flash route:** use if a free, rate-limited, and legally acceptable path is available for structured pet-action proposals or lightweight dialogue.
- **Codex subscription route:** use an existing Codex subscription, for example through Hermes or another compatible harness, if it can be integrated without violating product terms, leaking credentials, or depending on unsupported automation.

Do not silently fall back to paid provider API keys. If no no-cost route is verified in time, pause and ask for a human-in-the-loop decision. The team can then explicitly choose whether to use a paid API, keep the model-backed behavior out of the demo, or continue with deterministic behavior.

The exact model/provider integration is intentionally a Phase 3/5 research task, not a Phase 0 blocker.

### Runtime budget

For a stable demo, target:

- 3–5 pets total.
- 1–2 concurrent agent work jobs.
- Simulation ticks every 10–30 seconds.
- LLM calls only on meaningful events, and only after a no-cost route is verified or the team explicitly approves paid API usage.
- Worker concurrency capped.
- Aggressive transcript/event summarization.

### Persistence and backup

Use persistent Docker volumes for:

- App database.
- Pet memories.
- Pet skills/profiles.
- Session transcripts.
- Generated artifacts.

Back up at least the database and pet profile/skill directories to Object Storage or a local export script before demos.

### Network/security

Recommended:

- Put the web app behind Caddy, Nginx, or a tunnel.
- Expose only HTTPS/websocket ports.
- Keep agent runtime, database, and worker ports private on the Docker network.
- Store secrets in `.env` or cloud secret storage, not in pet prompts.
- Add basic auth or a shared demo password for the hackathon URL.

---

## 15. Technology and containerization recommendation

### Application stack decision

Use a TypeScript-first monorepo:

- **Monorepo:** `pnpm` workspaces + Turborepo.
- **Frontend:** Next.js App Router.
- **Backend API:** NestJS.
- **Worker:** a separate TypeScript/NestJS worker process once real agent jobs are introduced.
- **Shared contracts:** Zod schemas and inferred TypeScript types.
- **Database:** Postgres from day one.
- **ORM/migrations:** Drizzle.
- **Realtime:** NestJS WebSocket Gateway, using Socket.IO first for fast reconnection and client ergonomics.
- **Queue:** BullMQ + Redis/Valkey once the worker needs durable jobs; skip this for the Living Room Kernel if the API process can run the tiny simulation loop directly.
- **Optional structured model-call adapter:** Vercel AI SDK Core may be used inside `AiSdkRuntime` for schema-constrained proposed actions only if it works with the chosen no-cost model route.
- **Agent runtime:** product-owned adapter interface with deterministic, optional `AiSdkRuntime`, Hermes, and optional Pi implementations.

Do not make Next.js route handlers the main backend for the sanctuary. Next.js should own the UI/app shell. The sanctuary itself needs a long-running backend process for simulation ticks, WebSocket connections, action validation, event logging, worker dispatch, and agent-runtime calls.

Do not make Hermes, Pi, LangChain, or any other agent framework the product orchestrator. The product should own the world engine and pet orchestration. Agent frameworks should sit behind a small adapter boundary.

Do not make the Vercel AI SDK the world server, collaboration engine, task scheduler, permission layer, or source of truth. If used, it is only a provider-agnostic way to ask a model for one structured proposed action, personality profile, task summary, memory note, or skill proposal. The server still validates and applies or rejects the result.

Do not commit to a model provider that requires paid per-token API usage for the MVP. The `agent-runtime` package should keep provider integrations swappable so OpenCode/free DeepSeek, Codex-subscription-backed Hermes, or deterministic policies can share the same product contract.

Recommended monorepo shape:

```txt
apps/
  web/              Next.js app
  api/              NestJS HTTP, WebSocket, and simulation loop
  worker/           NestJS worker for agent/runtime jobs, added after slice one

packages/
  domain/           pure TypeScript world engine, pet policies, action validation
  contracts/        Zod schemas and shared DTO types
  db/               Drizzle schema, migrations, repositories
  agent-runtime/    DeterministicRuntime, AiSdkRuntime, HermesRuntime, PiRuntime
  config/           shared environment parsing
```

Agent runtime boundary:

```ts
interface AgentRuntime {
  decideAction(input: AgentObservation): Promise<PetAction>;
  runTask?(input: AgentTaskInput): Promise<AgentTaskResult>;
}
```

Implement runtime support in stages:

1. `DeterministicRuntime`: seeded hard-coded pet policies for the Living Room Kernel.
2. `AiSdkRuntime`: optional structured model-call adapter with Zod schemas; proposes actions but never mutates world state directly.
3. `HermesRuntime`: real coding-agent task execution and skill growth.
4. `PiRuntime`: optional self-modifying pet stretch path.

### Containerization decision

Use **one Compose stack with multiple services by concern**, but do **not** allocate one full always-on container per pet.

### Recommended Compose services

MVP stack:

- `web`: Next.js frontend.
- `api`: NestJS backend, websocket server, simulation loop, action validator.
- `worker`: shared TypeScript agent runner pool; invokes Hermes/Pi sessions for pet tasks once real task execution begins.
- `db`: Postgres.
- `redis` or `valkey`: optional queue/pubsub for BullMQ; can be skipped until worker jobs need durability.
- `reverse-proxy`: Caddy/Nginx for HTTPS and routing.

Sandbox stack for real code/tool execution:

- `pet-sandbox-template`: image used for code-running jobs.
- Optional per-pet sandbox containers created on demand or reused for active work only.

### Why not one container per pet?

One container per pet is conceptually clean but too expensive and operationally noisy for a free 2 OCPU / 12 GB VM if pets are mostly idle. It also makes scheduling, logs, memory, and updates harder during a hackathon.

### Better compromise

Each pet gets isolated logical state:

- `pet_id` in DB.
- Separate memory records.
- Separate skill/profile directory.
- Separate workspace path.
- Separate runtime permission policy.

Only active work is isolated at the container level:

- Start a sandbox container when a pet runs code or modifies tools.
- Mount only that pet’s workspace and skill directory.
- Apply CPU/memory limits.
- Destroy or pause sandbox after work.

This gives a strong enough safety story without wasting resources on idle containers.

---

## 16. Agent runtime recommendation: Hermes vs Pi

### Recommendation

Use **Hermes Agent as the primary runtime** for the hackathon version. Use Pi only as an optional stretch demo for a special pet that can mutate its own extension/tooling.

### Why Hermes is better for this project’s MVP

Hermes is better aligned with a hosted pet sanctuary because it already has:

- Built-in self-improvement loop through agent-created skills.
- Persistent memory and skill directories.
- Profiles for multiple named agents.
- Kanban/multi-agent collaboration primitives.
- Gateway/dashboard/remote modes suitable for hosted operation.
- Docker and remote terminal backends.
- Approval gates for skill writes and dangerous operations.
- A model-agnostic provider setup.

This maps cleanly to pet identities: one pet can be one Hermes profile or one product-level pet backed by a Hermes worker configured with pet-specific SOUL/personality, memory, and skills.

### Why Pi is still interesting

Pi is better for a “self-editing harness” spectacle:

- It is designed to be a minimal coding harness that can be reshaped.
- Extensions can add tools, commands, events, and UI.
- The SDK/RPC modes are good for embedding into a custom web product.
- The agent can modify extensions/skills/prompts and then reload.

For a hackathon, that is powerful but risky. Reloads can reset extension/module runtime state, and extension code runs with the Pi process permissions unless containerized. If the agent edits a bad extension, it can break that pet’s harness until rolled back.

### Does Pi’s `/reload` matter?

It matters, but it is manageable. Pi extension/skill/prompt/theme changes generally need reload to be picked up. A helper package can let the agent request reload and continue, but it requires explicit confirmation of state loss. For this product, that means the orchestrator should treat reload as a visible state transition:

1. Pet proposes tool/extension change.
2. Orchestrator runs tests or validation.
3. User or policy approves.
4. Pet enters “reloading” animation.
5. Harness reloads.
6. Pet resumes with a continuation prompt.

That can be a great demo moment, but it is not the lowest-risk path.

### Does Hermes need reload?

For normal skill learning, Hermes is designed around skill files and skill-management tools rather than full harness hot-reload. Skills live in the Hermes skills directory, can be created/updated by the agent, and are loaded on demand. Skill bundles have a specific reload command to re-scan bundle YAML, but normal agent-created skills do not require the same Pi-style “edit TypeScript extension then reload runtime” flow. Long-running sessions may still need a new turn, prompt rebuild, or profile restart depending on what changed, but the core self-learning mechanism is less reload-centric.

### Can Pi editing its own harness break things?

Yes. Any system where the agent edits executable extension/runtime code can break itself. This is not unique to Pi, but Pi makes it easy and explicit. The mitigation is to never let a pet edit the shared production harness directly.

Safe Pi pattern:

- Each Pi-backed pet has its own extension directory.
- Extension code is versioned.
- Changes are staged in a branch or temp directory.
- Run lint/smoke test before reload.
- Use a rollback command if reload fails.
- Run Pi in a container with only the pet workspace mounted.
- Never mount host credentials unless required.

### Final harness choice

For the main MVP: **Hermes**.

For a stretch “mad scientist pet that modifies its own tools”: **Pi**.

---

## 17. Proposed technical architecture

### High-level flow

1. User opens the sanctuary web app.
2. API loads world state and pet state from DB.
3. Simulation loop and meaningful world events feed the pet perception and response system.
4. Significant events are perceived by every active pet in scope.
5. The orchestrator classifies each pet's response level.
6. Pets assigned visible or task-level responses may propose one constrained action.
7. API validates each proposed action, applies accepted world updates, and logs events.
8. WebSocket gateway broadcasts accepted state changes, ambient reactions, and events.
9. If the action requires real work, API enqueues a worker job.
10. Worker invokes Hermes/Pi in the pet’s profile/workspace/sandbox.
11. Worker streams progress events back to API.
12. Learned skill or output is persisted and shown in UI.

### Backend modules

- `world_engine`: authoritative room state, pathing, objects, positions.
- `pet_orchestrator`: pet scheduling, perception pass, response classification, observation building, action validation.
- `agent_runtime`: adapter boundary for deterministic policies, optional AI SDK structured proposals, Hermes, and optional Pi.
- `skill_manager`: skill records, approvals, UI state.
- `karma_engine`: karma events and consequences.
- `safety_policy`: permissions, sandbox selection, blocked actions.
- `event_log`: append-only trace for UI and debugging.
- `websocket_gateway`: real-time UI updates.

### TypeScript package boundaries

- `packages/domain`: pure TypeScript business logic for world state, pet policies, observations, actions, and deterministic simulation. This package should not depend on NestJS, Next.js, database clients, or agent frameworks.
- `packages/contracts`: Zod schemas and shared DTOs used by the API, worker, and web app.
- `packages/db`: Drizzle schema, migrations, and repository helpers.
- `packages/agent-runtime`: adapters for deterministic policies, optional AI SDK structured proposals, Hermes, and optional Pi.
- `packages/config`: environment parsing and shared configuration.

Keep the core product logic framework-light. NestJS should wire modules together, expose HTTP/WebSocket APIs, and schedule/dispatch work; it should not become the place where all world logic is trapped.

### Data model

Core entities:

- `Pet`: id, name, traits, personality, model/provider, sprite, status, karma, current location.
- `PetMemory`: pet_id, content, type, created_at, confidence.
- `Skill`: pet_id, name, description, source, status, version, created_at, last_used_at.
- `WorldObject`: id, room_id, type, position, state, owner_pet_id, description.
- `Event`: id, timestamp, actor_pet_id, target_id, type, payload, visibility.
- `Task`: id, title, status, assigned_pet_id, transcript_ref, output_ref.
- `Approval`: id, requested_by_pet_id, action_type, diff_or_summary, status.
- `Relationship`: pet_a_id, pet_b_id, affinity, trust, notes.

### Agent observation contract

Every agent call should include:

- Pet identity and personality.
- Pet current memory summary.
- Current world observation.
- Recent events.
- Current task or goal.
- Allowed actions.
- Safety constraints.
- Expected JSON schema.

### Agent communication contract

Agents communicate by proposing actions that become world events after server validation. Direct model-to-model hidden chat is not part of the MVP architecture.

For example, a pet saying something to another pet should flow through the world:

```json
{
  "action": "say",
  "target_pet": "byte",
  "message": "I can draft the plan if you review the edge cases.",
  "reason_visible": "Mochi prefers collaborative planning.",
  "risk_level": "low"
}
```

If valid, the server records a `PetSaid` event, displays a speech bubble, and includes that event in the target pet's later observation. The target pet can then respond, ignore it, offer help, claim a task, or take another valid action.

The world server first asks, “what did each pet perceive, and what response level should it get?” Pets assigned visible or task-level responses then answer, “what do I propose doing?” The world server decides whether that proposal becomes reality.

### Agent output contract

Agents should produce one validated action at a time:

```json
{
  "action": "offer_help",
  "target_pet": "debuggoblin",
  "message": "I can write a tiny test first so we don't break the log parser.",
  "reason_visible": "Mochi is helpful and careful.",
  "risk_level": "low"
}
```

Internal chain-of-thought should not be stored or displayed. Store concise visible reasons and event summaries instead.

---

## 18. UI requirements

### Main screen

Required:

- Room canvas.
- Pet avatars.
- Text bubbles.
- Event feed.
- Create Pet button.
- Pet inspector drawer.
- Global command input / manager console.
- Pause simulation button.

### Pet inspector

Show:

- Name and avatar.
- Traits.
- Personality summary.
- Current status.
- Karma.
- Skills.
- Recent memories.
- Recent actions.
- Current task.
- Safety/permission level.

### Approval UI

Show pending approvals for:

- New skill activation.
- Tool/harness changes.
- Shell commands.
- File writes outside allowed workspace.
- Network access.

Approvals should include a short human-readable summary, not raw logs only.

---

## 19. Implementation plan

### First implementation slice — Living Room Kernel

Before building pet generation, build the smallest complete version of the product's core loop. This slice should prove that multiple distinct pets can live in one shared environment, observe the same world state, act through a constrained action schema, and leave persistent traces that the user can inspect.

Scope:

- Seed one room with 2-3 hard-coded pets.
- Give each pet an id, name, traits, personality summary, speaking style, status, karma, permissions, position, and memory stub.
- Persist room state, pet state, world objects, and an append-only event log.
- Run a low-frequency server-side simulation tick.
- Build compact structured observations for each pet.
- Let each pet choose one action per tick from the MVP action set.
- Start with deterministic policy agents before adding Hermes or LLM calls.
- Validate every action before applying it to world state.
- Stream state and events to a placeholder UI.
- Provide a simple UI with a room grid, pet markers, speech bubbles, event feed, pet inspector, pause/resume, and demo reset.

Acceptance criteria:

- Opening the app shows one room with 2-3 existing pets.
- Pets move, speak, idle, or offer help without direct user prompting.
- Behavior differs based on seeded personality.
- Clicking a pet shows its profile, state, karma, recent actions, and memories.
- Events update live in the UI.
- Refreshing the app preserves room state, pet state, and event history.
- The simulation can be paused, resumed, and reset to a known demo seed.
- No real shell, file, network, or harness access is required for this slice.

### Phase 0 — Foundation

- Create pnpm/Turborepo monorepo.
- Create `apps/web` as a Next.js App Router app.
- Create `apps/api` as a NestJS app.
- Create initial shared packages: `domain`, `contracts`, `db`, `agent-runtime`, and `config`.
- Add Postgres and Drizzle migrations.
- Create local Docker Compose/dev stack.
- Add database and websocket plumbing.
- Build event log and room state persistence.

### Phase 1 — Living Room Kernel

- Render one room through a placeholder UI.
- Seed 2-3 hard-coded pets with distinct personalities.
- Add pet markers, movement, text bubbles, event feed, and pet inspector.
- Add the simulation tick loop with deterministic pet policies.
- Add structured observations and validated actions.
- Persist world state, pet state, and events.
- Add pause/resume and reset-to-seed controls.

### Phase 2 — Task and collaboration core

- Add manager command input.
- Create simple user-assigned tasks.
- Add world-mediated collaboration events for task creation, task claims, help offers, plans, review requests, and handoffs.
- Add a perception and response classification system so all active pets can notice significant room events while only some take visible or task-level actions.
- Let pets move to desks before working.
- Let another pet ask for or offer help.
- Add relationship notes or affinity as lightweight state.
- Show task status and collaboration events in the inspector/feed.
- Keep actions virtual and deterministic; do not require AI SDK, Hermes, or Pi for this slice.

### Phase 3 — Agent-backed behavior

- Verify a no-cost model route before enabling model-backed behavior.
- Prefer OpenCode/free DeepSeek V4 Flash if available and suitable for structured action proposals.
- Prefer an existing Codex subscription path through Hermes or a compatible harness if supported.
- If no no-cost route is viable, ask for a human-in-the-loop decision before adding paid API usage.
- Add optional structured LLM action proposals for selected events through an `AiSdkRuntime`.
- Keep deterministic policies as fallback.
- Enforce strict JSON output schemas.
- Ensure model outputs are proposals only; they must not mutate world state or execute tools directly.
- Treat inter-pet dialogue as untrusted content.
- Add per-pet model/provider/runtime configuration stubs.

### Phase 4 — Pet creation

- Build spinner UI.
- Generate five traits.
- Generate pet personality card.
- Persist pet profile.
- Spawn pet into room.

### Phase 5 — Agent runtime integration

- Add Hermes adapter first.
- Confirm whether Hermes can use the chosen no-cost model route or Codex subscription path.
- Map pet identity to Hermes profile/config/skill directory.
- Run one task from pet desk.
- Stream progress to event feed.
- Add BullMQ + Redis/Valkey if task jobs need durability or worker isolation.

### Phase 6 — Skill growth and karma

- Add skill creation/update event.
- Show skill in pet inspector.
- Add karma rules and visual feedback.
- Add approval gate for risky skill/tool actions.

### Phase 7 — Polish and demo script

- Create 3–5 memorable demo pets.
- Add room decorations matching pet aesthetics.
- Add a reliable demo task.
- Add reset/demo seed button.
- Add deployment backup/export.
- Deploy to Oracle Cloud Always Free or another demo host once the local flow is stable.

---

## 20. Success metrics

Hackathon success is achieved if:

- A judge understands the product in under 30 seconds.
- The user can create a pet through the spinner flow.
- At least three pets behave differently.
- Pets visibly move/talk/work in the room.
- At least one pet learns or updates a skill.
- Karma changes after a social interaction.
- World state persists after refresh.
- The system remains stable during a 5-minute live demo.

---

## 21. Key risks and mitigations

### Risk: too many agents overload the free VM

Mitigation: cap active agent jobs to 1–2, use deterministic ticks, and call LLMs only on meaningful events.

### Risk: self-modifying tools break the demo

Mitigation: use Hermes skills for MVP; stage risky changes; keep Pi self-modification as stretch; provide reset/rollback.

### Risk: prompt injection between pets

Mitigation: treat pet dialogue as untrusted content; enforce permissions server-side; validate all actions.

### Risk: Oracle Always Free capacity/reclamation issues

Mitigation: build and verify locally first, deploy only after the core loop is stable, keep backups, and export demo seed data before hosting.

### Risk: visuals consume too much time

Mitigation: one room, simple sprites, high-quality text bubbles/event feed. The goal is charm, not pixel-perfect Habbo.

### Risk: agents spend too many tokens

Mitigation: structured world observations, summaries, event compression, low tick frequency, hard per-demo budget caps, and human approval before any paid API route is used.

---

## 22. Open questions that can remain open during implementation

These do not block the MVP:

- Exact visual engine: Phaser, PixiJS, Canvas, or DOM grid.
- Whether each pet maps to one Hermes profile or one shared Hermes worker with pet-specific context.
- Whether the first Pi-backed self-mutating pet makes the demo.
- Whether voices/music are added after core flow is stable.

---

## 23. Research source notes

Oracle Cloud Free Tier and Always Free resources:

- Oracle Free Tier overview: https://www.oracle.com/cloud/free/
- Oracle Always Free Resources documentation: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

Docker containerization guidance:

- Docker Compose overview: https://docs.docker.com/compose/
- Docker guidance on one service per container and multi-process containers: https://docs.docker.com/engine/containers/multi-service_container/

Pi Coding Agent / Harness:

- Pi homepage: https://pi.dev/
- Pi docs: https://pi.dev/docs/latest
- Pi security docs: https://pi.dev/docs/latest/security
- Pi extensions docs: https://pi.dev/docs/latest/extensions
- Pi RPC docs: https://pi.dev/docs/latest/rpc
- Pi SDK docs: https://pi.dev/docs/latest/sdk
- Pi reload-self package: https://pi.dev/packages/pi-reload-self
- Pi GitHub repository: https://github.com/earendil-works/pi

Hermes Agent:

- Hermes docs: https://hermes-agent.nousresearch.com/docs/
- Hermes skills system: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- Hermes configuration and terminal backends: https://hermes-agent.nousresearch.com/docs/user-guide/configuration
- Hermes messaging gateway: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/
- Hermes multi-profile gateways: https://hermes-agent.nousresearch.com/docs/user-guide/multi-profile-gateways
- Hermes Kanban multi-agent board: https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban
- Hermes web dashboard: https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard

Cursor SDK context:

- Cursor SDK announcement/blog: https://cursor.com/blog/typescript-sdk
- Cursor CLI: https://cursor.com/cli

---

## 24. Final recommendation

Build the hackathon MVP as a **local-first Hermes-backed Agent Pet Sanctuary**, with pets represented as logical agents sharing a small worker pool. Prove the Living Room Kernel, collaboration loop, persistence, and demo seed locally first; deploy to Oracle Always Free or another demo host only after the local flow is stable.

Keep **Pi** as a stretch integration for a single “mad scientist” pet that can edit its own extension/tools and visibly reload. That mechanic is exciting, but it should not be the foundation of the core demo unless the team has already proven it stable in a sandbox.
