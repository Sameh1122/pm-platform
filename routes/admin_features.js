const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireApproved } = require('../middleware/auth');
const { requireFeature } = require('../middleware/permissions');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /admin/features
 * Tabs:
 *  - role: Role Submission (الفورم)
 *  - grants: Current Role Grants (فلاتر + جدول)
 *  - user: User Permissions (بحث بالإيميل + عرض الصلاحيات)
 */
router.get(
  '/admin/features',
  requireAuth,
  requireApproved,
  requireFeature('create_role'),
  async (req, res) => {
    const { roleId, featureId, q, tab, userEmail } = req.query;

    const [roles, users, perms] = await Promise.all([
      prisma.role.findMany({ orderBy: { name: 'asc' } }),
      prisma.user.findMany({ where: { status: 'approved' }, orderBy: { id: 'asc' } }),
      prisma.permission.findMany({ orderBy: { name: 'asc' } }),
    ]);

    // ---- Current Role Grants (سيرفري + فلترة بالذاكرة) ----
    const allRolePerms = await prisma.rolePermission.findMany({
      include: { role: true, permission: true },
      orderBy: { id: 'asc' },
    });

    const rid = Number(roleId) || 0;
    const fid = Number(featureId) || 0;
    const term = (q || '').trim().toLowerCase();

    let rolePerms = allRolePerms;
    if (rid) rolePerms = rolePerms.filter(rp => rp.roleId === rid);
    if (fid) rolePerms = rolePerms.filter(rp => rp.permissionId === fid);
    if (term) {
      rolePerms = rolePerms.filter(rp => {
        const rn = (rp.role?.name || '').toLowerCase();
        const pn = (rp.permission?.name || '').toLowerCase();
        return rn.includes(term) || pn.includes(term);
      });
    }

    // ---- User Permissions Tab ----
    const qEmail = (userEmail || '').trim();
    const userTab = {
      selectedEmail: qEmail,
      selectedUser: null,
      rolesList: [],
      rolePerms: [],
      directPerms: [],
      effectivePerms: [],
    };

    if (qEmail) {
      // حاول طابق الإيميل بالضبط (case-insensitive)
      const sel = users.find(u => (u.email || '').toLowerCase() === qEmail.toLowerCase());
      if (sel) {
        userTab.selectedUser = sel;

        const [urs, ups] = await Promise.all([
          prisma.userRole.findMany({
            where: { userId: sel.id },
            include: { role: { include: { permissions: { include: { permission: true } } } } }
          }),
          prisma.userPermission.findMany({
            where: { userId: sel.id },
            include: { permission: true }
          })
        ]);

        // Roles list
        const rolesList = [];
        const rolePermSet = new Set();
        for (const ur of urs) {
          if (ur.role?.name) rolesList.push(ur.role.name);
          (ur.role?.permissions || []).forEach(rp => {
            if (rp.permission?.name) rolePermSet.add(rp.permission.name);
          });
        }

        const directPermSet = new Set();
        for (const up of ups) {
          if (up.permission?.name) directPermSet.add(up.permission.name);
        }

        const effSet = new Set([...rolePermSet, ...directPermSet]);

        userTab.rolesList = Array.from(new Set(rolesList)).sort();
        userTab.rolePerms = Array.from(rolePermSet).sort();
        userTab.directPerms = Array.from(directPermSet).sort();
        userTab.effectivePerms = Array.from(effSet).sort();
      }
    }

    res.render('admin_features_modern', {
      user: req.user,
      roles, users, perms,
      rolePerms,
      flash: null,
      filters: {
        roleId: rid || '',
        featureId: fid || '',
        q: q || '',
        tab: tab || 'role'
      },
      userTab
    });
  }
);

// Role/User/All apply
router.post(
  '/admin/features/apply',
  requireAuth,
  requireApproved,
  requireFeature('create_role'),
  async (req, res) => {
    const { targetType, roleId, userId, permissionId, action } = req.body;

    try {
      const permId = Number(permissionId);
      if (!permId) throw new Error('permissionId required');

      if (targetType === 'all') {
        const allRoles = await prisma.role.findMany();
        if (action === 'enable') {
          await Promise.all(
            allRoles.map(r =>
              prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: r.id, permissionId: permId } },
                update: {},
                create: { roleId: r.id, permissionId: permId }
              })
            )
          );
        } else {
          await prisma.rolePermission.deleteMany({ where: { permissionId: permId } });
        }
      } else if (targetType === 'role') {
        const rid = Number(roleId);
        if (!rid) throw new Error('roleId required');
        if (action === 'enable') {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: rid, permissionId: permId } },
            update: {},
            create: { roleId: rid, permissionId: permId }
          });
        } else {
          await prisma.rolePermission.deleteMany({ where: { roleId: rid, permissionId: permId } });
        }
      } else if (targetType === 'user') {
        const uid = Number(userId);
        if (!uid) throw new Error('userId required');
        if (action === 'enable') {
          await prisma.userPermission.upsert({
            where: { userId_permissionId: { userId: uid, permissionId: permId } },
            update: {},
            create: { userId: uid, permissionId: permId }
          });
        } else {
          await prisma.userPermission.deleteMany({ where: { userId: uid, permissionId: permId } });
        }
      } else {
        throw new Error('Invalid targetType');
      }

      const searchParams = new URLSearchParams();
      searchParams.set('tab', 'role');
      return res.redirect('/admin/features?' + searchParams.toString());
    } catch (e) {
      console.error('Apply feature error:', e);
      const searchParams = new URLSearchParams();
      searchParams.set('tab', 'role');
      return res.redirect('/admin/features?' + searchParams.toString());
    }
  }
);

// Revoke from role grants
router.post(
  '/admin/features/revoke',
  requireAuth,
  requireApproved,
  requireFeature('create_role'),
  async (req, res) => {
    const { id } = req.body;
    try {
      await prisma.rolePermission.delete({ where: { id: Number(id) } });
    } catch (e) {
      console.error('Revoke error:', e);
    }
    const searchParams = new URLSearchParams();
    searchParams.set('tab', 'grants');
    return res.redirect('/admin/features?' + searchParams.toString());
  }
);

module.exports = router;
