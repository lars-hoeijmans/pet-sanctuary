import { Controller, HttpCode, Post } from "@nestjs/common";
import { LivingRoomService } from "./living-room.service.js";
import type { RoomResponse } from "./api-types.js";

@Controller("simulation")
export class SimulationController {
  constructor(private readonly livingRoomService: LivingRoomService) {}

  @Post("pause")
  @HttpCode(200)
  pause(): Promise<RoomResponse> {
    return this.livingRoomService.pause();
  }

  @Post("resume")
  @HttpCode(200)
  resume(): Promise<RoomResponse> {
    return this.livingRoomService.resume();
  }
}
