const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const router = express.Router();

// GET /login (اختياري — عندنا فورم على الـ Home)
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// GET /signup (نسخة مستقلة + Dropdown أدوار)
router.get('/signup', async (req, res) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
    res.render('signup', { roles, error: null });
  } catch (e) {
    res.render('signup', { roles: [], error: 'Error loading roles' });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const u = await prisma.user.findUnique({ where: { email }, include: { userRoles: { include: { role: true }}} });
  if (!u) return res.render('login', { error: 'Invalid email or password' });
  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return res.render('login', { error: 'Invalid email or password' });
  if (u.status !== 'approved') return res.status(403).send('Your account is not approved yet.');
  res.cookie('userId', u.id, { httpOnly: true, sameSite: 'lax', path: '/' });
  return res.redirect('/');
});

// POST /signup  (يحفظ الدور المختار ويخلي الحالة pending)
router.post('/signup', async (req, res) => {
  const { name, email, password, roleId } = req.body;
  let roles = [];
  try { roles = await prisma.role.findMany({ orderBy: { name: 'asc' } }); } catch {}

  if (!roleId) {
    return res.render('signup', { roles, error: 'Please select a role' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashed,
        status: 'pending',
        userRoles: { create: { roleId: Number(roleId) } }
      }
    });
    // رسالة تأكيد
    return res.render('message', {
      title: 'Registration submitted',
      body: 'Your request is pending admin approval. You will be notified when approved.',
      backHref: '/login',
      backText: 'Go to login'
    });
  } catch (e) {
    const isUnique = String(e?.message || '').toLowerCase().includes('unique');
    const msg = isUnique ? 'Email already exists' : 'Signup error';
    return res.render('signup', { roles, error: msg });
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  res.clearCookie('userId', { path: '/' });
  res.redirect('/');
});

module.exports = router;
