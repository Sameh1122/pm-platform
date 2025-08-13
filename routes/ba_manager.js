const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved, requireRoleName } = require('../middleware/permissions');

const prisma = new PrismaClient();
const router = express.Router();

router.get(
  '/dashboard/ba-manager',
  requireAuth,
  requireApproved,
  requireRoleName('Business Analyst Manager'),
  async (req, res) => {
    const baRole = await prisma.role.findFirst({ where: { name: 'Business Analyst' } });

    const projects = await prisma.project.findMany({
      orderBy: { id: 'asc' },
      include: {
        owner: true,
        assignments: { include: { user: true, role: true } }
      }
    });

    let baUsers = [];
    if (baRole) {
      const userRoles = await prisma.userRole.findMany({
        where: { roleId: baRole.id },
        include: { user: true }
      });
      baUsers = userRoles
        .map(ur => ur.user)
        .filter(Boolean)
        .filter(u => u.status === 'approved')
        .sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email));
    }

    res.render('ba_manager_dashboard', { user: req.user, projects, baRole, baUsers });
  }
);

router.post(
  '/manager/assign-ba',
  requireAuth,
  requireApproved,
  requireRoleName('Business Analyst Manager'),
  async (req, res) => {
    const { projectId, userId } = req.body;
    const baRole = await prisma.role.findFirst({ where: { name: 'Business Analyst' } });
    if (!baRole) return res.status(400).send('Business Analyst role not found');

    const pid = Number(projectId);
    const uid = Number(userId);

    await prisma.$transaction(async (tx) => {
      await tx.assignment.deleteMany({ where: { projectId: pid, roleId: baRole.id } });
      if (uid) {
        await tx.assignment.create({ data: { projectId: pid, userId: uid, roleId: baRole.id } });
      }
    });

    res.redirect('/dashboard/ba-manager');
  }
);

module.exports = router;
