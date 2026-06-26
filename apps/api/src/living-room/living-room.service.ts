import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  applyPetAction,
  applyTaskResult,
  buildObservation,
  chooseDeterministicPetAction,
  createPet,
  createRoomNoticeEvent,
  createTask,
  createWorldEvent,
  getTask,
  pauseSimulation,
  processWorldEvent,
  resolveSkillApproval,
  resumeSimulation,
  rollTraits,
  runDeterministicTick
} from "@pet-sanctuary/domain";
import { createRuntimeWithFallback } from "@pet-sanctuary/agent-runtime";
import type {
  Approval,
  CreatePetRequest,
  CreateRoomEventRequest,
  CreateTaskRequest,
  Pet,
  ResolveApprovalRequest,
  RollTraitsResult,
  RoomSnapshot,
  Task,
  WorldEvent
} from "@pet-sanctuary/contracts";
import { LIVING_ROOM_REPOSITORY } from "./living-room.repository.js";
import type { LivingRoomRepository } from "./living-room.repository.js";
import { DEFAULT_MAIN_ROOM_SEED } from "./in-memory-living-room.repository.js";
import type {
  CreatePetResponse,
  CreateTaskResponse,
  ResolveApprovalResponse,
  RoomResponse,
  RoomUpdate,
  SimulationStatus
} from "./api-types.js";

type RoomUpdateListener = (update: RoomUpdate) => void | Promise<void>;

