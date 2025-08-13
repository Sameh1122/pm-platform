// prisma/seed_minimal.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function upsertPermission(name, description='') {
  return prisma.permission.upsert({
    where: { name },
    update: {},
    create: { name, description }
  });
}

async function upsertRole(name) {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name }
  });
}

async function linkRolePerm(roleName, permName) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  const perm = await prisma.permission.findUnique({ where: { name: permName } });
  const exists = await prisma.rolePermission.findFirst({
    where: { roleId: role.id, permissionId: perm.id }
  });
  if (!exists) {
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  }
}

async function ensureUser(email) {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) throw new Error(`User not found: ${email}. اعمل signup وبعدين شغّل السكريبت تاني.`);
  if (u.status !== 'approved') {
    await prisma.user.update({ where: { id: u.id }, data: { status: 'approved' }});
  }
  return u;
}

async function attachRoleToUser(userId, roleName) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  const found = await prisma.userRole.findFirst({ where: { userId, roleId: role.id } });
  if (!found) {
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
  }
}

async function main() {
  // صلاحيات إدارية أساسية
  const perms = ['admin_panel','create_role'];
  for (const p of perms) await upsertPermission(p);

  // دور أدمن بسيط
  await upsertRole('Admin');
  // اربط صلاحيات الأدمن
  for (const p of perms) await linkRolePerm('Admin', p);

  // أدوار أساسية للمشروع (لو ناقصة)
  const baseRoles = [
    'PM',
    'Business Analyst', 'Business Analyst Manager',
    'Solution Architect', 'Solution Architect Manager',
    'Quality Control', 'Quality Control Manager',
    'Developer', 'Developer Manager',
    'UAT', 'UAT Manager'
  ];
  for (const r of baseRoles) await upsertRole(r);

  // === عدّل الإيميل ده لإيميل الأدمن بتاعك ===
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pm.local';

  const adminUser = await ensureUser(ADMIN_EMAIL);
  await attachRoleToUser(adminUser.id, 'Admin');

  console.log('✅ Seed done. Admin user:', adminUser.email);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
