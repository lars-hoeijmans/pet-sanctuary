import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  pauseSimulation,
  resumeSimulation,
  runDeterministicTick
} from "@pet-sanctuary/domain";
import type { RoomSnapshot, WorldEvent } from "@pet-sanctuary/contracts";
import { LIVING_ROOM_REPOSITORY } from "./living-room.repository.js";
import type { LivingRoomRepository } from "./living-room.repository.js";
import { DEFAULT_MAIN_ROOM_SEED } from "./in-memory-living-room.repository.js";
import type { RoomResponse, RoomUpdate, SimulationStatus } from "./api-types.js";

type RoomUpdateListener = (update: RoomUpdate) => void | Promise<void>;

@Injectable()
export class LivingRoomService implements OnModuleInit, OnModuleDestroy {
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

    const next = runDeterministicTick(snapshot);
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

  getSimulationStatus(snapshot: RoomSnapshot): SimulationStatus {
    return {
      paused: snapshot.room.paused,
      tick: snapshot.room.tick,
      tickIntervalMs: this.tickIntervalMs
    };
  }

  private startLoop(): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.tickOnce();
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
