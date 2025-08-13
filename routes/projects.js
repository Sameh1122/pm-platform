// routes/projects.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved } = require('../middleware/auth');
const { requireFeature } = require('../middleware/permissions');
const prisma = new PrismaClient();
const router = express.Router();

router.get('/projects/new',
  requireAuth, requireApproved, requireFeature('create_project'),
  (req, res) => {
    res.render('project_new', { user: req.user });
  }
);

router.post('/projects/new',
  requireAuth, requireApproved, requireFeature('create_project'),
  async (req, res) => {
    const name = (req.body.name||'').trim();
    const methodology = (req.body.methodology||'waterfall').toLowerCase();
    if(!name) return res.status(400).send('Project name is required');

    const project = await prisma.project.create({
      data: { name, methodology, ownerId: req.user.id }
    });

    res.redirect(`/projects/${project.id}/preinit`);
  }
);

module.exports = router;
