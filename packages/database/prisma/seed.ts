import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: '8a6da2f9-d0d6-4233-b85a-4557784f6c10' },
    update: {},
    create: {
      id: '8a6da2f9-d0d6-4233-b85a-4557784f6c10',
      name: 'AegisRisk Demo Tenant',
      region: 'us-east-1',
      organizations: {
        create: {
          name: 'AegisRisk Insurance BU',
        },
      },
    },
  });

  const permissionCodes = [
    ['tenant.read', 'Read tenant profile', 'tenant'],
    ['iam.role.read', 'Read roles', 'iam'],
    ['user.read.self', 'Read self profile', 'user'],
    ['ai.decision.create', 'Create AI decisions', 'ai'],
    ['ai.decision.read', 'Read AI decisions', 'ai'],
  ] as const;

  const permissions = await Promise.all(
    permissionCodes.map(([code, name, category]) =>
      prisma.permission.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code } },
        update: { name, category },
        create: {
          tenantId: tenant.id,
          code,
          name,
          category,
        },
      }),
    ),
  );

  const adminRole = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'tenant_admin' } },
    update: { name: 'Tenant Admin' },
    create: {
      tenantId: tenant.id,
      code: 'tenant_admin',
      name: 'Tenant Admin',
      isSystem: true,
    },
  });

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  const passwordHash = await bcrypt.hash('ChangeMeNow123!', 12);

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@aegisrisk.example',
      },
    },
    update: {
      passwordHash,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      email: 'admin@aegisrisk.example',
      firstName: 'Platform',
      lastName: 'Admin',
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  console.log('Seed completed:', { tenantId: tenant.id, adminEmail: adminUser.email });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
