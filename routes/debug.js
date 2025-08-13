// routes/debug.js
const express = require('express');
const router = express.Router();

router.get('/_whoami', (req, res) => {
  const u = req.user;
  if (!u) return res.status(401).json({ auth:false });
  res.json({
    id: u.id, email: u.email, status: u.status, name: u.name,
    roles: (u.userRoles||[]).map(ur => ur.role?.name),
    perms: [].concat(...(u.userRoles||[]).map(ur =>
      (ur.role?.permissions||[]).map(rp => rp.permission?.name)
    )).filter(Boolean)
  });
});

module.exports = router;
