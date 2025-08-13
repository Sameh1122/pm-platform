const express = require('express');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();
const router = express.Router();

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 1025,
  ignoreTLS: true
});

async function requireAdmin(req, res, next) {
  const uid = req.cookies.userId;
  if (!uid) return res.redirect('/login');
  const user = await prisma.user.findUnique({
    where: { id: Number(uid) },
    include: { userRoles: { include: { role: true } } }
  });
  if (!user) return res.redirect('/login');
  const isAdmin = user.userRoles.some(ur => ur.role.name.toLowerCase() === 'admin');
  if (!isAdmin) return res.status(403).send('Forbidden');
  req.user = user;
  next();
}

router.get('/admin', requireAdmin, async (req, res) => {
  let { q = '', status = '', roleId = '' } = req.query;

  const where = {};
  if (q) {
    const search = q.toLowerCase();
    // جلب جميع المستخدمين ثم فلترة الـ case-insensitive في الذاكرة
    const allUsers = await prisma.user.findMany({
      include: { userRoles: { include: { role: true } } }
    });

    const filteredUsers = allUsers.filter(
      u =>
        u.email.toLowerCase().includes(search) ||
        (u.name && u.name.toLowerCase().includes(search))
    );

    // تطبيق باقي الفلاتر
    const finalUsers = filteredUsers.filter(u => {
      if (status && u.status !== status) return false;
      if (roleId && !u.userRoles.some(ur => ur.roleId === Number(roleId))) return false;
      return true;
    });

    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });

    return res.render('admin', {
      users: finalUsers,
      roles,
      filters: { q, status, roleId },
      total: finalUsers.length
    });
  }

  // لو مفيش بحث بالنص
  if (status) where.status = status;
  if (roleId) {
    where.userRoles = {
      some: { roleId: Number(roleId) }
    };
  }

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { userRoles: { include: { role: true } } },
      orderBy: { id: 'asc' }
    }),
    prisma.role.findMany({ orderBy: { name: 'asc' } })
  ]);

  const total = await prisma.user.count({ where });

  res.render('admin', {
    users,
    roles,
    filters: { q, status, roleId },
    total
  });
});

router.post('/admin/decide', requireAdmin, async (req, res) => {
  const { userId, action, roleId } = req.body;

  if (action === 'approve') {
    await prisma.user.update({ where: { id: Number(userId) }, data: { status: 'approved' }});
  } else if (action === 'reject') {
    await prisma.user.update({ where: { id: Number(userId) }, data: { status: 'rejected' }});
  } else if (action === 'suspend') {
    await prisma.user.update({ where: { id: Number(userId) }, data: { status: 'suspended' }});
  } else if (action === 'reactivate') {
    await prisma.user.update({ where: { id: Number(userId) }, data: { status: 'approved' }});
  } else if (action === 'delete') {
    await prisma.userRole.deleteMany({ where: { userId: Number(userId) }});
    await prisma.user.delete({ where: { id: Number(userId) }});
    return res.redirect('/admin');
  } else if (action === 'assignRole' && roleId) {
    const exists = await prisma.userRole.findFirst({
      where: { userId: Number(userId), roleId: Number(roleId) }
    });
    if (!exists) {
      await prisma.userRole.create({ data: { userId: Number(userId), roleId: Number(roleId) }});
    }
  } else if (action === 'removeRole' && roleId) {
    const role = await prisma.role.findUnique({ where: { id: Number(roleId) }});
    if (role?.name.toLowerCase() === 'admin') {
      const adminCount = await prisma.userRole.count({ where: { role: { name: 'admin' } } });
      if (adminCount <= 1) return res.status(400).send('Cannot remove the last admin');
    }
    await prisma.userRole.deleteMany({ where: { userId: Number(userId), roleId: Number(roleId) }});
  } else {
    return res.status(400).send('Invalid action');
  }

  const u = await prisma.user.findUnique({ where: { id: Number(userId) }});
  if (u) {
    try {
      await transporter.sendMail({
        from: 'no-reply@pmplatform.local',
        to: u.email,
        subject: `Account update`,
        text: `Hello ${u.name || u.email}, your account status is now "${u.status}".`
      });
    } catch(e) {}
  }

  res.redirect('/admin');
});

module.exports = router;
