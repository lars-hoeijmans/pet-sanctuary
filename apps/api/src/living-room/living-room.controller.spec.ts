import { describe, expect, it } from "vitest";
import { InMemoryLivingRoomRepository } from "./in-memory-living-room.repository.js";
import { LivingRoomController } from "./living-room.controller.js";
import { LivingRoomService } from "./living-room.service.js";
import { SimulationController } from "./simulation.controller.js";

describe("Living Room controllers", () => {
  it("serves, resets, pauses, and resumes the main room", async () => {
    const service = new LivingRoomService(new InMemoryLivingRoomRepository());
    const rooms = new LivingRoomController(service);
    const simulation = new SimulationController(service);

    expect((await rooms.getMainRoom()).snapshot.room.id).toBe("living-room");
    expect(
      (await rooms.resetMainRoom({ seed: "controller-test" })).snapshot.events.at(0)?.payload
        .seed
    ).toBe("controller-test");
    expect(
      (await rooms.createMainRoomEvent({ summary: "Controller test notice." })).snapshot.events.some(
        (event) => event.type === "RoomNotice"
      )
    ).toBe(true);
    expect((await simulation.pause()).simulation.paused).toBe(true);
    expect((await simulation.resume()).simulation.paused).toBe(false);
  });
});
