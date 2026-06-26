import { BadRequestException, Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { CreateRoomEventRequestSchema } from "@pet-sanctuary/contracts";
import { LivingRoomService } from "./living-room.service.js";
import type { RoomResponse } from "./api-types.js";

interface ResetRoomBody {
  seed?: string;
}

@Controller("rooms")
export class LivingRoomController {
  constructor(private readonly livingRoomService: LivingRoomService) {}

  @Get("main")
  getMainRoom(): Promise<RoomResponse> {
    return this.livingRoomService.getMainRoom();
  }

  @Post("main/reset")
  @HttpCode(200)
  resetMainRoom(@Body() body: ResetRoomBody = {}): Promise<RoomResponse> {
    return this.livingRoomService.resetMainRoom(body.seed);
  }

  @Post("main/events")
  @HttpCode(200)
  createMainRoomEvent(@Body() body: unknown = {}): Promise<RoomResponse> {
    const result = CreateRoomEventRequestSchema.safeParse(body ?? {});
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    return this.livingRoomService.injectRoomEvent(result.data);
  }
}
