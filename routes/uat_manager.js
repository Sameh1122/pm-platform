// routes/uat_manager.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved, requireRoleName } = require('../middleware/permissions');

const prisma = new PrismaClient();
const router = express.Router();

// UAT Manager Dashboard
router.get(
  '/dashboard/uat-manager',
  requireAuth,
  requireApproved,
  requireRoleName('UAT Manager'),
  async (req, res) => {
    const uatRole = await prisma.role.findFirst({ where: { name: 'UAT' } });

    const projects = await prisma.project.findMany({
      orderBy: { id: 'asc' },
      include: {
        owner: true,
        assignments: { include: { user: true, role: true } }
      }
    });

    let uatUsers = [];
    if (uatRole) {
      const userRoles = await prisma.userRole.findMany({
        where: { roleId: uatRole.id },
        include: { user: true }
      });
      uatUsers = userRoles
        .map(ur => ur.user)
        .filter(Boolean)
        .filter(u => u.status === 'approved')
        .sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email));
    }

    res.render('uat_manager_dashboard', {
      user: req.user,
      projects,
      uatRole,
      uatUsers
    });
  }
);

// Assign/Change UAT
router.post(
  '/manager/assign-uat',
  requireAuth,
  requireApproved,
  requireRoleName('UAT Manager'),
  async (req, res) => {
    const { projectId, userId } = req.body;

    const uatRole = await prisma.role.findFirst({ where: { name: 'UAT' } });
    if (!uatRole) return res.status(400).send('UAT role not found');

    const pid = Number(projectId);
    const uid = Number(userId);

    await prisma.$transaction(async (tx) => {
      await tx.assignment.deleteMany({ where: { projectId: pid, roleId: uatRole.id } });
      if (uid) {
        await tx.assignment.create({ data: { projectId: pid, userId: uid, roleId: uatRole.id } });
      }
    });

    res.redirect('/dashboard/uat-manager');
  }
);

module.exports = router;
