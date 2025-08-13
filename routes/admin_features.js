// routes/admin_features.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved } = require('../middleware/auth');
const { requireFeature } = require('../middleware/permissions');

const prisma = new PrismaClient();
const router = express.Router();

// ====== Role x Feature ======
router.get('/admin/features',
  requireAuth, requireApproved, requireFeature('create_role'),
  async (req, res) => {
    const [roles, perms, rolePerms] = await Promise.all([
      prisma.role.findMany({ orderBy:{ name:'asc' } }),
      prisma.permission.findMany({ orderBy:{ name:'asc' } }),
      prisma.rolePermission.findMany()
    ]);
    const map = new Map();
    rolePerms.forEach(rp => {
      if(!map.has(rp.roleId)) map.set(rp.roleId, new Set());
      map.get(rp.roleId).add(rp.permissionId);
    });
    res.render('admin_features', { user:req.user, roles, perms, rolePermsMap: map });
  }
);

router.post('/admin/features/toggle',
  requireAuth, requireApproved, requireFeature('create_role'),
  async (req,res)=>{
    const roleId = Number(req.body.roleId);
    const permissionId = Number(req.body.permissionId);
    const enabled = req.body.enabled === '1';
    if(!roleId || !permissionId) return res.status(400).send('roleId & permissionId required');

    const where = { roleId_permissionId: { roleId, permissionId } };
    if(enabled){
      await prisma.rolePermission.upsert({ where, update:{}, create:{ roleId, permissionId }});
    } else {
      await prisma.rolePermission.deleteMany({ where:{ roleId, permissionId }});
    }
    res.redirect('/admin/features');
  }
);

// ====== Manager x Target-Role ======
router.get('/admin/assignable',
  requireAuth, requireApproved, requireFeature('create_role'),
  async (req,res)=>{
    const roles = await prisma.role.findMany({ orderBy:{ name:'asc' } });

    // managers = roles اللي معاها assign_members
    const perm = await prisma.permission.findUnique({ where:{ name:'assign_members' }});
    let managerRoles = roles;
    if (perm) {
      const allowed = await prisma.rolePermission.findMany({
        where: { permissionId: perm.id },
        include: { role: true }
      });
      const ids = new Set(allowed.map(a => a.roleId));
      managerRoles = roles.filter(r => ids.has(r.id));
    } else {
      managerRoles = []; // لا يوجد Feature أصلاً
    }

    const assignables = await prisma.roleAssignable.findMany();
    const matrix = new Map(); // managerRoleId -> Set(targetRoleId)
    assignables.forEach(a=>{
      if(!matrix.has(a.managerRoleId)) matrix.set(a.managerRoleId, new Set());
      matrix.get(a.managerRoleId).add(a.targetRoleId);
    });

    res.render('admin_assignable', {
      user:req.user,
      managerRoles,
      targetRoles: roles, // كل الأدوار ممكن تكون Targets
      matrix
    });
  }
);

router.post('/admin/assignable/toggle',
  requireAuth, requireApproved, requireFeature('create_role'),
  async (req,res)=>{
    const managerRoleId = Number(req.body.managerRoleId);
    const targetRoleId  = Number(req.body.targetRoleId);
    const enabled       = req.body.enabled === '1';

    if(!managerRoleId || !targetRoleId) return res.status(400).send('managerRoleId & targetRoleId required');

    const where = { managerRoleId, targetRoleId };
    if (enabled) {
      const exists = await prisma.roleAssignable.findFirst({ where });
      if(!exists) await prisma.roleAssignable.create({ data: where });
    } else {
      await prisma.roleAssignable.deleteMany({ where });
    }
    res.redirect('/admin/assignable');
  }
);

module.exports = router;
