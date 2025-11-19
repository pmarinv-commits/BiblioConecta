const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { readDB, saveDB } = require('./db_json');
const { computeNextId, findUserByEmail } = require('./users');
const { ensureRoleArray, normalizeRoles } = require('./roles');

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

      const db = readDB();
      db.usuarios = db.usuarios || [];
      let user = findUserByEmail(db.usuarios, email);
      const now = new Date().toISOString();

      if (!user) {
        if (requireRoles && requireRoles.length) {
          return done(null, false, { message: 'Cuenta no autorizada.' });
        }
        user = {
          id: computeNextId(db.usuarios),
          nombre: profile.displayName || 'Usuario Google',
          rut: profile.id || email,
          email,
          password: profile.id || email,
          role: ensureRoleArray(defaultRoles),
          last_login: now,
          created_at: now
        };
        db.usuarios.push(user);
      } else {
        user.role = ensureRoleArray(user.role || user.roles || defaultRoles);
        user.last_login = now;
      }

      if (requireRoles && requireRoles.length) {
        const owns = normalizeRoles(user.role || user.roles);
        const needs = normalizeRoles(requireRoles);
        const allowed = needs.some(role => owns.includes(role));
        if (!allowed) return done(null, false, { message: 'Cuenta no autorizada.' });
      }

      db.logs = db.logs || [];
      db.logs.push({ usuario: email, action: requireRoles ? 'admin_login' : 'login', at: now });
      saveDB(db);
      done(null, user);
    } catch (error) {
      done(error);
    }
  }));
}

module.exports = passport => {
  passport.serializeUser((user, done) => done(null, user?.id));
  passport.deserializeUser((id, done) => {
    try {
      const db = readDB();
      const user = (db.usuarios || []).find(entry => Number(entry.id) === Number(id));
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
