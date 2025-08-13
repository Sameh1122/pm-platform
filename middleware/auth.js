const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setCurrentUser(req, res, next) {
  try {
    const uid = req.cookies.userId;
    if (!uid) { req.user=null; res.locals.currentUser=null; return next(); }
    const user = await prisma.user.findUnique({
      where: { id: Number(uid) },
      include: { userRoles: { include: { role: true } } }
    });
    req.user = user || null;
    res.locals.currentUser = req.user;
  } catch {
    req.user = null; res.locals.currentUser = null;
  }
  next();
}

async function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

async function requireApproved(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.status !== 'approved') return res.status(403).send('Your account is not approved.');
  next();
}

module.exports = { setCurrentUser, requireAuth, requireApproved };
