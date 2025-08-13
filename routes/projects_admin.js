// routes/projects_admin.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const prisma = new PrismaClient();
const router = express.Router();

// -------- helpers ----------
async function currentUser(req){
  const uid = req.cookies.userId; if(!uid) return null;
  return prisma.user.findUnique({
    where: { id: Number(uid) },
    include: { userRoles: { include: { role: true } } }
  });
}
function isAdmin(u){
  return !!(u && u.userRoles && u.userRoles.some(ur => (ur.role.name||'').toLowerCase()==='admin'));
}
async function requireAdmin(req,res,next){
  const u = await currentUser(req);
  if (!u) return res.redirect('/login');
  if (u.status !== 'approved') return res.status(403).send('Your account is not approved.');
  if (!isAdmin(u)) return res.status(403).send('Forbidden (Admin only)');
  req.user = u;
  next();
}

// -------- delete project ----------
router.post('/projects/:id/delete', requireAdmin, async (req, res) => {
  const projectId = Number(req.params.id);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).send('Project not found');

  // 1) هات كل الدوكيومنتس والفايلات
  const documents = await prisma.projectDocument.findMany({
    where: { projectId },
    include: { files: true }
  });

  // 2) امسح الفايلات من الديسك ثم من الداتابيز
  for (const d of documents) {
    for (const f of d.files) {
      const abs = path.join(__dirname, '..', f.path.replace(/^\//,''));
      try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}
      await prisma.projectDocumentFile.delete({ where: { id: f.id }});
    }
  }

  // 3) approvals (owners & steps)
  await prisma.approvalOwner.deleteMany({ where: { document: { projectId } }});
  await prisma.approvalStep.deleteMany({ where: { document: { projectId } }});

  // 4) documents
  await prisma.projectDocument.deleteMany({ where: { projectId }});

  // 5) allowed templates
  await prisma.projectAllowedTemplate.deleteMany({ where: { projectId }});

  // 6) assignments
  await prisma.assignment.deleteMany({ where: { projectId }});

  // 7) أخيرًا المشروع
  await prisma.project.delete({ where: { id: projectId }});

  // رجّع للأدمن داشبورد أو الهوم
  res.redirect('/dashboard');
});

module.exports = router;
