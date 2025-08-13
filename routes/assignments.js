// routes/assignments.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved } = require('../middleware/auth');
const { requireFeature, requireProjectAccess } = require('../middleware/permissions');
const prisma = new PrismaClient();
const router = express.Router();

async function isAdminUser(userId) {
  const rows = await prisma.userRole.findMany({ where:{ userId }, include:{ role:true }});
  return rows.some(r => (r.role?.name || '').toLowerCase() === 'admin');
}

async function canAssignTargetRole(userId, targetRoleId) {
  // لو أدمن: allowed
  if (await isAdminUser(userId)) return true;

  // هل عنده أي Manager-Role مسموح له يعيّن هذا الـ target?
  const myRoles = await prisma.userRole.findMany({ where:{ userId }, include:{ role:true }});
  const myRoleIds = myRoles.map(r => r.roleId);
  const link = await prisma.roleAssignable.findFirst({
    where: {
      managerRoleId: { in: myRoleIds },
      targetRoleId
    }
  });
  return !!link;
}

router.get('/projects/:id/assign',
  requireAuth, requireApproved, requireFeature('assign_members'), requireProjectAccess(),
  async (req, res) => {
    const projectId = Number(req.params.id);
    const [users, roles, assignments] = await Promise.all([
      prisma.user.findMany({ where:{ status:'approved' }, orderBy:{ id:'asc' } }),
      prisma.role.findMany({ orderBy:{ name:'asc' } }),
      prisma.assignment.findMany({
        where:{ projectId },
        include:{ user:true, role:true },
        orderBy:{ id:'asc' }
      })
    ]);
    res.render('assign', { user:req.user, project:req.project, users, roles, assignments });
  }
);

router.post('/projects/:id/assign',
  requireAuth, requireApproved, requireFeature('assign_members'), requireProjectAccess(),
  async (req,res)=>{
    const projectId = Number(req.params.id);
    const userId = Number(req.body.userId);
    const roleId = Number(req.body.roleId);
    if(!userId || !roleId) return res.status(400).send('userId and roleId are required');

    // تحقق من matrix (هل المُسجّل الحالي يحق له تعيين roleId؟)
    if (!(await canAssignTargetRole(req.user.id, roleId))) {
      return res.status(403).send('Forbidden: your manager role cannot assign this target role');
    }

    try {
      await prisma.assignment.create({ data:{ projectId, userId, roleId }});
    } catch(_) {}
    res.redirect(`/projects/${projectId}/assign`);
  }
);

router.post('/projects/:id/assign/remove',
  requireAuth, requireApproved, requireFeature('assign_members'), requireProjectAccess(),
  async (req,res)=>{
    const projectId = Number(req.params.id);
    const assignId = Number(req.body.assignId);
    if(!assignId) return res.status(400).send('assignId is required');
    await prisma.assignment.delete({ where:{ id: assignId }});
    res.redirect(`/projects/${projectId}/assign`);
  }
);

module.exports = router;
