// routes/admin_features.js
const express = require('express');
const { requireAuth, requireApproved, requireAdminLike, requireFeature } = require('../middleware/permissions');

const router = express.Router();

// شاشة Role × Feature (Placeholder أو UI بتاعك لو جاهز)
router.get(
  '/admin/features',
  requireAuth,
  requireApproved,
  requireAdminLike,          // أدمن-لايك
  requireFeature('create_role'), // وبالأخص يمتلك create_role
  (req, res) => {
    // لو عندك View مخصص، بدّل الاسم هنا
    try {
      return res.render('admin_features_fallback', { user: req.user });
    } catch {
      return res.send('<h1>Role × Feature</h1><p>Placeholder page. Add your UI here.</p>');
    }
  }
);

module.exports = router;
