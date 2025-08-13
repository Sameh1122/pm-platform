// routes/project_docs.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved } = require('../middleware/auth');
const { requireFeature, requireProjectAccess } = require('../middleware/permissions');
const prisma = new PrismaClient();
const router = express.Router();

router.get('/projects/:id/preinit',
  requireAuth, requireApproved, requireProjectAccess(),
  async (req, res) => {
    const projectId = Number(req.params.id);
    const [docs, allowedTemplates] = await Promise.all([
      prisma.projectDocument.findMany({
        where:{ projectId },
        orderBy:{ id:'asc' },
        include:{ owner:true, template:true, files:true }
      }),
      prisma.projectAllowedTemplate.findMany({
        where:{ projectId },
        include:{ template:true },
        orderBy:{ id:'asc' }
      })
    ]);

    const canAssignTeam      = true  && await requireFeature('assign_members').call(null)({user:req.user}, {status:()=>{}}, ()=>true).catch(()=>false);
    const canAddDocument     = true  && await requireFeature('add_document').call(null)({user:req.user}, {status:()=>{}}, ()=>true).catch(()=>false);
    const canManageTemplates = true  && await requireFeature('create_artifact').call(null)({user:req.user}, {status:()=>{}}, ()=>true).catch(()=>false);

    // بدل hack فوق: نحسب features مباشرة في DB (أبسط في EJS)
    const fAssign   = await prisma.rolePermission.findFirst({ where:{ role: { users: { some: { userId: req.user.id } } }, permission: { name: 'assign_members' } }});
    const fAdd      = await prisma.rolePermission.findFirst({ where:{ role: { users: { some: { userId: req.user.id } } }, permission: { name: 'add_document' } }});
    const fArtifact = await prisma.rolePermission.findFirst({ where:{ role: { users: { some: { userId: req.user.id } } }, permission: { name: 'create_artifact' } }});

    res.render('preinit', {
      user: req.user,
      project: req.project,
      documents: docs,
      allowedTemplates,
      canAssignTeam: !!fAssign,
      canAddDocument: !!fAdd,
      canManageTemplates: !!fArtifact
    });
  }
);

router.get('/projects/:id/documents/add',
  requireAuth, requireApproved, requireProjectAccess(), requireFeature('add_document'),
  async (req,res)=>{
    const projectId = Number(req.params.id);
    const allowed = await prisma.projectAllowedTemplate.findMany({
      where:{ projectId },
      include:{ template:true },
      orderBy:{ id:'asc' }
    });
    res.render('add_document', { user:req.user, project:req.project, allowed });
  }
);

router.post('/projects/:id/documents/add',
  requireAuth, requireApproved, requireProjectAccess(), requireFeature('add_document'),
  async (req,res)=>{
    const projectId = Number(req.params.id);
    const templateId= Number(req.body.templateId);
    if(!templateId) return res.status(400).send('templateId required');

    const allowed=await prisma.projectAllowedTemplate.findFirst({ where:{ projectId, templateId }});
    if(!allowed) return res.status(403).send('Template not allowed in this project');

    const tpl=await prisma.documentTemplate.findUnique({ where:{ id:templateId }});
    if(!tpl) return res.status(404).send('Template not found');

    await prisma.projectDocument.create({
      data:{ projectId, templateId, type: tpl.name, ownerId:req.user.id, status:'draft' }
    });

    res.redirect(`/projects/${projectId}/preinit`);
  }
);

// Templates manage (allow/deny)
router.get('/projects/:id/templates',
  requireAuth, requireApproved, requireProjectAccess(), requireFeature('create_artifact'),
  async (req,res)=>{
    const projectId = Number(req.params.id);
    const [all, allowed] = await Promise.all([
      prisma.documentTemplate.findMany({ orderBy:{ name:'asc' } }),
      prisma.projectAllowedTemplate.findMany({ where:{ projectId }, include:{ template:true }, orderBy:{ id:'asc' } })
    ]);
    res.render('templates', { user:req.user, project:req.project, all, allowed });
  }
);

router.post('/projects/:id/templates/allow',
  requireAuth, requireApproved, requireProjectAccess(), requireFeature('create_artifact'),
  async (req,res)=>{
    const projectId = Number(req.params.id);
    const templateId= Number(req.body.templateId);
    if(!templateId) return res.status(400).send('templateId required');

    await prisma.projectAllowedTemplate.upsert({
      where:{ projectId_templateId: { projectId, templateId } },
      update:{},
      create:{ projectId, templateId }
    });
    res.redirect(`/projects/${projectId}/templates`);
  }
);

router.post('/projects/:id/templates/deny',
  requireAuth, requireApproved, requireProjectAccess(), requireFeature('create_artifact'),
  async (req,res)=>{
    const projectId = Number(req.params.id);
    const templateId= Number(req.body.templateId);
    if(!templateId) return res.status(400).send('templateId required');

    await prisma.projectAllowedTemplate.deleteMany({ where:{ projectId, templateId }});
    res.redirect(`/projects/${projectId}/templates`);
  }
);

module.exports = router;
