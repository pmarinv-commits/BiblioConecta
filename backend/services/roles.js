function normalizeSingleRole(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    return trimmed || null;
  }
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

function unique(list = []) {
  const seen = new Set();
  for (const item of list) {
    if (!seen.has(item)) seen.add(item);
  }
  return Array.from(seen);
}

function toRoleArray(roleValue) {
  if (Array.isArray(roleValue)) {
    return unique(roleValue
      .map(normalizeSingleRole)
      .filter(Boolean));
  }
  const normalized = normalizeSingleRole(roleValue);
  return normalized ? [normalized] : [];
}

function normalizeExpectedRoles(expectedRoles) {
  if (Array.isArray(expectedRoles)) {
    return unique(expectedRoles
      .map(normalizeSingleRole)
      .filter(Boolean));
  }
  const normalized = normalizeSingleRole(expectedRoles);
  return normalized ? [normalized] : [];
}

function hasAnyRole(roleValue, expectedRoles) {
  const roles = toRoleArray(roleValue);
  const allowed = normalizeExpectedRoles(expectedRoles);
  if (!roles.length || !allowed.length) return false;
  return roles.some((role) => allowed.includes(role));
}

function pickPrimaryRole(roleValue, fallback = null) {
  const roles = toRoleArray(roleValue);
  return roles[0] || fallback;
}

function ensureRoleArray(roleValue, fallbackRoles = []) {
  const roles = toRoleArray(roleValue);
  const fallback = normalizeExpectedRoles(fallbackRoles);
  if (!roles.length && fallback.length) return fallback;
  if (fallback.length) {
    fallback.forEach((role) => {
      if (!roles.includes(role)) roles.push(role);
    });
  }
  return roles;
}

module.exports = {
  toRoleArray,
  hasAnyRole,
  pickPrimaryRole,
  ensureRoleArray
};
