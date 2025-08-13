// routes/dashboard.js
const express = require('express');
const { requireAuth, requireApproved } = require('../middleware/permissions');

const router = express.Router();

router.get('/dashboard', requireAuth, requireApproved, async (req, res) => {
  const u = req.user;

  // استخرج أسماء الأدوار بحروف صغيرة
  const roles = (u.userRoles || [])
    .map(ur => ur.role?.name)
    .filter(Boolean)
    .map(s => s.toLowerCase());

  // توجيه تلقائي حسب الدور (Managers أولًا)
  if (roles.includes('business analyst manager')) return res.redirect('/dashboard/ba-manager');
  if (roles.includes('solution architect manager')) return res.redirect('/dashboard/sa-manager');
  if (roles.includes('quality control manager')) return res.redirect('/dashboard/qc-manager');
  if (roles.includes('developer manager')) return res.redirect('/dashboard/dev-manager');
  if (roles.includes('uat manager')) return res.redirect('/dashboard/uat-manager');

  // PM
  if (roles.includes('pm')) return res.redirect('/dashboard/pm');

  // BA
  if (roles.includes('business analyst')) return res.redirect('/dashboard/ba');

  // Admin-like? (امتلاك صلاحيات أدمن)
  const allPerms = new Set();
  (u.userRoles || []).forEach(ur =>
    (ur.role?.permissions || []).forEach(rp => rp.permission?.name && allPerms.add(rp.permission.name))
  );
  const isAdminLike = allPerms.has('create_role') || allPerms.has('admin_panel');

  if (isAdminLike) return res.redirect('/admin');

  // Fallback لو مفيش تحويل — ابعت isAdmin للفيو
  return res.render('dashboard', { user: u, isAdmin: isAdminLike });
});

module.exports = router;
