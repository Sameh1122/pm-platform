// middleware/permissions.js
const { PrismaClient } = require('@prisma/client');
const { can } = require('../lib/acl');
const prisma = new PrismaClient();

function requireFeature(featureName) {
  return async function(req, res, next) {
    if (!req.user) return res.redirect('/login');
    if (req.user.status !== 'approved') {
      return res.status(403).send('Your account is not approved.');
    }
    if (!(await can(req.user, featureName))) {
      return res.status(403).send(`Forbidden (need: ${featureName})`);
    }
    next();
  };
}

function requireAnyFeature(features = []) {
  return async function(req, res, next) {
    if (!req.user) return res.redirect('/login');
    if (req.user.status !== 'approved') {
      return res.status(403).send('Your account is not approved.');
    }
    for (const f of features) {
      if (await can(req.user, f)) return next();
    }
    return res.status(403).send(`Forbidden (need one of: ${features.join(', ')})`);
  };
}

function requireProjectAccess(adminGateFeature = 'create_role') {
  return async function(req, res, next) {
    if (!req.user) return res.redirect('/login');
    if (req.user.status !== 'approved') {
      return res.status(403).send('Your account is not approved.');
    }
    const projectId = Number(req.params.id);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).send('Project not found');

    const isOwner = project.ownerId === req.user.id;
    const assigned = await prisma.assignment.findFirst({
      where: { projectId, userId: req.user.id }
    });
    const hasAdminGate = await can(req.user, adminGateFeature);

    if (!isOwner && !assigned && !hasAdminGate) {
      return res.status(403).send('Forbidden (no project access)');
    }
    req.project = project;
    next();
  };
}

module.exports = { requireFeature, requireAnyFeature, requireProjectAccess };
