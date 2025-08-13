const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // إنشاء role admin لو مش موجود
  let adminRole = await prisma.role.findUnique({
    where: { name: 'admin' }
  });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { name: 'admin' }
    });
  }

  // جيب اليوزر اللي هو إنت
  const user = await prisma.user.findUnique({
    where: { email: 'admin@pm.local' }
  });

  if (!user) {
    console.log('User not found!');
    return;
  }

  // ربط اليوزر بالـ role admin
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: adminRole.id
    }
  });

  console.log('Admin role linked to user successfully.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
