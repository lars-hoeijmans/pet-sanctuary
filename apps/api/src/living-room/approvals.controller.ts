import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApprovalStatusSchema, ResolveApprovalRequestSchema } from "@pet-sanctuary/contracts";
import { LivingRoomService } from "./living-room.service.js";
import type { ApprovalsResponse, ResolveApprovalResponse } from "./api-types.js";

@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly livingRoomService: LivingRoomService) {}

  @Get()
  async list(@Query("status") status?: string): Promise<ApprovalsResponse> {
    const parsedStatus = status ? ApprovalStatusSchema.safeParse(status) : null;
    if (status && parsedStatus && !parsedStatus.success) {
      throw new BadRequestException("Invalid approval status filter.");
    }
    return { approvals: await this.livingRoomService.listApprovals(parsedStatus?.success ? parsedStatus.data : undefined) };
  }

  @Post(":id/resolve")
  @HttpCode(200)
  resolve(@Param("id") id: string, @Body() body: unknown = {}): Promise<ResolveApprovalResponse> {
    const result = ResolveApprovalRequestSchema.safeParse(body ?? {});
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.livingRoomService.resolveApproval(id, result.data);
  }
}
