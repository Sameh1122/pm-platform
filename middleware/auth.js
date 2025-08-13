// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

router.get('/signup', (req, res) => res.render('signup', { msg: null, error: null }));

router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.render('signup', { msg: null, error: 'This email is already registered.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, password: hashed, name, status: 'pending' }
    });
    return res.render('message', { title: 'Signup', body: 'Registered. Your request is pending admin approval.' });
  } catch (e) {
    return res.status(400).send('Error: ' + e.message);
  }
});

router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const u = await prisma.user.findUnique({
    where: { email },
    include: { userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
  });
  if (!u) return res.render('login', { error: 'Invalid credentials.' });
  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return res.render('login', { error: 'Invalid credentials.' });

  // اكتب الكوكي وبعدين حول
  res.cookie('userId', String(u.id), { httpOnly: true, sameSite: 'lax' });
  return res.redirect('/dashboard'); // هنوجّه ذكي من هناك
});

router.get('/logout', (req, res) => {
  res.clearCookie('userId');
  res.redirect('/');
});

module.exports = router;
