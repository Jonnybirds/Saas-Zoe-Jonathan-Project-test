import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class IamService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
