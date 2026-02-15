import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await hash('admin1234!', 10);

  const admin = await prisma.user.upsert({
    where: { loginId: 'admin' },
    update: {},
    create: {
      loginId: 'admin',
      passwordHash: adminPassword,
      name: 'Administrator',
      nick: 'admin',
      email: 'admin@example.com',
      level: 10,
      point: 0,
      status: 'ACTIVE'
    }
  });

  const group = await prisma.group.upsert({
    where: { grId: 'default' },
    update: {},
    create: {
      grId: 'default',
      subject: 'Default Group',
      adminUserId: admin.id,
      useAccess: false,
      orderNo: 0
    }
  });

  await prisma.board.upsert({
    where: { boTable: 'free' },
    update: {},
    create: {
      boTable: 'free',
      groupId: group.id,
      subject: 'Free Board',
      adminUserId: admin.id,
      boListLevel: 1,
      boReadLevel: 1,
      boWriteLevel: 2,
      boReplyLevel: 2,
      boCommentLevel: 2,
      boUploadLevel: 2,
      boDownloadLevel: 1,
      boUseSecret: 0,
      boUseGood: true,
      boUseNogood: true,
      boUseSearch: true,
      boUseCategory: false
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
