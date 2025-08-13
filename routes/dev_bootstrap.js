const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const router = express.Router();

router.get('/dev/bootstrap-admin', async (req,res)=>{
  const adminRole = await prisma.role.upsert({ where:{ name:'Admin' }, update:{}, create:{ name:'Admin' } });
  const email = 'admin@pm.local', pass = 'admin123';
  const hashed = await bcrypt.hash(pass, 10);
  let user = await prisma.user.findUnique({ where:{ email } });
  if (!user) user = await prisma.user.create({ data:{ email, password: hashed, name:'System Admin', status:'approved' } });
  else await prisma.user.update({ where:{ id:user.id }, data:{ password: hashed, status:'approved' } });
  const link = await prisma.userRole.findFirst({ where:{ userId:user.id, roleId:adminRole.id } });
  if (!link) await prisma.userRole.create({ data:{ userId:user.id, roleId:adminRole.id } });
  res.cookie('userId', user.id, { httpOnly:true, sameSite:'lax', path:'/' });
  res.send('Admin ready & logged-in. <a href="/admin/features">Go to Features</a>');
});

module.exports = router;
