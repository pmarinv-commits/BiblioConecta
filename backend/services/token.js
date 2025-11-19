const jwt = require('jsonwebtoken');
const { serializeUser } = require('./users');

function signUserToken(user) {
  const payloadUser = serializeUser(user);
  if (!payloadUser) return null;
  const secret = process.env.JWT_SECRET || 'devsecret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    {
      id: payloadUser.id,
      email: payloadUser.email,
      role: payloadUser.role,
      roles: payloadUser.roles
    },
    secret,
    { expiresIn }
  );
}

module.exports = {
  signUserToken,
  serializeUser
};
