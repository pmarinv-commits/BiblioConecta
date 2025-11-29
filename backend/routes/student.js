
const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { createPgHighlight, getPgHighlights } = require('../services/highlights');


const { getAllPgLibros } = require('../services/libros');

router.use(verifyToken, requireRole('alumno'));


// Guardar subrayado
router.post('/subrayados', async (req, res) => {
  try {
    const { libroId, note, page, color, rect } = req.body;
    if (!libroId) {
      return res.status(400).json({ error: 'libroId es obligatorio' });
    }
    const highlight = await createPgHighlight({
      usuarioId: req.user.id,
      libroId: Number(libroId),
      page: page ? Number(page) : null,
      color: color || '#ffeb3b',
      rect: rect || null,
      note: note || null
    });
    res.status(201).json(highlight);
  } catch (error) {
    console.error('[student] Error al crear subrayado en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo crear el subrayado' });
  }
});

// Consultar subrayados de un libro
router.get('/subrayados', async (req, res) => {
  try {
    const { libroId } = req.query;
    if (!libroId) return res.status(400).json({ error: 'libroId es obligatorio' });
    const highlights = await getPgHighlights(req.user.id, Number(libroId));
    res.json(highlights);
  } catch (error) {
    console.error('[student] Error al obtener subrayados de PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudieron obtener los subrayados' });
  }
});

// Dashboard provisional
router.get('/dashboard', async (req, res) => {
  try {
    const libros = await getAllPgLibros();
    res.json({
      estudiante: { nombre: req.user.nombre || 'Alumno', curso: req.user.curso || '' },
      listas: [{
        id: 'catalogo',
        nombre: 'Catálogo digital',
        descripcion: 'Libros disponibles en la biblioteca digital.',
        curso: req.user.curso || 'General',
        libros: libros.map(libro => ({
          id: libro.id,
          titulo: libro.titulo,
          autor: libro.autor,
          genero: libro.genero,
          progreso: 0,
          paginas: libro.paginas || null,
          pdf: libro.pdf || '',
          portada: libro.portada || '',
          tipo: libro.tipo || 'digital',
          descripcion: libro.descripcion || ''
        }))
      }],
      stats: { listasAsignadas: 1, lecturasActivas: libros.length, librosPorLeer: libros.length, librosLeidos: 0, subrayados: 0 }
    });
  } catch (error) {
    console.error('[student] Error en dashboard provisional:', error);
    res.status(500).json({ error: 'No se pudo cargar el dashboard' });
  }
});

// Progreso
router.post('/progress', async (req, res) => {
  try {
    const { libroId, percentage, currentPage, totalPages } = req.body;
    if (!libroId) return res.status(400).json({ error: 'libroId es obligatorio' });
    const normalizedPercentage = typeof percentage === 'number' ? Math.max(0, Math.min(100, Math.round(percentage))) : 0;
    await upsertPgProgress({
      alumnoId: req.user.id,
      libroId: Number(libroId),
      percentage: normalizedPercentage,
      currentPage: currentPage || null,
      totalPages: totalPages || null
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('[student] Error al guardar progreso en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo guardar el progreso' });
  }
});

router.get('/progress/:libroId', async (req, res) => {
  try {
    const { libroId } = req.params;
    if (!libroId) return res.status(400).json({ error: 'libroId es obligatorio' });
    const normalizedLibroId = Number(libroId);
    if (Number.isNaN(normalizedLibroId)) {
      return res.status(400).json({ error: 'libroId inválido' });
    }
    const entry = await getPgProgress(req.user.id, normalizedLibroId);
    if (!entry) {
      return res.json({ currentPage: null, totalPages: null, percentage: 0 });
    }
    res.json({
      currentPage: entry.currentPage || null,
      totalPages: entry.totalPages || null,
      percentage: entry.percentage || 0,
      updatedAt: entry.updatedAt || null
    });
  } catch (error) {
    console.error('[student] Error al obtener progreso de PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo obtener el progreso' });
  }
});

// Notificaciones
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await getPgNotifications(req.user.id, 50);
    res.json(notifications);
  } catch (error) {
    console.error('[student] Error al obtener notificaciones de PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudieron obtener las notificaciones' });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const notif = await markPgNotificationRead(req.params.id, req.user.id);
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ ok: true });
  } catch (error) {
    console.error('[student] Error al marcar notificación como leída en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo actualizar la notificación' });
  }
});


