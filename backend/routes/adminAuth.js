const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { readDB, saveDB } = require('../services/db_json');
const { comparePassword } = require('../services/passwords');
const { toRoleArray, hasAnyRole, pickPrimaryRole } = require('../services/roles');

function issueToken(user, { activeRole } = {}) {
  const roles = toRoleArray(user.role);
  const resolvedRole = activeRole || pickPrimaryRole(roles) || 'admin';
  return jwt.sign({ id: user.id, role: resolvedRole, roles, email: user.email }, process.env.JWT_SECRET || 'devsecret', {
    expiresIn: '8h'
  });
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }
    const db = readDB();
    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = db.usuarios.find(u => (u.email || '').toLowerCase() === normalizedEmail && hasAnyRole(u.role, 'admin'));
    if (!admin) {
      return res.status(401).json({ error: 'Administrador no encontrado' });
    }
    const validPassword = await comparePassword(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    admin.last_login = new Date().toISOString();
    db.logs = db.logs || [];
    db.logs.push({ usuario: admin.email, action: 'admin_login', at: admin.last_login });
    saveDB(db);
    const roles = toRoleArray(admin.role);
    const activeRole = 'admin';
    const token = issueToken(admin, { activeRole });
    res.json({ token, user: { id: admin.id, nombre: admin.nombre, email: admin.email, role: activeRole, roles } });
  } catch (error) {
    console.error('Error en login admin', error);
    res.status(500).json({ error: 'No se pudo iniciar sesión' });
  }
});

router.get('/google', passport.authenticate('google-admin', { scope: ['profile', 'email'], prompt: 'select_account' }));

router.get('/google/callback', passport.authenticate('google-admin', { failureRedirect: '/admin/login?auth=fail' }), (req, res) => {
  const token = issueToken(req.user, { activeRole: 'admin' });
  res.redirect(`/admin/login?token=${encodeURIComponent(token)}`);
});

module.exports = router;
