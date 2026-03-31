import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);

  const user = await prisma.user.upsert({
    where: {
      employeeNo: 'g00658888',
    },
    update: {
      name: '古PM',
      username: 'g00658888',
      password: passwordHash,
      role: UserRole.PM,
    },
    create: {
      employeeNo: 'g00658888',
      name: '古PM',
      username: 'g00658888',
      password: passwordHash,
      role: UserRole.PM,
    },
  });

  console.log('PM user created:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
