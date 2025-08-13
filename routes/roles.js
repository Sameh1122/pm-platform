// routes/roles.js
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
  return !!(u && u.userRoles && u.userRoles.some(ur => (ur.role.name||'').toLowerCase()==='admin'));
}
async function requireAdmin(req,res,next){
  const u = await currentUser(req);
  if (!u) return res.redirect('/login');
  if (u.status !== 'approved') return res.status(403).send('Your account is not approved.');
  if (!isAdmin(u)) return res.status(403).send('Forbidden (Admin only)');
  req.user = u; next();
}

// قائمة/إدارة الأدوار
router.get('/', requireAdmin, async (req,res)=>{
  const roles = await prisma.role.findMany({ orderBy:{ name:'asc' } });
  res.render('roles', { user:req.user, roles });
});

router.post('/create', requireAdmin, async (req,res)=>{
  const name = (req.body.name||'').trim();
  if(!name) return res.status(400).send('Role name required');
  await prisma.role.create({ data:{ name }});
  res.redirect('/roles');
});

router.post('/delete', requireAdmin, async (req,res)=>{
  const roleId = Number(req.body.roleId);
  if(!roleId) return res.status(400).send('roleId required');
  // مبدئيًا: امسح الـ role — (لو فيه علاقات لازم تتظبط قبله)
  await prisma.role.delete({ where:{ id: roleId }});
  res.redirect('/roles');
});

module.exports = router;
