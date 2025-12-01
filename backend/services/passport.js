const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { findPgUserByEmail, createPgUser, updatePgUserLastLogin, findPgUserById } = require('./users');
const { ensureRoleArray, normalizeRoles } = require('./roles');
const { appendLogEntry } = require('./logs');

function registerGoogleStrategy(passport, strategyName, options = {}) {
  const { clientID, clientSecret, callbackURL, requireRoles, defaultRoles = ['alumno'] } = options;
  if (!clientID || !clientSecret || !callbackURL) {
    console.warn(`OAuth ${strategyName} deshabilitado: faltan variables de entorno.`);
    return;
  }

  passport.use(strategyName, new GoogleStrategy({ clientID, clientSecret, callbackURL }, async (_access, _refresh, profile, done) => {
    try {
      const email = (profile.emails && profile.emails[0] && profile.emails[0].value || '').toLowerCase();
      if (!email) return done(null, false, { message: 'Google no entregó correo.' });

      let user = await findPgUserByEmail(email);
      const now = new Date();

      // SOLO permitir login si el usuario ya existe en la base de datos
      if (!user) {
        return done(null, false, { message: 'Cuenta no registrada. Solicite acceso al administrador.' });
      } else {
        // Actualizar roles y last_login si corresponde
        user.role = ensureRoleArray(user.role || user.roles || defaultRoles);
        await updatePgUserLastLogin(user.id, now);
      }

      if (requireRoles && requireRoles.length) {
        const owns = normalizeRoles(user.role || user.roles);
        const needs = normalizeRoles(requireRoles);
        const allowed = needs.some(role => owns.includes(role));
        if (!allowed) return done(null, false, { message: 'Cuenta no autorizada.' });
      }

      // Registrar log de login
      await appendLogEntry({ usuario: email, action: requireRoles ? 'admin_login' : 'login', at: now });
      done(null, user);
    } catch (error) {
      done(error);
    }
  }));
}

module.exports = passport => {
  passport.serializeUser((user, done) => done(null, user?.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await findPgUserById(id);
      done(null, user || false);
    } catch (error) {
      done(error);
    }
  });

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientID || !clientSecret) {
    console.warn('Google OAuth no configurado (falta GOOGLE_CLIENT_ID/SECRET).');
    return;
  }

  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3001';
  const studentCallback = process.env.GOOGLE_STUDENT_CALLBACK || `${baseUrl}/api/auth/google/callback`;
  const adminCallback = process.env.GOOGLE_ADMIN_CALLBACK || `${baseUrl}/api/admin/auth/google/callback`;

  registerGoogleStrategy(passport, 'google-student', {
    clientID,
    clientSecret,
    callbackURL: studentCallback,
    defaultRoles: ['alumno']
  });

  registerGoogleStrategy(passport, 'google-admin', {
    clientID,
    clientSecret,
    callbackURL: adminCallback,
    requireRoles: ['admin']
  });
};
