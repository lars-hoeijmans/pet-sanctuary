import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { LivingRoomModule } from "./living-room/living-room.module.js";

@Module({
  imports: [LivingRoomModule],
  controllers: [HealthController]
})
export class AppModule {}
