const express = require('express');
const router = express.Router();
const { readDB, saveDB } = require('../services/db_json');
const { hashPassword } = require('../services/passwords');
const { verifyToken, requireRole } = require('../middleware/auth');
const { toRoleArray } = require('../services/roles');

router.use(verifyToken, requireRole('admin'));

// create user (admin panel)
router.post('/', async (req,res)=>{
  try {
    const db = readDB();
    db.logs = db.logs || [];
    const { nombre, rut, email, role, roles, password, curso } = req.body;
    const allowedRoles = ['alumno', 'admin'];
    const rolePayload = roles ?? role;
    const normalizedRoles = toRoleArray(rolePayload);
    if(!nombre || !email || !normalizedRoles.length) {
      return res.status(400).json({error:'nombre, email y role son obligatorios'});
    }
    const invalidRole = normalizedRoles.find(r => !allowedRoles.includes(r));
    if(invalidRole) {
      return res.status(400).json({error:`role inválido: ${invalidRole}`});
    }
    if(normalizedRoles.includes('alumno') && !curso) {
      return res.status(400).json({error:'El curso es obligatorio para alumnos'});
    }
    const fallbackPassword = password || rut;
    if(!fallbackPassword) {
      return res.status(400).json({error:'Debes definir una contraseña o un RUT'});
    }
    const id = db.usuarios.length? Math.max(...db.usuarios.map(u=>u.id))+1:1;
    const usuario = {
      id,
      nombre,
      rut: rut || null,
      email,
      role: normalizedRoles,
      curso: curso || null,
      password: await hashPassword(fallbackPassword)
    };
    db.usuarios.push(usuario);
    db.logs.push({usuario:email||rut, action:'usuario_creado', at:new Date().toISOString()});
    saveDB(db);
    res.json({ok:true, usuario: sanitizeUser(usuario)});
  } catch (error) {
    console.error('Error creando usuario', error);
    res.status(500).json({error:'No se pudo crear el usuario'});
  }
});

// get all users
router.get('/', (req,res)=>{
  const db = readDB();
  const usuarios = (db.usuarios || []).map(sanitizeUser);
  res.json(usuarios);
});

function sanitizeUser(user = {}){
  const { password, ...rest } = user;
  return rest;
}

module.exports = router;
