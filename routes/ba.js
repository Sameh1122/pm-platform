// routes/ba.js
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
async function requireAuth(req,res,next){
  const u = await currentUser(req);
  if (!u) return res.redirect('/login');
  if (u.status !== 'approved') return res.status(403).send('Your account is not approved.');
  req.user = u; next();
}

// GET /dashboard — مشاريع المستخدم (Owner أو Assigned بأي Role)
router.get('/dashboard', requireAuth, async (req, res) => {
  const owned = await prisma.project.findMany({
    where: { ownerId: req.user.id },
    include: { owner: true },
    orderBy: { id: 'desc' }
  });

  const assigns = await prisma.assignment.findMany({
    where: { userId: req.user.id },
    include: { project: { include: { owner: true } } },
    orderBy: { id: 'desc' }
  });

  const assignedProjects = assigns.map(a => a.project);
  const map = new Map();
  [...owned, ...assignedProjects].forEach(p => map.set(p.id, p));
  const projects = Array.from(map.values()).sort((a,b)=> b.id-a.id);

  res.render('ba_dashboard', { user: req.user, projects });
});

module.exports = router;
