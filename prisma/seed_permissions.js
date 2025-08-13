// prisma/seed_permissions.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FEATURES = [
  { name: 'create_project',   description: 'Create new projects (PM)' },
  { name: 'add_document',     description: 'Add business documents (BA)' },
  { name: 'assign_members',   description: 'Assign team members to a project (Managers)' },
  { name: 'create_artifact',  description: 'Manage document templates (Admin/PMO)' },
  { name: 'create_role',      description: 'Admin panel: roles & permissions' },
];

const DEFAULT_ROLES = [
  'Admin',
  'Project Manager',
  'Business Analyst',
  'Business Analyst Manager',
  'Solution Architect',
  'Solution Architect Manager',
  'Quality Control',
  'Quality Control Manager',
  'Developer',
  'Development Manager',
  'UAT',
  'UAT Manager'
];

const DEFAULT_ROLE_FEATURES = {
  'Admin': [
    'create_role','create_artifact','create_project','add_document','assign_members'
  ],
  'Project Manager': ['create_project','create_artifact'],
  'Business Analyst': ['add_document'],
  'Business Analyst Manager': ['assign_members'],
  'Solution Architect Manager': ['assign_members'],
  'Quality Control Manager': ['assign_members'],
  'Development Manager': ['assign_members'],
  'UAT Manager': ['assign_members'],
  // أفراد التيم (بدون ميزات إدارية)
  'Solution Architect': [],
  'Quality Control':   [],
  'Developer':         [],
  'UAT':               [],
};

const DEFAULT_ASSIGNABLE = [
  // managerRoleName -> targetRoleName
  ['Business Analyst Manager',   'Business Analyst'],
  ['Solution Architect Manager', 'Solution Architect'],
  ['Quality Control Manager',    'Quality Control'],
  ['Development Manager',        'Developer'],
  ['UAT Manager',                'UAT'],
];

async function main(){
  // Ensure roles
  const roleMap = {};
  for(const r of DEFAULT_ROLES){
    const role = await prisma.role.upsert({
      where: { name: r },
      update: {},
      create: { name: r }
    });
    roleMap[r] = role;
  }

  // Ensure permissions (features)
  const permMap = {};
  for(const f of FEATURES){
    const p = await prisma.permission.upsert({
      where: { name: f.name },
      update: { description: f.description || null },
      create: { name: f.name, description: f.description || null }
    });
    permMap[f.name] = p;
  }

  // Attach defaults (Role ↔︎ Feature)
  for(const [roleName, feats] of Object.entries(DEFAULT_ROLE_FEATURES)){
    const role = roleMap[roleName];
    for(const feat of feats){
      const perm = permMap[feat];
      const exists = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionId: perm.id }
      });
      if(!exists){
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id }});
      }
    }
  }

  // Fill default assignable matrix for managers
  for(const [managerName, targetName] of DEFAULT_ASSIGNABLE){
    const m = roleMap[managerName];
    const t = roleMap[targetName];
    if (m && t) {
      const exists = await prisma.roleAssignable.findFirst({
        where: { managerRoleId: m.id, targetRoleId: t.id }
      });
      if(!exists){
        await prisma.roleAssignable.create({
          data: { managerRoleId: m.id, targetRoleId: t.id }
        });
      }
    }
  }

  console.log('✅ Seeded: features, role-permissions, and role-assignable matrix.');
}
main().finally(()=>prisma.$disconnect());
