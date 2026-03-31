import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 先删除相关的数据
  await prisma.workflowLog.deleteMany({
    where: { requirementId: { not: null } }
  });

  await prisma.creditRecord.deleteMany({
    where: { requirementId: { not: null } }
  });

  await prisma.issue.deleteMany({});
  await prisma.requirement.deleteMany({});
  await prisma.testCycle.deleteMany({});
  await prisma.creditSummary.deleteMany({});
  await prisma.version.deleteMany({});

  console.log('All versions and related data deleted');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
