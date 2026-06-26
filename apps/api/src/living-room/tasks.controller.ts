import { BadRequestException, Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { CreateTaskRequestSchema } from "@pet-sanctuary/contracts";
import { LivingRoomService } from "./living-room.service.js";
import type { CreateTaskResponse, TasksResponse } from "./api-types.js";

@Controller("tasks")
export class TasksController {
  constructor(private readonly livingRoomService: LivingRoomService) {}

  @Get()
  async list(): Promise<TasksResponse> {
    return { tasks: await this.livingRoomService.listTasks() };
  }

  @Post()
  @HttpCode(200)
  create(@Body() body: unknown = {}): Promise<CreateTaskResponse> {
    const result = CreateTaskRequestSchema.safeParse(body ?? {});
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.livingRoomService.createTask(result.data);
  }
}
