const express = require('express');
const passport = require('passport');
const { readDB, saveDB } = require('../services/db_json');
const { findUserByEmail } = require('../services/users');
const { ensureRoleArray } = require('../services/roles');
const { signUserToken, serializeUser } = require('../services/token');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

function buildRedirect(path, params = {}) {
  const base = process.env.APP_BASE_URL || 'http://localhost:3001';
  const url = new URL(path, base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function sanitizeCredentials(req) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '').trim();
  return { email, password };
}

function ensureGoogleStudent(req, res, next) {
  if (!passport._strategy || !passport._strategy('google-student')) {
    return res.redirect(buildRedirect('/catalogo.html', { auth: 'fail' }));
  }
  next();
}

router.post('/login', (req, res) => {
  const { email, password } = sanitizeCredentials(req);
  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña obligatorios' });
  }
  const db = readDB();
  const user = findUserByEmail(db.usuarios || [], email);
  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  const isPasswordValid = String(user.password) === password || String(user.rut) === password;
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  user.role = ensureRoleArray(user.role || user.roles || ['alumno']);
  user.last_login = new Date().toISOString();
  db.logs = db.logs || [];
  db.logs.push({ usuario: user.email, action: 'login', at: user.last_login });
  saveDB(db);
  const token = signUserToken(user);
  res.json({ token, user: serializeUser(user) });
});

router.get('/me', verifyToken, (req, res) => {
  const db = readDB();
  const user = (db.usuarios || []).find(entry => Number(entry.id) === Number(req.user.id));
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user: serializeUser(user) });
});

router.get('/google', ensureGoogleStudent, passport.authenticate('google-student', {
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

router.get('/google/callback', ensureGoogleStudent, passport.authenticate('google-student', {
  failureRedirect: buildRedirect('/catalogo.html', { auth: 'fail' }),
  session: false
}), (req, res) => {
  if (!req.user) {
    return res.redirect(buildRedirect('/catalogo.html', { auth: 'fail' }));
  }
  const token = signUserToken(req.user);
  res.redirect(buildRedirect('/catalogo.html', { token }));
});

module.exports = router;