// Utilidades (si se usan en otros archivos, exportar explícitamente)
function buildStats({ lists, progressMap, subrayadosCount }) {
  const uniqueBooks = new Set();
  lists.forEach(lista => {
    (lista.libros || []).forEach(libro => uniqueBooks.add(libro.id));
  });
  let librosLeidos = 0;
  uniqueBooks.forEach(id => {
    const record = progressMap.get(id);
    if (record && record.percentage >= 100) librosLeidos += 1;
  });
  const librosPorLeer = Math.max(uniqueBooks.size - librosLeidos, 0);
  return {
    listasAsignadas: lists.length,
    lecturasActivas: uniqueBooks.size,
    librosPorLeer,
    librosLeidos,
    subrayados: subrayadosCount
  };
}

function normalizeMediaPath(value = '') {
  if (!value) return '';
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/') || trimmed.startsWith('http') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  return `/${trimmed.replace(/^\/+/, '')}`;
}

module.exports = router;




function buildStats({ lists, progressMap, subrayadosCount }) {
  const uniqueBooks = new Set();
  lists.forEach(lista => {
    (lista.libros || []).forEach(libro => uniqueBooks.add(libro.id));
  });
  let librosLeidos = 0;
  uniqueBooks.forEach(id => {
    const record = progressMap.get(id);
    if (record && record.percentage >= 100) librosLeidos += 1;
  });
  const librosPorLeer = Math.max(uniqueBooks.size - librosLeidos, 0);
  return {
    listasAsignadas: lists.length,
    lecturasActivas: uniqueBooks.size,
    librosPorLeer,
    librosLeidos,
    subrayados: subrayadosCount
  };
}

function normalizeMediaPath(value = '') {
  if (!value) return '';
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/') || trimmed.startsWith('http') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  return `/${trimmed.replace(/^\/+/, '')}`;
}

// TODO: Migrar lógica de dashboard a PostgreSQL (usuarios, listasLectura, libros)
// Endpoint dashboard pendiente de migración

const { upsertPgProgress, getPgProgress } = require('../services/progress');

router.post('/progress', async (req, res) => {
  try {
    const { libroId, percentage, currentPage, totalPages } = req.body;
    if (!libroId) return res.status(400).json({ error: 'libroId es obligatorio' });
    const normalizedPercentage = typeof percentage === 'number' ? Math.max(0, Math.min(100, Math.round(percentage))) : 0;
    // Aquí podrías validar si el libro está asignado al alumno si es necesario
    await upsertPgProgress({
      alumnoId: req.user.id,
      libroId: Number(libroId),
      percentage: normalizedPercentage,
      currentPage: currentPage || null,
      totalPages: totalPages || null
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('[student] Error al guardar progreso en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo guardar el progreso' });
  }
});

router.get('/progress/:libroId', async (req, res) => {
  try {
    const { libroId } = req.params;
    if (!libroId) return res.status(400).json({ error: 'libroId es obligatorio' });
    const normalizedLibroId = Number(libroId);
    if (Number.isNaN(normalizedLibroId)) {
      return res.status(400).json({ error: 'libroId inválido' });
    }
    const entry = await getPgProgress(req.user.id, normalizedLibroId);
    if (!entry) {
      return res.json({ currentPage: null, totalPages: null, percentage: 0 });
    }
    res.json({
      currentPage: entry.currentPage || null,
      totalPages: entry.totalPages || null,
      percentage: entry.percentage || 0,
      updatedAt: entry.updatedAt || null
    });
  } catch (error) {
    console.error('[student] Error al obtener progreso de PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo obtener el progreso' });
  }
});

const { getPgNotifications, markPgNotificationRead } = require('../services/notifications');

router.get('/notifications', async (req, res) => {
  try {
    const notifications = await getPgNotifications(req.user.id, 50);
    res.json(notifications);
  } catch (error) {
    console.error('[student] Error al obtener notificaciones de PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudieron obtener las notificaciones' });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const notif = await markPgNotificationRead(req.params.id, req.user.id);
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ ok: true });
  } catch (error) {
    console.error('[student] Error al marcar notificación como leída en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo actualizar la notificación' });
  }
});

module.exports = router;

