import { Controller, Get } from "@nestjs/common";
import { LivingRoomService } from "./living-room.service.js";
import type { SkillsResponse } from "./api-types.js";

@Controller("skills")
export class SkillsController {
  constructor(private readonly livingRoomService: LivingRoomService) {}

  @Get()
  async list(): Promise<SkillsResponse> {
    return { skills: await this.livingRoomService.listSkills() };
  }
}
