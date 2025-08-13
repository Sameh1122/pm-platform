// routes/roles.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved, requireAdminLike } = require('../middleware/permissions');

const prisma = new PrismaClient();
const router = express.Router();

// List roles
router.get('/roles', requireAuth, requireApproved, requireAdminLike, async (req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { id: 'asc' },
    include: { permissions: { include: { permission: true } }, users: true }
  });
  res.render('roles', { user: req.user, roles });
});

// Create new role
router.post('/roles', requireAuth, requireApproved, requireAdminLike, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).send('Role name required');
  try {
    await prisma.role.create({ data: { name: name.trim() } });
    res.redirect('/roles');
  } catch (e) {
    res.status(400).send('Error creating role: ' + e.message);
  }
});

// Delete role (soft guard: prevent deleting if users assigned)
router.post('/roles/:id/delete', requireAuth, requireApproved, requireAdminLike, async (req, res) => {
  const id = Number(req.params.id);
  const count = await prisma.userRole.count({ where: { roleId: id } });
  if (count > 0) return res.status(400).send('Cannot delete a role with assigned users.');
  await prisma.role.delete({ where: { id } });
  res.redirect('/roles');
});

module.exports = router;
