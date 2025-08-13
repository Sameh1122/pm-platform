// routes/sa_manager.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved, requireRoleName } = require('../middleware/permissions');

const prisma = new PrismaClient();
const router = express.Router();

// SA Manager Dashboard
router.get(
  '/dashboard/sa-manager',
  requireAuth,
  requireApproved,
  requireRoleName('Solution Architect Manager'),
  async (req, res) => {
    const saRole = await prisma.role.findFirst({ where: { name: 'Solution Architect' } });

    const projects = await prisma.project.findMany({
      orderBy: { id: 'asc' },
      include: {
        owner: true,
        assignments: { include: { user: true, role: true } }
      }
    });

    let saUsers = [];
    if (saRole) {
      const userRoles = await prisma.userRole.findMany({
        where: { roleId: saRole.id },
        include: { user: true }
      });
      saUsers = userRoles
        .map(ur => ur.user)
        .filter(Boolean)
        .filter(u => u.status === 'approved')
        .sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email));
    }

    res.render('sa_manager_dashboard', {
      user: req.user,
      projects,
      saRole,
      saUsers
    });
  }
);

// Assign/Change Solution Architect
router.post(
  '/manager/assign-sa',
  requireAuth,
  requireApproved,
  requireRoleName('Solution Architect Manager'),
  async (req, res) => {
    const { projectId, userId } = req.body;

    const saRole = await prisma.role.findFirst({ where: { name: 'Solution Architect' } });
    if (!saRole) return res.status(400).send('Solution Architect role not found');

    const pid = Number(projectId);
    const uid = Number(userId);

    await prisma.$transaction(async (tx) => {
      // امسح أي SA قديم على المشروع
      await tx.assignment.deleteMany({ where: { projectId: pid, roleId: saRole.id } });
      // لو فيه اختيار لمستخدم، اعمله تعيين
      if (uid) {
        await tx.assignment.create({ data: { projectId: pid, userId: uid, roleId: saRole.id } });
      }
    });

    res.redirect('/dashboard/sa-manager');
  }
);

module.exports = router;
