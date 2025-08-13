const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// Middleware للتأكد من إن الشخص هو PM للمشروع
async function requireProjectPM(req, res, next) {
  const uid = req.cookies.userId;
  if (!uid) return res.redirect('/login');

  const projectId = Number(req.params.projectId);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { owner: true }
  });

  if (!project || project.ownerId !== Number(uid)) {
    return res.status(403).send('Forbidden');
  }

  req.project = project;
  next();
}

// عرض صفحة إعداد الـ Approval Cycle
router.get('/projects/:projectId/approvals/setup', requireProjectPM, async (req, res) => {
  const { projectId } = req.params;

  const documents = await prisma.document.findMany({
    where: { projectId: Number(projectId) },
    include: {
      owner: true,
      approvals: { include: { role: true }, orderBy: { order: 'asc' } }
    }
  });

  const roles = await prisma.role.findMany();

  res.render('approvals_setup', {
    project: req.project,
    documents,
    roles
  });
});

// حفظ الإعدادات
router.post('/projects/:projectId/approvals/save', requireProjectPM, async (req, res) => {
  const { projectId } = req.params;
  const { steps } = req.body; // steps[documentId][] = roleId

  for (const docId in steps) {
    const roleIds = steps[docId];

    // مسح الخطوات القديمة
    await prisma.approvalStep.deleteMany({
      where: { documentId: Number(docId) }
    });

    // إدخال الخطوات الجديدة
    for (let i = 0; i < roleIds.length; i++) {
      await prisma.approvalStep.create({
        data: {
          order: i + 1,
          roleId: Number(roleIds[i]),
          documentId: Number(docId)
        }
      });
    }
  }

  res.redirect(`/projects/${projectId}/preinit`);
});

module.exports = router;
