const express = require('express');
const router = express.Router();
const { readDB, saveDB } = require('../services/db_json');
const { verifyToken, requireRole } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

const DIGITAL_ROLES = ['alumno', 'profesor'];

function ensureHighlightStore(db) {
  if (!Array.isArray(db.subrayados)) db.subrayados = [];
  return db.subrayados;
}

function nextHighlightId(store) {
  if (!store.length) return 1;
  return Math.max(...store.map(item => Number(item.id) || 0)) + 1;
}

router.get('/file/:libroId', verifyToken, requireRole(DIGITAL_ROLES), (req,res)=>{
  const db = readDB();
  const b = db.libros.find(x=> x.id==req.params.libroId);
  if(!b) return res.status(404).send('no encontrado');
  const relative = b.pdf ? b.pdf.replace(/^\/+/, '') : '';
  const p = relative ? path.join(__dirname,'..', relative) : null;
  if(!p || !fs.existsSync(p)) return res.status(404).send('pdf no disponible');
  res.sendFile(p);
});

router.post('/highlights', verifyToken, requireRole(DIGITAL_ROLES), (req, res) => {
  const { libroId, page, x, y, width, height, color } = req.body;
  const normalizedLibroId = Number(libroId);
  const normalizedPage = Number(page);
  if (Number.isNaN(normalizedLibroId) || Number.isNaN(normalizedPage)) {
    return res.status(400).json({ error: 'libroId y page son obligatorios' });
  }
  const clamp = (value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return 0;
    return Math.min(1, Math.max(0, numeric));
  };
  const normalizedRect = {
    x: clamp(x),
    y: clamp(y),
    width: clamp(width),
    height: clamp(height)
  };
  if (normalizedRect.width < 0.001 || normalizedRect.height < 0.001) {
    return res.status(400).json({ error: 'El subrayado es demasiado pequeño' });
  }

  const db = readDB();
  const store = ensureHighlightStore(db);
  const highlight = {
    id: nextHighlightId(store),
    usuarioId: req.user.id,
    libroId: normalizedLibroId,
    page: normalizedPage,
    color: color || '#ffeb3b',
    rect: normalizedRect,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.push(highlight);
  saveDB(db);
  res.status(201).json({ ok: true, highlight });
});

router.get('/highlights', verifyToken, requireRole(DIGITAL_ROLES), (req, res) => {
  const { libroId, page } = req.query;
  const normalizedLibroId = Number(libroId);
  if (Number.isNaN(normalizedLibroId)) {
    return res.status(400).json({ error: 'libroId es obligatorio' });
  }
  const db = readDB();
  const store = ensureHighlightStore(db);
  const response = store.filter(item => {
    if (item.usuarioId !== req.user.id) return false;
    if (Number(item.libroId) !== normalizedLibroId) return false;
    if (page) {
      return Number(item.page) === Number(page);
    }
    return true;
  });
  res.json(response);
});

router.delete('/highlights/:id', verifyToken, requireRole(DIGITAL_ROLES), (req, res) => {
  const highlightId = Number(req.params.id);
  if (Number.isNaN(highlightId)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  const db = readDB();
  const store = ensureHighlightStore(db);
  const index = store.findIndex(item => Number(item.id) === highlightId && item.usuarioId === req.user.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Subrayado no encontrado' });
  }
  const [deleted] = store.splice(index, 1);
  saveDB(db);
  res.json({ ok: true, highlight: deleted });
});

module.exports = router;
