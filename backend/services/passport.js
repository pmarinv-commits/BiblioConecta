const GoogleStrategy = require('passport-google-oauth20').Strategy;
const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname,'../database.json');
const { hasAnyRole } = require('./roles');

function readDB(){ return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }

function writeDB(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }

module.exports = function(passport){
  passport.serializeUser((user, done)=> done(null, user.email));
  passport.deserializeUser((id, done)=> {
    const db = readDB();
    const u = db.usuarios.find(x=> x.email===id);
    done(null, u || null);
  });

  const clientID = process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET';
  const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');

  const resolveCallback = (explicit, defaultPath) => {
    const trimmed = explicit && explicit.trim();
    if(trimmed) return trimmed;
    if(baseUrl) return `${baseUrl}${defaultPath}`;
    return defaultPath;
  };

  const strategies = [
    {
      name: 'google-admin',
      allowedRoles: ['admin'],
      callbackURL: resolveCallback(process.env.GOOGLE_ADMIN_CALLBACK, '/api/admin/auth/google/callback')
    },
    {
      name: 'google-student',
      allowedRoles: ['alumno'],
      callbackURL: resolveCallback(process.env.GOOGLE_STUDENT_CALLBACK || process.env.GOOGLE_CALLBACK, '/api/auth/google/callback')
    }
  ];

  strategies.forEach(({ name, allowedRoles, callbackURL }) => {
    passport.use(name, new GoogleStrategy({ clientID, clientSecret, callbackURL, passReqToCallback: true }, (req, accessToken, refreshToken, profile, done) => {
      const email = (profile.emails && profile.emails[0].value) || null;
      const db = readDB();
      const u = db.usuarios.find(x=> x.email===email);
      if(!u) return done(null, false, {message:'Email not allowed'});
      if(!hasAnyRole(u.role, allowedRoles)) return done(null,false,{message:'Role not allowed'});
      u.last_login = new Date().toISOString();
      writeDB(db);
      return done(null, u);
    }));
  });
};
