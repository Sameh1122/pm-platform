// routes/dev_bootstrap.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * يخلق/يعدّل يوزر أدمن جاهز:
 * email: admin@pm.local
 * password: admin123
 */
router.get('/dev/bootstrap-admin', async (req, res) => {
  // تأكد وجود Role "Admin"
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin' },
  });

  // ابني اليوزر
  const email = 'admin@pm.local';
  const plain = 'admin123';
  const hashed = await bcrypt.hash(plain, 10);

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: 'System Admin',
        status: 'approved',
      },
    });
  } else {
    // ضمن إنه Approved وكلمة السر مضبوطة
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, status: 'approved' },
    });
  }

  // اربط اليوزر بدور Admin
  const exists = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: adminRole.id },
  });
  if (!exists) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: adminRole.id },
    });
  }

  // سجّل دخوله بوضع الكوكي
  res.cookie('userId', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  res.send(
    '✅ Admin bootstrapped & logged in. Email: admin@pm.local / Password: admin123<br>' +
    '<a href="/admin/features">Go to Feature Matrix</a>'
  );
});

module.exports = router;
