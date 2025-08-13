// routes/qc_manager.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved, requireRoleName } = require('../middleware/permissions');

const prisma = new PrismaClient();
const router = express.Router();

// QC Manager Dashboard
router.get(
  '/dashboard/qc-manager',
  requireAuth,
  requireApproved,
  requireRoleName('Quality Control Manager'),
  async (req, res) => {
    const qcRole = await prisma.role.findFirst({ where: { name: 'Quality Control' } });

    const projects = await prisma.project.findMany({
      orderBy: { id: 'asc' },
      include: {
        owner: true,
        assignments: { include: { user: true, role: true } }
      }
    });

    let qcUsers = [];
    if (qcRole) {
      const userRoles = await prisma.userRole.findMany({
        where: { roleId: qcRole.id },
        include: { user: true }
      });
      qcUsers = userRoles
        .map(ur => ur.user)
        .filter(Boolean)
        .filter(u => u.status === 'approved')
        .sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email));
    }

    res.render('qc_manager_dashboard', {
      user: req.user,
      projects,
      qcRole,
      qcUsers
    });
  }
);

// Assign/Change QC
router.post(
  '/manager/assign-qc',
  requireAuth,
  requireApproved,
  requireRoleName('Quality Control Manager'),
  async (req, res) => {
    const { projectId, userId } = req.body;

    const qcRole = await prisma.role.findFirst({ where: { name: 'Quality Control' } });
    if (!qcRole) return res.status(400).send('Quality Control role not found');

    const pid = Number(projectId);
    const uid = Number(userId);

    await prisma.$transaction(async (tx) => {
      // امسح أي QC قديم على المشروع
      await tx.assignment.deleteMany({ where: { projectId: pid, roleId: qcRole.id } });
      // لو فيه اختيار لمستخدم، اعمله تعيين
      if (uid) {
        await tx.assignment.create({ data: { projectId: pid, userId: uid, roleId: qcRole.id } });
      }
    });

    res.redirect('/dashboard/qc-manager');
  }
);

module.exports = router;
