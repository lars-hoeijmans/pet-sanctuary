import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { LivingRoomService } from "./living-room.service.js";
import type { CreatePetResponse, CreateTaskResponse, RoomResponse } from "./api-types.js";

@Controller("lab")
export class LabController {
  constructor(private readonly livingRoomService: LivingRoomService) {}

  @Post("spawn")
  @HttpCode(200)
  spawn(): Promise<CreatePetResponse> {
    return this.livingRoomService.createPet({});
  }

  @Post("task")
  @HttpCode(200)
  task(
    @Body() body: { title?: string; description?: string } = {}
  ): Promise<CreateTaskResponse> {
    return this.livingRoomService.createTask({
      title: body.title ?? "Lab task",
      description: body.description ?? "Created from the lab controls.",
      riskLevel: "low"
    });
  }

  @Post("message")
  @HttpCode(200)
  message(): Promise<RoomResponse> {
    return this.livingRoomService.injectRoomEvent({
      summary: "A lab notification asks every active pet to respond.",
      significance: "medium",
      metadata: {}
    });
  }

  @Post("reset")
  @HttpCode(200)
  reset(): Promise<RoomResponse> {
    return this.livingRoomService.resetMainRoom();
  }

  @Post("play")
  @HttpCode(200)
  play(): Promise<RoomResponse> {
    return this.livingRoomService.resume();
  }

  @Post("stop")
  @HttpCode(200)
  stop(): Promise<RoomResponse> {
    return this.livingRoomService.pause();
  }

  @Post("move")
  @HttpCode(200)
  move(
    @Body() body: { petId: string; x: number; y: number; reason?: string }
  ): Promise<RoomResponse> {
    return this.livingRoomService.movePet(
      body.petId,
      body.x,
      body.y,
      body.reason ?? "Moved from lab controls."
    );
  }
}
