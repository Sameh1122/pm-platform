// routes/admin.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved } = require('../middleware/permissions');

const prisma = new PrismaClient();
const router = express.Router();

// Middleware بسيط يعتبر المستخدم "أدمن-لايك" لو عنده create_role أو admin_panel
function requireAdminLike(req, res, next) {
  const u = req.user;
  if (!u) return res.redirect('/login');

  const perms = new Set();
  (u.userRoles || []).forEach(ur =>
    (ur.role?.permissions || []).forEach(rp => rp.permission?.name && perms.add(rp.permission.name))
  );

  if (perms.has('create_role') || perms.has('admin_panel')) return next();
  return res.status(403).send('Forbidden');
}

// لوحة الأدمن المختصرة
router.get('/admin', requireAuth, requireApproved, requireAdminLike, async (req, res) => {
  const totalApproved = await prisma.user.count({ where: { status: 'approved' } });
  const totalProjects = await prisma.project.count();
  res.render('admin_index', {
    user: req.user,
    stats: { totalApproved, totalProjects }
  });
});

// مسار صحيح لإدارة الـ Roles
router.get('/admin/roles', requireAuth, requireApproved, requireAdminLike, (req, res) => {
  // لو عندك صفحة /roles شغالة فعلاً، خليه يحوّل عليها
  return res.redirect('/roles');
});

// امسك الغلط الشائع "rules" وحوّل صحيحه
router.get('/admin/rules', requireAuth, requireApproved, requireAdminLike, (req, res) => {
  return res.redirect('/roles');
});

// لو عندك /admin/features مفعّل في راوتر تاني، سيبه يترندر هناك.
// هنا بس نضمن عدم 404 لو حد فتحه، نرميه على الراوتر المختص لو موجود.
router.get('/admin/features', requireAuth, requireApproved, requireAdminLike, (req, res, next) => {
  // لو admin_features راوتر مركّب، هو اللي هيلتقطه قبل ده غالبًا.
  // لو وصل هنا، ممكن تعرض صفحة بسيطة أو تعيد توجيه لصفحة الـ features الفعلية
  try {
    return res.render('admin_features_fallback', { user: req.user });
  } catch (e) {
    // كحل بديل: لو مفيش فيو، رجّعه للوحة الأدمن
    return res.redirect('/admin');
  }
});

module.exports = router;
