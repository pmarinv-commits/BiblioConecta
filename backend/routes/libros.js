const express = require('express');
const router = express.Router();
const { getAllPgLibros, createPgLibro } = require('../services/libros');
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


// Eliminado: const { getAllPgLibros } = require('../services/libros');
async function collectReferencedFiles() {
  const libros = await getAllPgLibros();
  const refs = new Set();
  (libros || []).forEach(libro => {
    if (libro.portada) refs.add(path.basename(libro.portada));
    if (libro.pdf) refs.add(path.basename(libro.pdf));
  });
  return refs;
}

async function cleanupOrphanFiles() {
  try {
    const referenced = await collectReferencedFiles();
    const filesOnDisk = fs.readdirSync(uploadDir);
    filesOnDisk.forEach(file => {
      if (!referenced.has(file)) {
        fs.unlink(path.join(uploadDir, file), () => {});
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

router.get('/', async (req, res) => {
  try {
    let libros = await getAllPgLibros();
    const tipo = req.query.tipo;
    if (tipo) libros = libros.filter(b => b.tipo === tipo);
    res.json(libros);
  } catch (error) {
    console.error('[libros] Error al obtener libros de PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudieron obtener los libros' });
  }
});

const { getPgLibroById } = require('../services/libros');

router.get('/:id', async (req, res) => {
  try {
    const libro = await getPgLibroById(req.params.id);
    if (!libro) return res.status(404).json({ error: 'No encontrado' });
    res.json(libro);
  } catch (error) {
    console.error('[libros] Error al obtener libro por id en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo obtener el libro' });
  }
});

router.post('/', verifyToken, requireRole('admin'), upload.fields([{name:'portada'},{name:'pdf'}]), async (req, res) => {
  try {
    const body = req.body || {};
    const portada = req.files && req.files.portada ? '/uploads/' + req.files.portada[0].filename : '';
    const pdf = req.files && req.files.pdf ? '/uploads/' + req.files.pdf[0].filename : '';
    const libro = await createPgLibro({
      titulo: body.titulo,
      autor: body.autor,
      descripcion: body.descripcion,
      genero: body.genero,
      fecha_publicacion: body.fecha_publicacion,
      portada,
      pdf,
      tipo: body.tipo || 'digital',
      updated_at: new Date()
    });
    // Aquí podrías agregar un log en PostgreSQL si tienes tabla de logs
    setImmediate(cleanupOrphanFiles);
    res.json({ ok: true, libro });
  } catch (error) {
    console.error('[libros] Error al crear libro en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo crear el libro' });
  }
});

const { updatePgLibro } = require('../services/libros');

router.put('/:id', verifyToken, requireRole('admin'), upload.fields([{name:'portada'},{name:'pdf'}]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const body = req.body || {};
    let portada, pdf;
    if (req.files && req.files.portada) {
      portada = '/uploads/' + req.files.portada[0].filename;
    }
    if (req.files && req.files.pdf) {
      pdf = '/uploads/' + req.files.pdf[0].filename;
    }
    const libro = await updatePgLibro(id, {
      titulo: body.titulo,
      autor: body.autor,
      descripcion: body.descripcion,
      genero: body.genero,
      fecha_publicacion: body.fecha_publicacion,
      portada,
      pdf,
      tipo: body.tipo,
      updated_at: new Date()
    });
    if (!libro) return res.status(404).json({ error: 'No encontrado' });
    setImmediate(cleanupOrphanFiles);
    res.json({ ok: true, libro });
  } catch (error) {
    console.error('[libros] Error al actualizar libro en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo actualizar el libro' });
  }
});

const { deletePgLibro } = require('../services/libros');

router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const removed = await deletePgLibro(id);
    if (!removed) return res.status(404).json({ error: 'No encontrado' });
    deleteStoredFile(removed?.portada);
    deleteStoredFile(removed?.pdf);
    setImmediate(cleanupOrphanFiles);
    res.json({ ok: true });
  } catch (error) {
    console.error('[libros] Error al eliminar libro en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo eliminar el libro' });
  }
});

module.exports = router;
