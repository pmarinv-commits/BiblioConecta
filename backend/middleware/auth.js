const jwt = require('jsonwebtoken');
const { readDB } = require('../services/db_json');

function verifyToken(req,res,next){
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ','').trim();
  if(!token) return res.status(401).json({error:'No token'});
  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = decoded;
    return next();
  }catch(e){ return res.status(401).json({error:'Invalid token'}); }
}

function requireRole(role){
  return (req,res,next)=>{
    const db = readDB();
    const u = db.usuarios.find(x=> x.id === (req.user && req.user.id));
    if(!u) return res.status(403).json({error:'No user'});
    if(u.role !== role && !(Array.isArray(role) && role.includes(u.role))) return res.status(403).json({error:'Forbidden'});
    next();
  };
}

module.exports = { verifyToken, requireRole };
