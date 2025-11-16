const express = require('express');
const router = express.Router();
const { readDB, saveDB } = require('../services/db_json');
const { verifyToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uploadDir = path.join(__dirname,'..','uploads');
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

function generateSafeFilename(originalName = '') {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(8).toString('hex');
  const normalized = path.basename(originalName || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const extension = path.extname(normalized) || '';
  return `${timestamp}-${randomHex}${extension}`;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/png','image/jpeg','image/jpg','image/webp']);
const ALLOWED_PDF_TYPES = new Set(['application/pdf']);

function fileFilter(req, file, cb) {
  const field = file.fieldname;
  const mimetype = file.mimetype || '';
  const isImage = field === 'portada';
  const isPdf = field === 'pdf';
  if (isImage && ALLOWED_IMAGE_TYPES.has(mimetype)) return cb(null, true);
  if (isPdf && ALLOWED_PDF_TYPES.has(mimetype)) return cb(null, true);
  const error = new Error('Tipo de archivo no permitido');
  error.status = 400;
  return cb(error);
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req,file,cb)=> cb(null, generateSafeFilename(file.originalname))
});
const upload = multer({storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 }});

function collectReferencedFiles() {
  const db = readDB();
  const refs = new Set();
  (db.libros || []).forEach(libro => {
    if (libro.portada) refs.add(path.basename(libro.portada));
    if (libro.pdf) refs.add(path.basename(libro.pdf));
  });
  return refs;
}

function cleanupOrphanFiles(){
  try {
    const referenced = collectReferencedFiles();
    const filesOnDisk = fs.readdirSync(uploadDir);
    filesOnDisk.forEach(file => {
      if (!referenced.has(file)) {
        fs.unlink(path.join(uploadDir, file), ()=>{});
      }
    });
  } catch (error) {
    console.warn('No se pudo limpiar uploads', error.message);
  }
}

function resolveStoredPath(storedPath = '') {
  if (!storedPath) return null;
  const normalized = storedPath.replace(/^\/+/, '');
  return path.join(__dirname, '..', normalized);
}

function deleteStoredFile(storedPath) {
  const absolute = resolveStoredPath(storedPath);
  if (absolute && absolute.startsWith(path.join(__dirname, '..')) && fs.existsSync(absolute)) {
    try {
      fs.unlinkSync(absolute);
    } catch (error) {
      console.warn('No se pudo eliminar el archivo', absolute, error.message);
    }
  }
}

router.get('/', (req,res)=>{
  const db = readDB();
  const tipo = req.query.tipo;
  let libros = db.libros || [];
  if(tipo) libros = libros.filter(b=> b.tipo === tipo);
  res.json(libros);
});

router.get('/:id', (req,res)=>{
  const db = readDB();
  const b = db.libros.find(x=> x.id==req.params.id);
  if(!b) return res.status(404).json({error:'No encontrado'});
  res.json(b);
});

router.post('/', verifyToken, requireRole('admin'), upload.fields([{name:'portada'},{name:'pdf'}]), (req,res)=>{
  const db = readDB();
  db.libros = db.libros || [];
  db.logs = db.logs || [];
  const body = req.body || {};
  const id = db.libros.length? Math.max(...db.libros.map(x=>Number(x.id)||0))+1:1;
  const portada = req.files && req.files.portada ? '/uploads/'+req.files.portada[0].filename : '';
  const pdf = req.files && req.files.pdf ? '/uploads/'+req.files.pdf[0].filename : '';
  const libro = {
    id,
    titulo: body.titulo,
    autor: body.autor,
    descripcion: body.descripcion,
    genero: body.genero,
    fecha_publicacion: body.fecha_publicacion,
    portada,
    pdf,
    tipo: body.tipo || 'digital'
  };
  db.libros.push(libro);
  db.logs.push({usuario:'admin', action:'libro_creado', at:new Date().toISOString(), libroId:id});
  saveDB(db);
  setImmediate(cleanupOrphanFiles);
  res.json({ok:true, libro});
});

router.put('/:id', verifyToken, requireRole('admin'), upload.fields([{name:'portada'},{name:'pdf'}]), (req,res)=>{
  const db = readDB();
  db.libros = db.libros || [];
  db.logs = db.logs || [];
  const libro = db.libros.find(x=> Number(x.id) === Number(req.params.id));
  if(!libro) return res.status(404).json({error:'No encontrado'});
  const body = req.body || {};
  ['titulo','autor','descripcion','genero','fecha_publicacion','tipo'].forEach(field => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      libro[field] = body[field];
    }
  });
  if (req.files && req.files.portada) {
    deleteStoredFile(libro.portada);
    libro.portada = '/uploads/'+req.files.portada[0].filename;
  }
  if (req.files && req.files.pdf) {
    deleteStoredFile(libro.pdf);
    libro.pdf = '/uploads/'+req.files.pdf[0].filename;
  }
  libro.updated_at = new Date().toISOString();
  db.logs.push({usuario:'admin', action:'libro_actualizado', at:new Date().toISOString(), libroId:libro.id});
  saveDB(db);
  setImmediate(cleanupOrphanFiles);
  res.json({ok:true, libro});
});

router.delete('/:id', verifyToken, requireRole('admin'), (req,res)=>{
  const db = readDB();
  db.libros = db.libros || [];
  db.logs = db.logs || [];
  const idx = db.libros.findIndex(x=> Number(x.id) === Number(req.params.id));
  if(idx === -1) return res.status(404).json({error:'No encontrado'});
  const removed = db.libros.splice(idx,1)[0];
  deleteStoredFile(removed?.portada);
  deleteStoredFile(removed?.pdf);
  db.logs.push({usuario:'admin', action:'libro_eliminado', at:new Date().toISOString(), libroId:removed.id});
  saveDB(db);
  setImmediate(cleanupOrphanFiles);
  res.json({ok:true});
});

module.exports = router;
