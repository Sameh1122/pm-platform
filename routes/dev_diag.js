const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

router.get('/dev/session', async (req,res)=>{
  const uid = req.cookies.userId ? Number(req.cookies.userId) : null;
  let u = null;
  if (uid) u = await prisma.user.findUnique({ where:{ id: uid }, include:{ userRoles:{ include:{ role:true }}} });
  res.send(`<pre>${JSON.stringify({ cookies:req.cookies, user: u && { id:u.id, email:u.email, roles: u.userRoles.map(r=>r.role.name), status:u.status } }, null, 2)}</pre>`);
});

module.exports = router;
