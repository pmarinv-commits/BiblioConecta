function normalizeRoles(input) {
  if (!input && input !== 0) return [];
  const source = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [input];
  const roles = [];
  source.forEach(value => {
    const role = String(value ?? '')
      .trim()
      .toLowerCase();
    if (role && !roles.includes(role)) {
      roles.push(role);
    }
  });
  return roles;
}

function ensureRoleArray(value, fallback = ['alumno']) {
  const normalized = normalizeRoles(value);
  if (normalized.length) return normalized;
  return normalizeRoles(fallback);
}

function hasRole(currentRoles, expected) {
  const owned = normalizeRoles(currentRoles);
  if (!expected) return true;
  const targets = normalizeRoles(expected);
  if (!targets.length) return true;
  return targets.some(role => owned.includes(role));
}

function primaryRole(value) {
  const roles = normalizeRoles(value);
  return roles.length ? roles[0] : null;
}

module.exports = {
  normalizeRoles,
  ensureRoleArray,
  hasRole,
  primaryRole
};
