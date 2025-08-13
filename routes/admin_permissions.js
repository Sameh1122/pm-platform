// routes/admin_permissions.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved } = require('../middleware/auth');
const { requireFeature } = require('../middleware/permissions');
const prisma = new PrismaClient();
const router = express.Router();

// بنستخدم create_role كبوابة أدمن
router.get('/admin/permissions',
  requireAuth, requireApproved, requireFeature('create_role'),
  async (req,res)=>{
    const [roles, perms, rolePerms] = await Promise.all([
      prisma.role.findMany({ orderBy:{ name:'asc' }}),
      prisma.permission.findMany({ orderBy:{ name:'asc' }}),
      prisma.rolePermission.findMany()
    ]);

    const map = new Map();
    rolePerms.forEach(rp=>{
      if(!map.has(rp.roleId)) map.set(rp.roleId, new Set());
      map.get(rp.roleId).add(rp.permissionId);
    });

    res.render('admin_permissions', { user:req.user, roles, perms, rolePermsMap: map });
  }
);

router.post('/admin/permissions/toggle',
  requireAuth, requireApproved, requireFeature('create_role'),
  async (req,res)=>{
    const roleId = Number(req.body.roleId);
    const permissionId = Number(req.body.permissionId);
    const enabled = req.body.enabled === '1';
    if(!roleId || !permissionId) return res.status(400).send('roleId & permissionId required');

    const where = { roleId_permissionId: { roleId, permissionId } };
    if (enabled) {
      await prisma.rolePermission.upsert({ where, update:{}, create:{ roleId, permissionId }});
    } else {
      await prisma.rolePermission.deleteMany({ where: { roleId, permissionId }});
    }
    res.redirect('/admin/permissions');
  }
);

module.exports = router;
