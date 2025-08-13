// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

/* SIGNUP (GET) */
router.get('/signup', async (req, res) => {
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
  res.render('signup', { roles });
});

/* SIGNUP (POST) */
router.post('/signup', async (req, res) => {
  const { email, password, name, roleId } = req.body;
  if (!email || !password || !roleId) return res.redirect('/message?code=missing');

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.redirect('/message?code=duplicate');

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, status: 'pending' }
    });

    const role = await prisma.role.findUnique({ where: { id: Number(roleId) } });
    if (!role) {
      await prisma.user.delete({ where: { id: user.id } });
      return res.redirect('/message?code=badrole');
    }

    await prisma.userRole.create({ data: { userId: user.id, roleId: Number(roleId) } });
    return res.redirect('/message?code=pending');
  } catch (e) {
    console.error(e);
    return res.redirect('/message?code=error');
  }
});

/* LOGIN (GET) */
router.get('/login', (req, res) => res.render('login'));

/* LOGIN (POST) -> /dashboard */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const u = await prisma.user.findUnique({
    where: { email },
    include: { userRoles: { include: { role: true } } }
  });
  if (!u) return res.redirect('/message?code=invalid');

  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return res.redirect('/message?code=invalid');

  // Admin مسموح يدخل حتى لو مش approved لادارة النظام
  const roles = u.userRoles.map(ur => ur.role.name.toLowerCase());
  const isAdmin = roles.includes('admin');
  if (!isAdmin && u.status !== 'approved') {
    return res.redirect('/message?code=notapproved');
  }

  res.cookie('userId', u.id, { httpOnly: true });
  return res.redirect('/dashboard');
});

/* WELCOME (Profile) */
router.get('/welcome', async (req, res) => {
  const uid = req.cookies.userId;
  if (!uid) return res.redirect('/login');

  const u = await prisma.user.findUnique({
    where: { id: Number(uid) },
    include: { userRoles: { include: { role: true } } }
  });
  if (!u) return res.redirect('/login');

  res.render('welcome', { user: u });
});

/*Logout */
router.get('/logout', (req, res) => {
  res.clearCookie('userId');
  return res.redirect('/');
});

module.exports = router;
