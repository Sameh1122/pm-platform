const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

async function currentUser(req){
  const uid=req.cookies.userId; if(!uid) return null;
  return prisma.user.findUnique({ where:{id:Number(uid)}, include:{ userRoles:{ include:{ role:true }}}});
}
function hasRole(u, name){
  if(!u||!u.userRoles) return false;
  name = String(name||'').toLowerCase();
  return u.userRoles.some(ur => String(ur.role.name||'').toLowerCase()===name);
}
async function requireAuth(req,res,next){
  const u=await currentUser(req); if(!u) return res.redirect('/login');
  if(u.status!=='approved') return res.status(403).send('Your account is not approved.');
  req.user=u; next();
}
async function requireProjectOwnerOrAdmin(req,res,next){
  const projectId=Number(req.params.id);
  const project=await prisma.project.findUnique({ where:{ id:projectId }});
  if(!project) return res.status(404).send('Project not found');
  const isAdmin=hasRole(req.user,'admin');
  const isOwner=project.ownerId===req.user.id;
  if(!isAdmin && !isOwner) return res.status(403).send('Forbidden (Owner/Admin)');
  req.project=project; next();
}

router.get('/projects/:id/templates', requireAuth, requireProjectOwnerOrAdmin, async (req,res)=>{
  const [allTemplates, allowed] = await Promise.all([
    prisma.documentTemplate.findMany({ orderBy:{ name:'asc' } }),
    prisma.projectAllowedTemplate.findMany({ where:{ projectId:req.project.id }, include:{ template:true }, orderBy:{ id:'asc' }})
  ]);
  res.render('templates', { user:req.user, project:req.project, allTemplates, allowed });
});

router.post('/projects/:id/templates/new', requireAuth, requireProjectOwnerOrAdmin, async (req,res)=>{
  const name=(req.body.name||'').trim();
  if(!name) return res.status(400).send('Name required');
  try{
    await prisma.documentTemplate.create({ data:{ name, createdBy:req.user.id } });
  }catch(e){ /* ignore duplicates */ }
  res.redirect(`/projects/${req.project.id}/templates`);
});

router.post('/projects/:id/templates/allow', requireAuth, requireProjectOwnerOrAdmin, async (req,res)=>{
  const templateId=Number(req.body.templateId);
  if(!templateId) return res.status(400).send('templateId required');
  try{
    await prisma.projectAllowedTemplate.create({ data:{ projectId:req.project.id, templateId }});
  }catch(e){ /* already allowed */ }
  res.redirect(`/projects/${req.project.id}/templates`);
});

router.post('/projects/:id/templates/disallow', requireAuth, requireProjectOwnerOrAdmin, async (req,res)=>{
  const id=Number(req.body.id);
  if(!id) return res.status(400).send('id required');
  await prisma.projectAllowedTemplate.delete({ where:{ id }});
  res.redirect(`/projects/${req.project.id}/templates`);
});

module.exports = router;
