// routes/adminRoles.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// Middleware للتحقق أن اليوزر Admin
async function requireAdmin(req, res, next) {
  const uid = req.cookies.userId;
  if (!uid) return res.redirect('/login');
  const user = await prisma.user.findUnique({
    where: { id: Number(uid) },
    include: { userRoles: { include: { role: true } } }
  });

  const isAdmin = user?.userRoles?.some(r => r.role.name === 'Admin');
  if (!isAdmin) return res.status(403).send('Forbidden');
  
  req.user = user;
  next();
}

// عرض كل الـ Roles
router.get('/admin/roles', requireAdmin, async (req, res) => {
  const roles = await prisma.role.findMany();
  res.render('adminRoles', { roles });
});

// إضافة Role جديد
router.post('/admin/roles', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send('Role name is required');
  
  await prisma.role.create({ data: { name } });
  res.redirect('/admin/roles');
});

// تعديل اسم Role
router.post('/admin/roles/edit', requireAdmin, async (req, res) => {
  const { id, name } = req.body;
  await prisma.role.update({
    where: { id: Number(id) },
    data: { name }
  });
  res.redirect('/admin/roles');
});

// مسح Role
router.post('/admin/roles/delete', requireAdmin, async (req, res) => {
  const { id } = req.body;
  await prisma.role.delete({ where: { id: Number(id) } });
  res.redirect('/admin/roles');
});

module.exports = router;
