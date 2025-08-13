// routes/dev_manager.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved, requireRoleName } = require('../middleware/permissions');

const prisma = new PrismaClient();
const router = express.Router();

// Developer Manager Dashboard
router.get(
  '/dashboard/dev-manager',
  requireAuth,
  requireApproved,
  requireRoleName('Developer Manager'),
  async (req, res) => {
    const devRole = await prisma.role.findFirst({ where: { name: 'Developer' } });

    const projects = await prisma.project.findMany({
      orderBy: { id: 'asc' },
      include: {
        owner: true,
        assignments: { include: { user: true, role: true } }
      }
    });

    let devUsers = [];
    if (devRole) {
      const userRoles = await prisma.userRole.findMany({
        where: { roleId: devRole.id },
        include: { user: true }
      });
      devUsers = userRoles
        .map(ur => ur.user)
        .filter(Boolean)
        .filter(u => u.status === 'approved')
        .sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email));
    }

    res.render('dev_manager_dashboard', {
      user: req.user,
      projects,
      devRole,
      devUsers
    });
  }
);

// Assign/Change Developer
router.post(
  '/manager/assign-dev',
  requireAuth,
  requireApproved,
  requireRoleName('Developer Manager'),
  async (req, res) => {
    const { projectId, userId } = req.body;

    const devRole = await prisma.role.findFirst({ where: { name: 'Developer' } });
    if (!devRole) return res.status(400).send('Developer role not found');

    const pid = Number(projectId);
    const uid = Number(userId);

    await prisma.$transaction(async (tx) => {
      await tx.assignment.deleteMany({ where: { projectId: pid, roleId: devRole.id } });
      if (uid) {
        await tx.assignment.create({ data: { projectId: pid, userId: uid, roleId: devRole.id } });
      }
    });

    res.redirect('/dashboard/dev-manager');
  }
);

module.exports = router;
