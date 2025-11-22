const { ensureRoleArray, primaryRole } = require('./roles');
const { query } = require('./db_pg');

function computeNextId(list = []) {
  if (!Array.isArray(list) || !list.length) return 1;
  const numericIds = list
    .map(item => Number(item?.id) || 0)
    .filter(value => Number.isFinite(value));
  const max = numericIds.length ? Math.max(...numericIds) : 0;
  return max + 1;
}

function findUserByEmail(list = [], email = '') {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized) return undefined;
  return list.find(user => String(user?.email || '').trim().toLowerCase() === normalized);
}

function serializeUser(user) {
  if (!user) return null;
  const roles = ensureRoleArray(user.role || user.roles);
  return {
    id: user.id,
    nombre: user.nombre,
    rut: user.rut,
    email: user.email,
    role: primaryRole(roles),
    roles,
    last_login: user.last_login || null,
    created_at: user.created_at || null
  };
}

function mapPgUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.nombre,
    rut: row.rut,
    email: row.email,
    password: row.password,
    role: ensureRoleArray(row.role || row.roles || ['alumno']),
    last_login: row.last_login ? new Date(row.last_login).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null
  };
}

async function findPgUserByEmail(email = '') {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const { rows } = await query(
    `SELECT id, nombre, rut, email, password, role, last_login, created_at
     FROM usuarios
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalized]
  );
  return mapPgUser(rows[0]);
}

async function findPgUserById(id) {
  if (!id && id !== 0) return null;
  const { rows } = await query(
    `SELECT id, nombre, rut, email, password, role, last_login, created_at
     FROM usuarios
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return mapPgUser(rows[0]);
}

async function updatePgUserLastLogin(id, lastLogin = new Date()) {
  if (!id && id !== 0) return;
  await query(
    'UPDATE usuarios SET last_login = $2 WHERE id = $1',
    [id, lastLogin instanceof Date ? lastLogin.toISOString() : lastLogin]
  );
}

module.exports = {
  computeNextId,
  findUserByEmail,
  serializeUser,
  findPgUserByEmail,
  findPgUserById,
  updatePgUserLastLogin
};
