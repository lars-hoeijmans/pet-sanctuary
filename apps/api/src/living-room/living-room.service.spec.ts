import { describe, expect, it } from "vitest";
import { InMemoryLivingRoomRepository } from "./in-memory-living-room.repository.js";
import { LivingRoomService } from "./living-room.service.js";

describe("LivingRoomService", () => {
  it("loads the seeded main room", async () => {
    const service = new LivingRoomService(new InMemoryLivingRoomRepository());

    const room = await service.getMainRoom();

    expect(room.snapshot.room.id).toBe("living-room");
    expect(room.snapshot.pets).toHaveLength(3);
    expect(room.snapshot.events.at(0)?.type).toBe("RoomSeeded");
    expect(room.simulation.paused).toBe(false);
  });

  it("pauses and resumes the simulation", async () => {
    const service = new LivingRoomService(new InMemoryLivingRoomRepository());

    const paused = await service.pause();
    expect(paused.simulation.paused).toBe(true);
    expect(paused.snapshot.events.at(-1)?.type).toBe("SimulationPaused");

    const resumed = await service.resume();
    expect(resumed.simulation.paused).toBe(false);
    expect(resumed.snapshot.events.at(-1)?.type).toBe("SimulationResumed");
  });

  it("advances one deterministic tick and records visible events", async () => {
    const service = new LivingRoomService(new InMemoryLivingRoomRepository());

    const ticked = await service.tickOnce();

    expect(ticked.snapshot.room.tick).toBe(1);
    expect(ticked.snapshot.events.length).toBeGreaterThan(1);
    expect(ticked.snapshot.events.some((event) => event.type === "SimulationTick")).toBe(true);
  });

  it("does not tick while paused", async () => {
    const service = new LivingRoomService(new InMemoryLivingRoomRepository());
    await service.pause();

    const ticked = await service.tickOnce();

    expect(ticked.snapshot.room.tick).toBe(0);
    expect(ticked.simulation.paused).toBe(true);
  });

  it("injects a meaningful room event, persists the cascade, and publishes each event", async () => {
    const service = new LivingRoomService(new InMemoryLivingRoomRepository());
    const published: string[] = [];
    service.subscribe((update) => {
      if (update.event) {
        published.push(update.event.type);
      }
    });

    const response = await service.injectRoomEvent({
      summary: "A developer posted a trace-polish task.",
      significance: "high",
      metadata: { source: "service-test" }
    });

    const persisted = await service.getMainRoom();
    const createdEvents = response.snapshot.events.slice(1);

    expect(response.snapshot.events.some((event) => event.type === "RoomNotice")).toBe(true);
    expect(response.snapshot.events.filter((event) => event.type === "PetObserved")).toHaveLength(3);
    expect(
      response.snapshot.events.some((event) =>
        ["PetMoved", "PetSaid", "PetOfferedHelp", "PetStartedWork"].includes(event.type)
      )
    ).toBe(true);
    expect(persisted.snapshot.events).toEqual(response.snapshot.events);
    expect(published).toEqual(createdEvents.map((event) => event.type));
  });
});
