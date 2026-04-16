import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get(':tenantId')
  @RequirePermissions('tenant.read')
  async getTenant(@Param('tenantId') tenantId: string) {
    return this.tenantsService.getTenant(tenantId);
  }
}
