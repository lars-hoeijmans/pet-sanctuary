import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
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
}
