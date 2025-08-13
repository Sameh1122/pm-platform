// routes/dashboard.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

async function currentUser(req){
  const uid = req.cookies.userId; if(!uid) return null;
  return prisma.user.findUnique({
    where: { id: Number(uid) },
    include: { userRoles: { include: { role: true } } }
  });
}
function isAdmin(u){
  return !!(u && u.userRoles && u.userRoles.some(ur => (ur.role.name||'').toLowerCase() === 'admin'));
}
async function requireAuth(req,res,next){
  const u = await currentUser(req);
  if (!u) return res.redirect('/login');
  if (u.status !== 'approved') return res.status(403).send('Your account is not approved.');
  req.user = u; next();
}

router.get('/dashboard', requireAuth, async (req,res)=>{
  const admin = isAdmin(req.user);

  let projects = [];
  if (admin) {
    projects = await prisma.project.findMany({
      include: { owner: true, _count: { select: { assignments: true } } },
      orderBy: { id: 'desc' }
    });
  } else {
    const owned = await prisma.project.findMany({
      where: { ownerId: req.user.id },
      include: { owner: true, _count: { select: { assignments: true } } },
      orderBy: { id: 'desc' }
    });
    const assigns = await prisma.assignment.findMany({
      where: { userId: req.user.id },
      include: { project: { include: { owner: true, _count: { select: { assignments: true } } } } },
      orderBy: { id: 'desc' }
    });
    const map = new Map();
    owned.forEach(p => map.set(p.id, p));
    assigns.forEach(a => map.set(a.project.id, a.project));
    projects = Array.from(map.values()).sort((a,b)=> b.id-a.id);
  }

  res.render('dashboard', {
    user: req.user,
    isAdmin: admin,
    projects
  });
});

module.exports = router;
