import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { IamService } from './iam.service';

@Controller('iam')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @Get('roles')
  @RequirePermissions('iam.role.read')
  async listRoles(@CurrentUser() user: RequestUser) {
    return this.iamService.listRoles(user.tenantId);
  }
}
