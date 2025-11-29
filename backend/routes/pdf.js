const express = require('express');
const router = express.Router();
const { createPgHighlight, getPgHighlights, deletePgHighlight } = require('../services/highlights');
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


// Endpoint para servir el PDF de un libro desde PostgreSQL
const { getPgLibroById } = require('../services/libros');

router.get('/file/:libroId', verifyToken, requireRole(DIGITAL_ROLES), async (req, res) => {
  try {
    const libroId = Number(req.params.libroId);
    if (Number.isNaN(libroId)) {
      return res.status(400).json({ error: 'ID de libro inválido' });
    }
    const libro = await getPgLibroById(libroId);
    if (!libro || !libro.pdf) {
      return res.status(404).json({ error: 'PDF no encontrado para este libro' });
    }
    // Solo permitir rutas relativas bajo /uploads
    let pdfPath = libro.pdf;
    if (pdfPath.startsWith('/')) pdfPath = pdfPath.slice(1);
    const absPath = path.join(__dirname, '..', pdfPath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Archivo PDF no existe en el servidor' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(absPath);
  } catch (error) {
    console.error('[pdf] Error al servir PDF:', error);
    res.status(500).json({ error: 'No se pudo servir el PDF' });
  }
});

router.post('/highlights', verifyToken, requireRole(DIGITAL_ROLES), async (req, res) => {
  try {
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
    const highlight = await createPgHighlight({
      usuarioId: req.user.id,
      libroId: normalizedLibroId,
      page: normalizedPage,
      color: color || '#ffeb3b',
      rect: normalizedRect
    });
    res.status(201).json({ ok: true, highlight });
  } catch (error) {
    console.error('[highlights] Error al crear subrayado en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo crear el subrayado' });
  }
});

router.get('/highlights', verifyToken, requireRole(DIGITAL_ROLES), async (req, res) => {
  try {
    const { libroId, page } = req.query;
    const normalizedLibroId = Number(libroId);
    if (Number.isNaN(normalizedLibroId)) {
      return res.status(400).json({ error: 'libroId es obligatorio' });
    }
    const highlights = await getPgHighlights({
      usuarioId: req.user.id,
      libroId: normalizedLibroId,
      page: page !== undefined ? Number(page) : undefined
    });
    res.json(highlights);
  } catch (error) {
    console.error('[highlights] Error al obtener subrayados de PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudieron obtener los subrayados' });
  }
});

router.delete('/highlights/:id', verifyToken, requireRole(DIGITAL_ROLES), async (req, res) => {
  try {
    const highlightId = Number(req.params.id);
    if (Number.isNaN(highlightId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const deleted = await deletePgHighlight(highlightId, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Subrayado no encontrado' });
    }
    res.json({ ok: true, highlight: deleted });
  } catch (error) {
    console.error('[highlights] Error al eliminar subrayado en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo eliminar el subrayado' });
  }
});

module.exports = router;
