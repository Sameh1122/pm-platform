const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function permissionsForUser(userId) {
  const uid = Number(userId);
  if (!uid) return [];

  // from roles
  const viaRoles = await prisma.userRole.findMany({
    where: { userId: uid },
    include: { role: { include: { permissions: { include: { permission: true } } } } }
  });

  const set = new Set();
  for (const ur of viaRoles) {
    for (const rp of (ur.role?.permissions || [])) {
      if (rp.permission?.name) set.add(rp.permission.name);
    }
  }

  // direct user perms (overrides)
  const viaUser = await prisma.userPermission.findMany({
    where: { userId: uid },
    include: { permission: true }
  });
  for (const up of viaUser) {
    if (up.permission?.name) set.add(up.permission.name);
  }

  return Array.from(set);
}

async function can(userOrId, feature) {
  const userId = typeof userOrId === 'object' && userOrId ? userOrId.id : Number(userOrId);
  if (!userId || !feature) return false;
  const perms = await permissionsForUser(userId);
  return perms.includes(String(feature));
}

function isAdmin(user) {
  if (!user || !Array.isArray(user.userRoles)) return false;
  return user.userRoles.some(ur => (ur.role?.name || '').toLowerCase() === 'admin');
}

async function isAdminById(userId) {
  const rows = await prisma.userRole.findMany({ where: { userId: Number(userId) }, include: { role: true } });
  return rows.some(r => (r.role?.name || '').toLowerCase() === 'admin');
}

module.exports = { can, isAdmin, isAdminById, permissionsForUser };
