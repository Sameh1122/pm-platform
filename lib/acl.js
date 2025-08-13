// lib/acl.js
// Feature-based access helpers for the app
//
// Exports:
//  - can(userOrId, feature)           -> Promise<boolean>
//  - isAdmin(user)                    -> boolean   (works if user.userRoles is included)
//  - isAdminById(userId)              -> Promise<boolean>
//  - permissionsForUser(userId)       -> Promise<string[]>

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Collect all permission names a user has via roles.
 * Returns array of strings like ['create_project', 'assign_members', ...]
 */
async function permissionsForUser(userId) {
  if (!userId) return [];
  const rows = await prisma.userRole.findMany({
    where: { userId: Number(userId) },
    include: {
      role: {
        include: {
          permissions: {            // RolePermission[]
            include: { permission: true } // Permission
          }
        }
      }
    }
  });

  const set = new Set();
  for (const ur of rows) {
    for (const rp of (ur.role?.permissions || [])) {
      if (rp.permission?.name) set.add(rp.permission.name);
    }
  }
  return Array.from(set);
}

/**
 * Universal checker:
 * - accepts either a user object (with .id) OR a numeric userId
 * - returns true if the user has the given feature permission
 */
async function can(userOrId, feature) {
  const userId = typeof userOrId === 'object' && userOrId !== null
    ? userOrId.id
    : Number(userOrId);

  if (!userId || !feature) return false;
  const perms = await permissionsForUser(userId);
  return perms.includes(String(feature));
}

/**
 * Fast admin check when you already loaded:
 *   user with: include { userRoles: { include: { role: true } } }
 */
function isAdmin(user) {
  if (!user || !Array.isArray(user.userRoles)) return false;
  return user.userRoles.some(
    (ur) => String(ur.role?.name || '').toLowerCase() === 'admin'
  );
}

/**
 * Admin check by userId (DB lookup).
 * Useful when you don't have user.userRoles loaded.
 */
async function isAdminById(userId) {
  if (!userId) return false;
  const rows = await prisma.userRole.findMany({
    where: { userId: Number(userId) },
    include: { role: true }
  });
  return rows.some(
    (ur) => String(ur.role?.name || '').toLowerCase() === 'admin'
  );
}

module.exports = {
  can,
  isAdmin,
  isAdminById,
  permissionsForUser,
};
