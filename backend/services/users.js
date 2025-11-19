const { ensureRoleArray, primaryRole } = require('./roles');

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

module.exports = {
  computeNextId,
  findUserByEmail,
  serializeUser
};
