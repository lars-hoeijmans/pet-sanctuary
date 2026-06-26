# Agent Pet Sanctuary API

NestJS HTTP and Socket.IO API for the first local-first Living Room Kernel slice.

## HTTP contract

- `GET /health` returns process health.
- `GET /rooms/main` returns `{ snapshot, simulation }`.
- `POST /rooms/main/reset` accepts `{ "seed": "optional-seed" }` and returns the reset room.
- `POST /simulation/pause` pauses ticks and returns the room.
- `POST /simulation/resume` resumes ticks and returns the room.

## Socket.IO contract

Connect to namespace `/living-room`.

- Server emits `room:snapshot` to each client on connect.
- Client may emit `room:getSnapshot` to receive `room:snapshot`.
- Server broadcasts `room:update` after resets, pause/resume, and simulation ticks.
- Server broadcasts `room:event` for each accepted world event.

## Persistence boundary

The default provider is `InMemoryLivingRoomRepository` so this app can run before
the database package exists. The API consumes seeded snapshots and deterministic
ticks from `@pet-sanctuary/domain`, with DTO shapes from
`@pet-sanctuary/contracts`. Swap the `LIVING_ROOM_REPOSITORY` provider to a real
Drizzle/Postgres repository once `packages/db` exposes room, pet, object, and
append-only event repositories.
