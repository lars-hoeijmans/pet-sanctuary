import { Module } from "@nestjs/common";
import { LabController } from "./lab.controller.js";
import { LivingRoomModule } from "./living-room.module.js";

@Module({
  imports: [LivingRoomModule],
  controllers: [LabController]
})
export class LabModule {}
