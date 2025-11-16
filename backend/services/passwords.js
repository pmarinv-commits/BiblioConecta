const bcrypt = require('bcryptjs');

const DEFAULT_ROUNDS = 10;
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || DEFAULT_ROUNDS);

function isHashedPassword(value = '') {
  return typeof value === 'string' && value.startsWith('$2');
}

async function hashPassword(plain = '') {
  const normalized = String(plain || '').trim();
  if (!normalized) {
    throw new Error('La contraseña no puede estar vacía');
  }
  return bcrypt.hash(normalized, BCRYPT_ROUNDS);
}

async function comparePassword(plain = '', stored = '') {
  const normalizedPlain = String(plain || '');
  const normalizedStored = String(stored || '');
  if (!normalizedStored) return false;
  if (!isHashedPassword(normalizedStored)) {
    return normalizedPlain === normalizedStored;
  }
  try {
    return await bcrypt.compare(normalizedPlain, normalizedStored);
  } catch (error) {
    return false;
  }
}

module.exports = { hashPassword, comparePassword, isHashedPassword };
