import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const versions = await prisma.version.findMany();
  console.log('Total versions:', versions.length);
  if (versions.length > 0) {
    console.log('Version details:', versions.map(v => ({ id: v.id, name: v.name })));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
