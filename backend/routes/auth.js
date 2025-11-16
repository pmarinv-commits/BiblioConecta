const express = require('express');
const router = express.Router();
const { readDB, saveDB } = require('../services/db_json');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { hashPassword, comparePassword } = require('../services/passwords');

function issueToken(user) {
  return jwt.sign({id:user.id, role:user.role, email:user.email}, process.env.JWT_SECRET || 'devsecret',{expiresIn:'8h'});
}

router.post('/login', async (req,res)=>{
  try {
    const {email, password} = req.body;
    if(!email || !password){
      return res.status(400).json({error:'Email y contraseña son obligatorios'});
    }
    const db = readDB();
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = db.usuarios.find(u => (u.email || '').toLowerCase() === normalizedEmail);
    if(!user){
      return res.status(401).json({error:'Usuario no encontrado'});
    }
    if(user.role === 'admin'){
      return res.status(403).json({error:'Usa el acceso de administrador'});
    }
    const validPassword = await comparePassword(password, user.password);
    if(!validPassword){
      return res.status(401).json({error:'Contraseña incorrecta'});
    }
    const token = issueToken(user);
    db.logs = db.logs || [];
    db.logs.push({usuario:user.email, action:'login', at:new Date().toISOString()});
    saveDB(db);
    res.json({token, user:{id:user.id, email:user.email, nombre:user.nombre, role:user.role}});
  } catch (error) {
    console.error('Error en login alumno', error);
    res.status(500).json({error:'No se pudo iniciar sesión'});
  }
});

router.post('/reset', async (req,res)=>{
  try {
    const {email,newPassword} = req.body;
    if(!email || !newPassword){
      return res.status(400).json({error:'Email y nueva contraseña son obligatorios'});
    }
    const db = readDB();
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = db.usuarios.find(x=> (x.email || '').toLowerCase() === normalizedEmail && x.role !== 'admin');
    if(!user) return res.status(404).json({error:'Usuario no encontrado'});
    user.password = await hashPassword(newPassword);
    saveDB(db);
    res.json({ok:true});
  } catch (error) {
    console.error('Error al resetear contraseña', error);
    res.status(500).json({error:'No se pudo restablecer la contraseña'});
  }
});

router.get('/google', (req,res,next)=>{
  passport.authenticate('google-student', { scope: ['profile','email'], prompt: 'select_account' })(req,res,next);
});

router.get('/google/callback', passport.authenticate('google-student', { failureRedirect: '/catalogo.html?auth=fail' }), (req,res)=>{
  const token = issueToken(req.user);
  res.redirect(`/catalogo.html?token=${encodeURIComponent(token)}`);
});

module.exports = router;
