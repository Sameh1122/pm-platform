const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const baseRoles = ['user', 'admin'];
  for (const name of baseRoles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log('✅ Base roles ensured:', baseRoles.join(', '));
}

main().catch(console.error).finally(()=>prisma.$disconnect());
