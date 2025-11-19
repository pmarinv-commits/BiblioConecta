const jwt = require('jsonwebtoken');
const { readDB } = require('../services/db_json');
const { toRoleArray, hasAnyRole } = require('../services/roles');

function verifyToken(req,res,next){
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ','').trim();
  if(!token) return res.status(401).json({error:'No token'});
  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = decoded;
    const decodedRoles = decoded.roles || decoded.role;
    const roles = toRoleArray(decodedRoles);
    if (roles.length) {
      req.user.roles = roles;
      req.user.role = roles[0];
    }
    return next();
  }catch(e){ return res.status(401).json({error:'Invalid token'}); }
}

function requireRole(role){
  return (req,res,next)=>{
    const db = readDB();
    const u = db.usuarios.find(x=> x.id === (req.user && req.user.id));
    if(!u) return res.status(403).json({error:'No user'});
    if(!hasAnyRole(u.role, role)) return res.status(403).json({error:'Forbidden'});
    const roles = toRoleArray(u.role);
    req.user = req.user || {};
    req.user.roles = roles;
    req.user.role = roles[0] || req.user.role;
    next();
  };
}

module.exports = { verifyToken, requireRole };
