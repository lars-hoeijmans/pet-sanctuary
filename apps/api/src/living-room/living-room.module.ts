import { Module } from "@nestjs/common";
import { createSanctuaryDb } from "@pet-sanctuary/db";
import { ApprovalsController } from "./approvals.controller.js";
import { DrizzleLivingRoomRepository } from "./drizzle-living-room.repository.js";
import { InMemoryLivingRoomRepository } from "./in-memory-living-room.repository.js";
import { LivingRoomController } from "./living-room.controller.js";
import { LivingRoomGateway } from "./living-room.gateway.js";
import { LIVING_ROOM_REPOSITORY } from "./living-room.repository.js";
import { LivingRoomService } from "./living-room.service.js";
import { PetsController } from "./pets.controller.js";
import { SimulationController } from "./simulation.controller.js";
import { SkillsController } from "./skills.controller.js";
import { TasksController } from "./tasks.controller.js";

@Module({
  controllers: [
    LivingRoomController,
    SimulationController,
    TasksController,
    PetsController,
    ApprovalsController,
    SkillsController
  ],
  providers: [
    LivingRoomService,
    LivingRoomGateway,
    InMemoryLivingRoomRepository,
    {
      provide: LIVING_ROOM_REPOSITORY,
      useFactory: (inMemoryRepository: InMemoryLivingRoomRepository) => {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
          return inMemoryRepository;
        }

        return new DrizzleLivingRoomRepository(createSanctuaryDb(databaseUrl));
      },
      inject: [InMemoryLivingRoomRepository]
    }
  ],
  exports: [LivingRoomService]
})
export class LivingRoomModule {}
