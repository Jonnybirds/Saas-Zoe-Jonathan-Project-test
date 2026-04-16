import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user: RequestUser;
      headers: Record<string, string>;
    }>();

    const headerTenantId = request.headers['x-tenant-id'];

    if (!headerTenantId || headerTenantId !== request.user.tenantId) {
      throw new ForbiddenException('Tenant scope mismatch');
    }

    return true;
  }
}