@Injectable()
export class LivingRoomService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LivingRoomService.name);
  private readonly listeners = new Set<RoomUpdateListener>();
  private readonly tickIntervalMs = Number(process.env.SIMULATION_TICK_MS ?? 10_000);
  private interval?: NodeJS.Timeout;

  constructor(
    @Inject(LIVING_ROOM_REPOSITORY)
    private readonly repository: LivingRoomRepository
  ) {}

  onModuleInit(): void {
    this.startLoop();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  subscribe(listener: RoomUpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async getMainRoom(): Promise<RoomResponse> {
    const snapshot = await this.repository.loadMainRoom();
    return {
      snapshot,
      simulation: this.getSimulationStatus(snapshot)
    };
  }

  async resetMainRoom(seed = DEFAULT_MAIN_ROOM_SEED): Promise<RoomResponse> {
    const snapshot = await this.repository.resetMainRoom(seed);
    await this.publishSnapshot(snapshot, snapshot.events.at(-1));
    return {
      snapshot,
      simulation: this.getSimulationStatus(snapshot)
    };
  }

  async pause(): Promise<RoomResponse> {
    const snapshot = await this.repository.loadMainRoom();
    if (!snapshot.room.paused) {
      const next = pauseSimulation(snapshot);
      const event = next.events.at(-1);
      await this.repository.saveMainRoom(next);
      await this.publishSnapshot(next, event);
      return {
        snapshot: next,
        simulation: this.getSimulationStatus(next)
      };
    }

    return {
      snapshot,
      simulation: this.getSimulationStatus(snapshot)
    };
  }

  async resume(): Promise<RoomResponse> {
    const snapshot = await this.repository.loadMainRoom();
    if (snapshot.room.paused) {
      const next = resumeSimulation(snapshot);
      const event = next.events.at(-1);
      await this.repository.saveMainRoom(next);
      await this.publishSnapshot(next, event);
      return {
        snapshot: next,
        simulation: this.getSimulationStatus(next)
      };
    }

    return {
      snapshot,
      simulation: this.getSimulationStatus(snapshot)
    };
  }

  async tickOnce(): Promise<RoomResponse> {
    const snapshot = await this.repository.loadMainRoom();
    if (snapshot.room.paused) {
      return {
        snapshot,
        simulation: this.getSimulationStatus(snapshot)
      };
    }

    const ticked = runDeterministicTick(snapshot);
    // Tasks that reached "in_progress" during the tick are executed by their
    // agent runtime (deterministic, zero-cost in the MVP) so they actually finish.
    const executed = await this.runRunnableTasks(ticked);
    const next = executed.snapshot;
    const newEvents = next.events.slice(snapshot.events.length);
    await this.repository.saveMainRoom(next);
    const simulation = this.getSimulationStatus(next);
    for (const event of newEvents) {
      await this.publish({ snapshot: next, event, simulation });
    }

    if (newEvents.length === 0) {
      await this.publishSnapshot(next);
    }

    return { snapshot: next, simulation };
  }

  async injectRoomEvent(request: CreateRoomEventRequest): Promise<RoomResponse> {
    const snapshot = await this.repository.loadMainRoom();
    const timestamp = new Date().toISOString();
    const event = createRoomNoticeEvent(snapshot, request, timestamp);
    const result = processWorldEvent(snapshot, event, timestamp);
    await this.repository.saveMainRoom(result.snapshot);

    const simulation = this.getSimulationStatus(result.snapshot);
    for (const createdEvent of result.events) {
      await this.publish({ snapshot: result.snapshot, event: createdEvent, simulation });
    }

    return {
      snapshot: result.snapshot,
      simulation
    };
  }

  // --- Tasks & collaboration (Phase 2) -----------------------------------

  async createTask(request: CreateTaskRequest): Promise<CreateTaskResponse> {
    const snapshot = await this.repository.loadMainRoom();
    if (request.assignedPetId && !snapshot.pets.some((pet) => pet.id === request.assignedPetId)) {
      throw new BadRequestException(`Assigned pet ${request.assignedPetId} does not exist.`);
    }

    const timestamp = new Date().toISOString();
    const collected: WorldEvent[] = [];

    // 1. Record the task and let every active pet perceive it (some may claim).
    const created = createTask(snapshot, request, "manager", timestamp);
    let next = created.snapshot;
    const taskId = created.task.id;
    // processWorldEvent won't re-emit the already-present TaskCreated event, so
    // publish it explicitly to keep the broadcast stream complete.
    collected.push(created.event);

    const processed = processWorldEvent(next, created.event, timestamp);
    next = processed.snapshot;
    collected.push(...processed.events);

    // 2. If nobody claimed it, assign it to the best available pet.
    next = this.ensureTaskAssigned(next, taskId, collected, timestamp);

    // 3. Drive the assigned pet to a desk and run the task to completion.
    const driven = await this.driveAndRunTasks(next);
    next = driven.snapshot;
    collected.push(...driven.events);

    const finalTask = getTask(next, taskId);
    const response = await this.persistAndPublish(next, collected);
    return { ...response, task: finalTask ?? created.task };
  }

  async listTasks(): Promise<Task[]> {
    const snapshot = await this.repository.loadMainRoom();
    return snapshot.tasks;
  }

  // --- Pets (Phase 4 — creation back-end) --------------------------------

  rollTraits(seed?: string): RollTraitsResult {
    const traits = rollTraits(seed);
    return { rollId: seed ?? `roll-${traits.temperament}-${traits.workStyle}-${traits.aesthetic}`, traits };
  }

  async createPet(request: CreatePetRequest): Promise<CreatePetResponse> {
    const snapshot = await this.repository.loadMainRoom();
    const timestamp = new Date().toISOString();
    const traits = request.traits ?? rollTraits(request.seed);

    const created = createPet(
      snapshot,
      {
        traits,
        name: request.name,
        position: request.position,
        runtime: request.runtime,
        seed: request.seed
      },
      timestamp
    );
    let next = created.snapshot;
    const collected: WorldEvent[] = [...created.events];

    // Let existing pets react to the newcomer.
    const processed = processWorldEvent(next, created.events[0]!, timestamp);
    next = processed.snapshot;
    collected.push(...processed.events.filter((event) => event.id !== created.events[0]!.id));

    const pet = next.pets.find((candidate) => candidate.id === created.petId)!;
    const response = await this.persistAndPublish(next, collected);
    return { ...response, pet };
  }

  async listPets(): Promise<Pet[]> {
    const snapshot = await this.repository.loadMainRoom();
    return snapshot.pets;
  }

  async setPetArchived(petId: string, archived: boolean): Promise<RoomResponse> {
    return this.patchPet(petId, { archived, status: archived ? "paused" : "idle" });
  }

  async setPetPaused(petId: string, paused: boolean): Promise<RoomResponse> {
    return this.patchPet(petId, { status: paused ? "paused" : "idle" });
  }

  // --- Skills & approvals (Phase 6) --------------------------------------

  async listSkills(): Promise<RoomSnapshot["skills"]> {
    const snapshot = await this.repository.loadMainRoom();
    return snapshot.skills;
  }

  async listApprovals(status?: Approval["status"]): Promise<Approval[]> {
    const snapshot = await this.repository.loadMainRoom();
    return status ? snapshot.approvals.filter((approval) => approval.status === status) : snapshot.approvals;
  }

  async resolveApproval(approvalId: string, request: ResolveApprovalRequest): Promise<ResolveApprovalResponse> {
    const snapshot = await this.repository.loadMainRoom();
    const approval = snapshot.approvals.find((candidate) => candidate.id === approvalId);
    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found.`);
    }
    if (approval.status !== "pending") {
      throw new BadRequestException(`Approval ${approvalId} is already ${approval.status}.`);
    }

    const timestamp = new Date().toISOString();
    const resolved = resolveSkillApproval(snapshot, approvalId, request.decision, request.resolvedBy, timestamp);
    const response = await this.persistAndPublish(resolved.snapshot, resolved.events);
    return { ...response, approval: resolved.approval };
  }

  getSimulationStatus(snapshot: RoomSnapshot): SimulationStatus {
    return {
      paused: snapshot.room.paused,
      tick: snapshot.room.tick,
      tickIntervalMs: this.tickIntervalMs
    };
  }

  // --- private task-execution helpers ------------------------------------

  /** Assign an unclaimed task to the best available free pet, if any. */
  private ensureTaskAssigned(
    snapshot: RoomSnapshot,
    taskId: string,
    collected: WorldEvent[],
    timestamp: string
  ): RoomSnapshot {
    const task = getTask(snapshot, taskId);
    if (!task || task.assignedPetId || task.status !== "open") {
      return snapshot;
    }

    const assignee = this.pickAssignee(snapshot);
    if (!assignee) {
      return snapshot;
    }

    const result = applyPetAction(
      snapshot,
      assignee.id,
      {
        action: "claim_task",
        taskId,
        reasonVisible: `${assignee.name} is assigned "${task.title}" by the manager.`,
        riskLevel: "low"
      },
      timestamp
    );
    if (result.ok) {
      collected.push(...result.events);
      return result.snapshot;
    }
    return snapshot;
  }

  private pickAssignee(snapshot: RoomSnapshot): Pet | undefined {
    const free = snapshot.pets.filter(
      (pet) => !pet.archived && pet.status !== "paused" && pet.permissions.canWork && !pet.currentTaskId
    );
    return [...free].sort((a, b) => b.karma - a.karma)[0];
  }

  /** Drive every assigned-but-unfinished task to a desk and run it to completion. */
  private async driveAndRunTasks(snapshot: RoomSnapshot): Promise<{ snapshot: RoomSnapshot; events: WorldEvent[] }> {
    let next = snapshot;
    const events: WorldEvent[] = [];
    const seen = new Set<string>();
    let guard = 0;

    while (guard < 80) {
      guard += 1;
      const task = next.tasks.find(
        (candidate) =>
          candidate.assignedPetId !== null &&
          (candidate.status === "claimed" || candidate.status === "planned" || candidate.status === "in_progress")
      );
      if (!task || !task.assignedPetId) {
        break;
      }
      const pet = next.pets.find((candidate) => candidate.id === task.assignedPetId);
      if (!pet || pet.archived || pet.status === "paused") {
        break;
      }

      if (task.status === "in_progress") {
        next = await this.executeTask(next, task.id, pet, events);
        continue;
      }

      // Defensive: if we revisit the exact same drive state, we're not making
      // progress — break instead of spinning to the guard limit.
      const signature = `${task.id}:${task.status}:${pet.position.x},${pet.position.y}:${pet.currentTaskId}`;
      if (seen.has(signature)) {
        break;
      }
      seen.add(signature);

      const observation = { ...buildObservation(next, pet.id), responseLevel: "task_action" as const };
      const action = chooseDeterministicPetAction(observation);
      if (!action) {
        break;
      }
      const result = applyPetAction(next, pet.id, action, new Date().toISOString());
      if (!result.ok) {
        break;
      }
      events.push(...result.events);
      next = result.snapshot;
    }

    return { snapshot: next, events };
  }

  /** Run the agent runtime for any in-progress task that hasn't produced output. */
  private async runRunnableTasks(snapshot: RoomSnapshot): Promise<{ snapshot: RoomSnapshot; events: WorldEvent[] }> {
    let next = snapshot;
    const events: WorldEvent[] = [];
    let guard = 0;

    while (guard < 8) {
      guard += 1;
      const task = next.tasks.find(
        (candidate) => candidate.status === "in_progress" && candidate.assignedPetId !== null && !candidate.outputRef
      );
      if (!task || !task.assignedPetId) {
        break;
      }
      const pet = next.pets.find((candidate) => candidate.id === task.assignedPetId);
      if (!pet) {
        break;
      }
      next = await this.executeTask(next, task.id, pet, events);
    }

    return { snapshot: next, events };
  }

  private async executeTask(
    snapshot: RoomSnapshot,
    taskId: string,
    pet: Pet,
    events: WorldEvent[]
  ): Promise<RoomSnapshot> {
    const task = getTask(snapshot, taskId);
    if (!task) {
      return snapshot;
    }
    const runtime = createRuntimeWithFallback(pet.runtime);
    const outcome = await runtime.runTask!({
      petId: pet.id,
      petName: pet.name,
      taskId: task.id,
      title: task.title,
      description: task.description,
      workStyle: pet.traits.workStyle,
      riskLevel: task.riskLevel
    });
    const result = applyTaskResult(snapshot, taskId, outcome, new Date().toISOString());
    events.push(...result.events);
    return result.snapshot;
  }

  private async patchPet(petId: string, patch: Partial<Pet>): Promise<RoomResponse> {
    const snapshot = await this.repository.loadMainRoom();
    const pet = snapshot.pets.find((candidate) => candidate.id === petId);
    if (!pet) {
      throw new NotFoundException(`Pet ${petId} not found.`);
    }

    const timestamp = new Date().toISOString();
    const pets = snapshot.pets.map((candidate) => (candidate.id === petId ? { ...candidate, ...patch } : candidate));
    const eventType =
      patch.archived === true ? "PetArchived" : patch.status === "paused" ? "PetPaused" : "PetUnpaused";
    const event = createWorldEvent({
      snapshot: { room: snapshot.room, events: snapshot.events },
      type: eventType,
      timestamp,
      actorPetId: petId,
      payload: {
        petId,
        summary:
          patch.archived === true
            ? `${pet.name} was archived.`
            : patch.status === "paused"
              ? `${pet.name} was paused.`
              : `${pet.name} resumed.`
      },
      visibility: "system",
      significance: "medium"
    });

    const next: RoomSnapshot = { ...snapshot, pets, events: [...snapshot.events, event] };
    return this.persistAndPublish(next, [event]);
  }

  private async persistAndPublish(snapshot: RoomSnapshot, events: WorldEvent[]): Promise<RoomResponse> {
    await this.repository.saveMainRoom(snapshot);
    const simulation = this.getSimulationStatus(snapshot);
    if (events.length === 0) {
      await this.publishSnapshot(snapshot);
    } else {
      for (const event of events) {
        await this.publish({ snapshot, event, simulation });
      }
    }
    return { snapshot, simulation };
  }

  private startLoop(): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      this.tickOnce().catch((error) =>
        this.logger.error("Simulation tick failed", error instanceof Error ? error.stack : String(error))
      );
    }, this.tickIntervalMs);
  }

  private async publish(update: RoomUpdate): Promise<void> {
    await Promise.all([...this.listeners].map((listener) => listener(update)));
  }

  private async publishSnapshot(snapshot: RoomSnapshot, event?: WorldEvent): Promise<void> {
    const simulation = this.getSimulationStatus(snapshot);
    const update: RoomUpdate = event
      ? { snapshot, event, simulation }
      : { snapshot, simulation };
    await this.publish(update);
  }
}
