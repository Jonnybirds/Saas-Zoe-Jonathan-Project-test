import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AiService } from './ai.service';
import { CreateAIDecisionDto } from './dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('decisions')
  @RequirePermissions('ai.decision.create')
  async createDecision(
    @CurrentUser() user: RequestUser,
    @Body() payload: CreateAIDecisionDto,
  ) {
    return this.aiService.createDecision(user, payload);
  }

  @Get('decisions/:aiRunId')
  @RequirePermissions('ai.decision.read')
  async getDecision(
    @CurrentUser() user: RequestUser,
    @Param('aiRunId') aiRunId: string,
  ) {
    return this.aiService.getDecision(user, aiRunId);
  }
}
