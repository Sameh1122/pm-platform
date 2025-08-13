const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// ===== Helpers =====
async function currentUser(req){
  const uid = req.cookies.userId;
  if (!uid) return null;
  return prisma.user.findUnique({
    where: { id: Number(uid) },
    include: { userRoles: { include: { role: true } } }
  });
}
function hasRole(u, n){
  if (!u || !u.userRoles) return false;
  n = String(n||'').toLowerCase();
  return u.userRoles.some(ur => String(ur.role.name||'').toLowerCase() === n);
}
async function requireAuth(req,res,next){
  const u = await currentUser(req);
  if (!u) return res.redirect('/login');
  if (u.status !== 'approved') return res.status(403).send('Your account is not approved.');
  req.user = u; next();
}
async function userHasRoleOnProject(userId, projectId, roleName){
  const role = await prisma.role.findFirst({ where: { name: roleName } });
  if (!role) return false;
  const a = await prisma.assignment.findFirst({ where: { userId, projectId, roleId: role.id } });
  return !!a;
}
async function requireBAOrAdminOnDoc(req,res,next){
  const docId = Number(req.params.docId);
  const doc = await prisma.projectDocument.findUnique({
    where: { id: docId },
    include: { project: true }
  });
  if (!doc) return res.status(404).send('Document not found');
  const isAdmin = hasRole(req.user,'admin');
  const isBA = await userHasRoleOnProject(req.user.id, doc.projectId, 'Business Analyst');
  if (!isAdmin && !isBA) return res.status(403).send('Forbidden (BA/Admin only)');
  req.document = doc; next();
}

// ===== Multer (PDF/DOC/DOCX) =====
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req,file,cb)=>cb(null, UPLOAD_DIR),
  filename: (req,file,cb)=>{
    const ext  = path.extname(file.originalname||'');
    const base = path.basename(file.originalname||'file', ext).replace(/\s+/g,'_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req,file,cb)=>{
    const ok = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ].includes(file.mimetype);
    cb(ok ? null : new Error('Only PDF/DOC/DOCX allowed'), ok);
  }
});

// ===== VIEW =====
router.get('/documents/:docId', requireAuth, async (req,res)=>{
  const docId = Number(req.params.docId);
  const doc = await prisma.projectDocument.findUnique({
    where: { id: docId },
    include: {
      owner: true,
      project: true,
      template: true,
      files: { include: { uploadedBy: true }, orderBy: { id: 'desc' } }
    }
  });
  if (!doc) return res.status(404).send('Document not found');

  const isAdmin = hasRole(req.user,'admin');
  const isBA    = await userHasRoleOnProject(req.user.id, doc.projectId, 'Business Analyst');

  res.render('document_view', {
    user: req.user,
    doc,
    canManageFiles: (isAdmin || isBA),
    // مسموح بالحذف لأي BA أو Admin طالما الحالة draft
    canDeleteDoc: (doc.status === 'draft') && (isAdmin || isBA)
  });
});

// ===== FILES: upload/replace/delete =====
router.post('/documents/:docId/upload', requireAuth, requireBAOrAdminOnDoc, upload.single('file'), async (req,res)=>{
  if (!req.file) return res.status(400).send('No file');
  await prisma.projectDocumentFile.create({
    data: {
      documentId: req.document.id,
      path: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
      uploadedById: req.user.id
    }
  });
  res.redirect(`/documents/${req.document.id}`);
});

router.post('/documents/:docId/delete-file', requireAuth, requireBAOrAdminOnDoc, async (req,res)=>{
  const fileId = Number(req.body.fileId);
  const f = await prisma.projectDocumentFile.findUnique({ where: { id: fileId }});
  if (!f || f.documentId !== req.document.id) return res.status(404).send('File not found');
  const abs = path.join(__dirname, '..', f.path.replace(/^\//,''));
  try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}
  await prisma.projectDocumentFile.delete({ where: { id: fileId }});
  res.redirect(`/documents/${req.document.id}`);
});

router.post('/documents/:docId/replace-file', requireAuth, requireBAOrAdminOnDoc, upload.single('file'), async (req,res)=>{
  const oldId = Number(req.body.oldFileId);
  const old = await prisma.projectDocumentFile.findUnique({ where: { id: oldId }});
  if (!old || old.documentId !== req.document.id) return res.status(404).send('File to replace not found');

  const abs = path.join(__dirname, '..', old.path.replace(/^\//,''));
  try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}
  await prisma.projectDocumentFile.delete({ where: { id: oldId }});

  if (!req.file) return res.status(400).send('No replacement file');
  await prisma.projectDocumentFile.create({
    data: {
      documentId: req.document.id,
      path: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
      uploadedById: req.user.id
    }
  });
  res.redirect(`/documents/${req.document.id}`);
});

// ===== DELETE DOCUMENT (draft only; أي BA مُعيَّن على المشروع أو Admin) =====
router.post('/documents/:docId/delete', requireAuth, async (req,res)=>{
  const docId = Number(req.params.docId);
  const doc = await prisma.projectDocument.findUnique({
    where: { id: docId },
    include: { files: true, project: true }
  });
  if (!doc) return res.status(404).send('Document not found');

  const isAdmin = hasRole(req.user,'admin');
  const isBA    = await userHasRoleOnProject(req.user.id, doc.projectId, 'Business Analyst');
  if (!(isAdmin || isBA)) return res.status(403).send('Forbidden');
  if (doc.status !== 'draft') return res.status(400).send('Cannot delete non-draft document');

  // delete files from disk & DB
  for (const f of doc.files){
    const abs = path.join(__dirname, '..', f.path.replace(/^\//,''));
    try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}
    await prisma.projectDocumentFile.delete({ where: { id: f.id }});
  }
  await prisma.projectDocument.delete({ where: { id: docId }});
  res.redirect(`/projects/${doc.projectId}/preinit`);
});

module.exports = router;
