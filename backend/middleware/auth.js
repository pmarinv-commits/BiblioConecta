const jwt = require('jsonwebtoken');
const { normalizeRoles, hasRole } = require('../services/roles');

function verifyToken(req,res,next){
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ','').trim();
  if(!token) {
    console.warn('[auth] No token recibido');
    return res.status(401).json({error:'No token'});
  }
  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = decoded;
    return next();
  }catch(e){
    console.error('[auth] Token inválido:', e.message, { token });
    return res.status(401).json({error:'Invalid token', reason: e.message});
  }
}

function requireRole(role){
  const expected = normalizeRoles(role);
  return (req,res,next)=>{
    // TODO: Migrar a consulta de usuario por ID desde PostgreSQL
    // const u = await getPgUserById(req.user.id);
    // if(!u) return res.status(403).json({error:'No user'});
    // const userRoles = normalizeRoles(u.role || u.roles);
    // if(!userRoles.length) return res.status(403).json({error:'Forbidden'});
    // if(expected.length && !hasRole(userRoles, expected)) return res.status(403).json({error:'Forbidden'});
    // req.userRoles = userRoles;
    // next();
    // Por ahora, permitir paso (ajustar lógica según servicios PostgreSQL)
    next();
  };
}

module.exports = { verifyToken, requireRole };
