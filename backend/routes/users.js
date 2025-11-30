const express = require('express');
const { findPgUserByEmail, createPgUser, serializeUser } = require('../services/users');
const { verifyToken, requireRole } = require('../middleware/auth');
// Eliminado: const { computeNextId, findUserByEmail, serializeUser } = require('../services/users');
const { ensureRoleArray } = require('../services/roles');

const router = express.Router();


router.use(verifyToken, requireRole('admin'));
// Eliminado endpoint legacy de usuarios basado en JSON

// GET /api/users - lista todos los usuarios (solo admin)
router.get('/', async (req, res) => {
  try {
    const { rows } = await require('../services/db_pg').query(
      'SELECT id, nombre, rut, email, role, last_login, created_at FROM usuarios ORDER BY created_at DESC'
    );
    const { serializeUser } = require('../services/users');
    const users = rows.map(serializeUser);
    res.json(users);
  } catch (error) {
    console.error('[users] Error al listar usuarios:', error);
    res.status(500).json({ error: 'No se pudieron obtener los usuarios' });
  }
});

router.post('/', async (req, res) => {
  const { nombre, rut, email, role } = req.body || {};
  if (!nombre || !rut || !email) {
    return res.status(400).json({ error: 'Nombre, RUT y correo son obligatorios' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  try {
    const existing = await findPgUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    const now = new Date();
    const selectedRoles = typeof role === 'string' && role.toLowerCase() === 'admin'
      ? ['admin', 'alumno']
      : ['alumno'];
    const newUser = await createPgUser({
      nombre: String(nombre).trim(),
      rut: String(rut).trim(),
      email: normalizedEmail,
      password: String(rut).trim(),
      role: selectedRoles,
      created_at: now,
      last_login: null
    });
    // Aquí podrías agregar un log en PostgreSQL si tienes tabla de logs
    res.status(201).json({ ok: true, user: serializeUser(newUser) });
  } catch (error) {
    console.error('[users] Error al crear usuario:', error);
    res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
});

module.exports = router;
