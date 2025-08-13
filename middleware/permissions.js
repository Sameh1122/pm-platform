// middleware/permissions.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function loadUser(req, res, next) {
  try {
    const uid = req.cookies.userId ? Number(req.cookies.userId) : null;
    if (!uid) { req.user = null; return next(); }
    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: { userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
    });
    req.user = user || null;
    next();
  } catch (e) {
    console.error('loadUser error', e);
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

function requireApproved(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.status !== 'approved') return res.status(403).send('Forbidden (not approved)');
  next();
}

function isAdminLikeUser(user) {
  const perms = new Set();
  (user?.userRoles || []).forEach(ur =>
    (ur.role?.permissions || []).forEach(rp => rp.permission?.name && perms.add(rp.permission.name))
  );
  return perms.has('create_role') || perms.has('admin_panel') ||
         (user?.userRoles || []).some(ur => (ur.role?.name || '').toLowerCase() === 'admin');
}

function requireAdminLike(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (!isAdminLikeUser(req.user)) return res.status(403).send('Forbidden (admin only)');
  next();
}

function requireRoleName(name) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    const ok = (req.user.userRoles || []).some(
      ur => (ur.role?.name || '').toLowerCase() === String(name).toLowerCase()
    );
    if (!ok) return res.status(403).send('Forbidden');
    next();
  };
}

module.exports = {
  loadUser,
  requireAuth,
  requireApproved,
  requireAdminLike,
  requireRoleName,
  isAdminLikeUser
};
