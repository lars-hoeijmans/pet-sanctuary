import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { CreatePetRequestSchema, RollTraitsRequestSchema } from "@pet-sanctuary/contracts";
import { LivingRoomService } from "./living-room.service.js";
import type { CreatePetResponse, PetsResponse, RollTraitsResponse, RoomResponse } from "./api-types.js";

@Controller("pets")
export class PetsController {
  constructor(private readonly livingRoomService: LivingRoomService) {}

  @Get()
  async list(): Promise<PetsResponse> {
    return { pets: await this.livingRoomService.listPets() };
  }

  /** Spinner back-end: roll five traits (deterministic when a seed is supplied). */
  @Post("roll")
  @HttpCode(200)
  roll(@Body() body: unknown = {}): RollTraitsResponse {
    const result = RollTraitsRequestSchema.safeParse(body ?? {});
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.livingRoomService.rollTraits(result.data.seed);
  }

  /** Generate a full personality from traits (or a fresh roll) and spawn the pet. */
  @Post()
  @HttpCode(200)
  create(@Body() body: unknown = {}): Promise<CreatePetResponse> {
    const result = CreatePetRequestSchema.safeParse(body ?? {});
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.livingRoomService.createPet(result.data);
  }

  @Post(":id/pause")
  @HttpCode(200)
  pause(@Param("id") id: string): Promise<RoomResponse> {
    return this.livingRoomService.setPetPaused(id, true);
  }

  @Post(":id/resume")
  @HttpCode(200)
  resume(@Param("id") id: string): Promise<RoomResponse> {
    return this.livingRoomService.setPetPaused(id, false);
  }

  @Post(":id/archive")
  @HttpCode(200)
  archive(@Param("id") id: string): Promise<RoomResponse> {
    return this.livingRoomService.setPetArchived(id, true);
  }
}
