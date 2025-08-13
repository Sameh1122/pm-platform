const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

/** helper: يحدّد كل مانجر بيدير أي member role */
const MANAGED_MAP = {
  'business analyst manager': 'Business Analyst',
  'solution architect manager': 'Solution Architect',
  'quality control manager': 'Quality Control',
  'development manager': 'Developer',
  'uat manager': 'UAT',
  // admin يشوف الكل ويقدر يعيّن في أي specialization
};

/** requireManager: لازم يبقى Approved + معاه أي Role من المانجرز أو Admin */
async function requireManager(req, res, next) {
  const uid = req.cookies.userId;
  if (!uid) return res.redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: Number(uid) },
    include: { userRoles: { include: { role: true } } }
  });
  if (!user) return res.redirect('/login');
  if (user.status !== 'approved') return res.status(403).send('Your account is not approved.');

  const roles = user.userRoles.map(ur => ur.role.name.toLowerCase());
  const isAdmin = roles.includes('admin');

  // يملك أي من أدوار المديرين؟
  const isManager = roles.some(r => Object.keys(MANAGED_MAP).includes(r));
  if (!isAdmin && !isManager) {
    return res.status(403).send('Forbidden (Managers/Admin only)');
  }

  req.user = user;
  req.isAdmin = isAdmin;
  req.rolesLower = roles;
  next();
}

/** Dashboard للمدير: كل المشاريع + اختيار نوع التخصص للمشاهدة/التعيين */
router.get('/manager', requireManager, async (req, res) => {
  // لو Admin: يقدر يختار أي تخصص. لو Manager: تخصّصه فقط.
  let specializations = [];
  if (req.isAdmin) {
    specializations = [
      'Business Analyst',
      'Solution Architect',
      'Quality Control',
      'Developer',
      'UAT'
    ];
  } else {
    // استخرج تخصصه من الـ MANAGED_MAP
    specializations = req.rolesLower
      .filter(r => Object.keys(MANAGED_MAP).includes(r))
      .map(r => MANAGED_MAP[r]);
  }

  const projects = await prisma.project.findMany({
    orderBy: { id: 'desc' },
    include: {
      owner: true,
      assignments: { include: { user: true, role: true } }
    }
  });

  res.render('manager_dashboard', {
    user: req.user,
    isAdmin: req.isAdmin,
    specializations,
    projects
  });
});

/** صفحة تعيين أعضاء لفريق تخصص معيّن على مشروع معيّن */
router.get('/projects/:id/assign', requireManager, async (req, res) => {
  const { id } = req.params;
  const { specialization } = req.query; // ex: "Business Analyst"

  if (!specialization) return res.status(400).send('Missing specialization');

  // لو مش Admin، تأكد إن التخصص ده ضمن صلاحياته
  if (!req.isAdmin) {
    const allowedSpecs = req.rolesLower
      .filter(r => Object.keys(MANAGED_MAP).includes(r))
      .map(r => MANAGED_MAP[r]);
    if (!allowedSpecs.includes(specialization)) {
      return res.status(403).send('Forbidden for this specialization');
    }
  }

  // هات الـ Role ID الخاص بالتخصص المطلوب
  const memberRole = await prisma.role.findUnique({ where: { name: specialization } });
  if (!memberRole) return res.status(400).send('Specialization role does not exist');

  // المشروع
  const project = await prisma.project.findUnique({
    where: { id: Number(id) },
    include: {
      assignments: { include: { user: true, role: true } }
    }
  });
  if (!project) return res.status(404).send('Project not found');

  // هات كل الأعضاء اللي معاهم الدور ده، Approved فقط
  const allCandidates = await prisma.user.findMany({
    where: {
      status: 'approved',
      userRoles: {
        some: {
          roleId: memberRole.id
        }
      }
    },
    orderBy: { id: 'asc' }
  });

  // المعيّنين بالفعل في هذا المشروع بنفس الدور
  const alreadyAssignedIds = project.assignments
    .filter(a => a.roleId === memberRole.id)
    .map(a => a.userId);

  // المتاحين للتعيين الآن
  const available = allCandidates.filter(u => !alreadyAssignedIds.includes(u.id));

  res.render('assign_members', {
    user: req.user,
    project,
    specialization,
    memberRole,
    assigned: project.assignments.filter(a => a.roleId === memberRole.id),
    available
  });
});

/** POST: تعيين عضو */
router.post('/projects/:id/assign', requireManager, async (req, res) => {
  const { id } = req.params;
  const { userId, roleId } = req.body;

  if (!userId || !roleId) return res.status(400).send('Missing userId/roleId');

  // منع التكرار
  const exists = await prisma.assignment.findFirst({
    where: { projectId: Number(id), userId: Number(userId), roleId: Number(roleId) }
  });
  if (!exists) {
    await prisma.assignment.create({
      data: {
        projectId: Number(id),
        userId: Number(userId),
        roleId: Number(roleId)
      }
    });
  }

  const role = await prisma.role.findUnique({ where: { id: Number(roleId) } });
  const spec = role?.name || '';
  return res.redirect(`/projects/${id}/assign?specialization=${encodeURIComponent(spec)}`);
});

/** POST: إزالة عضو من المشروع لتخصص معيّن */
router.post('/projects/:id/unassign', requireManager, async (req, res) => {
  const { id } = req.params;
  const { assignmentId, roleId } = req.body;
  if (!assignmentId || !roleId) return res.status(400).send('Missing assignmentId/roleId');

  await prisma.assignment.delete({ where: { id: Number(assignmentId) } });

  const role = await prisma.role.findUnique({ where: { id: Number(roleId) } });
  const spec = role?.name || '';
  return res.redirect(`/projects/${id}/assign?specialization=${encodeURIComponent(spec)}`);
});

module.exports = router;
