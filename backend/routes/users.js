const express = require('express');
const { readDB, saveDB } = require('../services/db_json');
const { verifyToken, requireRole } = require('../middleware/auth');
const { computeNextId, findUserByEmail, serializeUser } = require('../services/users');
const { ensureRoleArray } = require('../services/roles');

const router = express.Router();

router.use(verifyToken, requireRole('admin'));

router.get('/', (_req, res) => {
  const db = readDB();
  const payload = (db.usuarios || []).map(serializeUser);
  res.json(payload);
});

router.post('/', (req, res) => {
  const { nombre, rut, email, role } = req.body || {};
  if (!nombre || !rut || !email) {
    return res.status(400).json({ error: 'Nombre, RUT y correo son obligatorios' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const db = readDB();
  db.usuarios = db.usuarios || [];
  if (findUserByEmail(db.usuarios, normalizedEmail)) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
  }
  const now = new Date().toISOString();
  const selectedRoles = typeof role === 'string' && role.toLowerCase() === 'admin'
    ? ['admin', 'alumno']
    : ['alumno'];
  const newUser = {
    id: computeNextId(db.usuarios),
    nombre: String(nombre).trim(),
    rut: String(rut).trim(),
    email: normalizedEmail,
    password: String(rut).trim(),
    role: ensureRoleArray(selectedRoles),
    created_at: now,
    last_login: null
  };
  db.usuarios.push(newUser);
  db.logs = db.logs || [];
  db.logs.push({ usuario: req.user?.email || 'admin', action: 'user_created', at: now, target: normalizedEmail });
  saveDB(db);
  res.status(201).json({ ok: true, user: serializeUser(newUser) });
});

module.exports = router;
