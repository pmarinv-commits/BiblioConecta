const express = require('express');
const router = express.Router();
const { readDB, saveDB } = require('../services/db_json');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken, requireRole('alumno'));

function normalizeCurso(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function cursoMatches(targetCurso, studentCurso) {
  if (!targetCurso || !studentCurso) return false;
  return normalizeCurso(targetCurso) === normalizeCurso(studentCurso);
}

function resolveEligibleBookIds(db, alumno) {
  const allowed = new Set();
  (db.listasLectura || []).forEach(lista => {
    if (cursoMatches(lista.curso, alumno.curso)) {
      (lista.libros || []).forEach(libro => {
        const id = Number(libro);
        if (!Number.isNaN(id)) allowed.add(id);
      });
    }
  });
  if (!allowed.size) {
    (db.libros || []).forEach(libro => {
      const id = Number(libro?.id);
      if (!Number.isNaN(id)) allowed.add(id);
    });
  }
  return allowed;
}

function buildNotifications(db, alumnoId, limit = 20) {
  return (db.notificaciones || [])
    .filter(notif => notif.alumnoId === alumnoId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map(notif => ({
      id: notif.id,
      mensaje: notif.message,
      fecha: notif.createdAt,
      read: !!notif.read,
      listId: notif.listId,
      curso: notif.curso
    }));
}

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

router.get('/dashboard', (req, res) => {
  const db = readDB();
  const alumno = db.usuarios.find(u => u.id === req.user.id);
  if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

  const assignedLists = (db.listasLectura || []).filter(lista => cursoMatches(lista.curso, alumno.curso));
  const librosMap = new Map(
    (db.libros || []).map(libro => {
      const id = Number(libro.id);
      return [
        id,
        {
          ...libro,
          id,
          portada: normalizeMediaPath(libro.portada),
          pdf: normalizeMediaPath(libro.pdf)
        }
      ];
    })
  );
  const progressEntries = (db.progresos || []).filter(p => p.alumnoId === alumno.id);
  const progressMap = new Map(progressEntries.map(p => [Number(p.libroId), p]));

  let listsPayload = assignedLists.map(lista => ({
    id: lista.id,
    nombre: lista.nombre,
    descripcion: lista.descripcion,
    curso: lista.curso,
    libros: (lista.libros || []).map(libroId => {
      const libro = librosMap.get(Number(libroId)) || {};
      const progreso = progressMap.get(Number(libroId));
      return {
        id: Number(libroId),
        titulo: libro.titulo || 'Libro asignado',
        autor: libro.autor || 'Autor no disponible',
        genero: libro.genero || 'General',
        progreso: progreso?.percentage ?? 0,
        paginas: libro.paginas || null,
        pdf: libro.pdf || '',
        portada: libro.portada || '',
        tipo: libro.tipo || 'digital',
        descripcion: libro.descripcion || ''
      };
    })
  }));

  if (!listsPayload.length) {
    const fallbackBooks = Array.from(librosMap.values())
      .map(libro => ({
        id: Number(libro.id),
        titulo: libro.titulo || 'Libro disponible',
        autor: libro.autor || 'Autor no especificado',
        genero: libro.genero || 'General',
        progreso: progressMap.get(Number(libro.id))?.percentage ?? 0,
        paginas: libro.paginas || null,
        pdf: libro.pdf || '',
        portada: libro.portada || '',
        tipo: libro.tipo || 'digital',
        descripcion: libro.descripcion || ''
      }))
      .filter(libro => !Number.isNaN(libro.id));
    if (fallbackBooks.length) {
      listsPayload = [{
        id: 'catalogo-digital',
        nombre: 'Catálogo digital',
        descripcion: 'Libros disponibles en la biblioteca digital.',
        curso: alumno.curso || 'General',
        libros: fallbackBooks
      }];
    }
  }

  const notifications = buildNotifications(db, alumno.id, 10);

  const subrayadosCount = (db.subrayados || []).filter(item => item.alumnoId === alumno.id).length;
  const stats = buildStats({ lists: listsPayload, progressMap, subrayadosCount });

  res.json({
    estudiante: { nombre: alumno.nombre, curso: alumno.curso },
    listas: listsPayload,
    notificaciones: notifications,
    stats
  });
});

router.post('/progress', (req, res) => {
  const { libroId, percentage, currentPage, totalPages } = req.body;
  if (!libroId) return res.status(400).json({ error: 'libroId es obligatorio' });
  const normalizedPercentage = typeof percentage === 'number' ? Math.max(0, Math.min(100, Math.round(percentage))) : 0;

  const db = readDB();
  const alumno = db.usuarios.find(u => u.id === req.user.id);
  if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

  db.progresos = db.progresos || [];
  const allowedBooks = resolveEligibleBookIds(db, alumno);
  const normalizedLibroId = Number(libroId);
  if (!allowedBooks.has(normalizedLibroId)) {
    return res.status(403).json({ error: 'Libro no asignado a este alumno' });
  }

  const existing = db.progresos.find(p => p.alumnoId === req.user.id && Number(p.libroId) === normalizedLibroId);
  if (existing) {
    existing.percentage = normalizedPercentage;
    existing.currentPage = currentPage || existing.currentPage || null;
    existing.totalPages = totalPages || existing.totalPages || null;
    existing.updatedAt = new Date().toISOString();
  } else {
    db.progresos.push({
      id: (db.progresos || []).length ? Math.max(...db.progresos.map(p => Number(p.id) || 0)) + 1 : 1,
      alumnoId: req.user.id,
      libroId: normalizedLibroId,
      percentage: normalizedPercentage,
      currentPage: currentPage || null,
      totalPages: totalPages || null,
      updatedAt: new Date().toISOString()
    });
  }
  saveDB(db);
  res.json({ ok: true });
});

router.get('/progress/:libroId', (req, res) => {
  const { libroId } = req.params;
  if (!libroId) return res.status(400).json({ error: 'libroId es obligatorio' });
  const normalizedLibroId = Number(libroId);
  if (Number.isNaN(normalizedLibroId)) {
    return res.status(400).json({ error: 'libroId inválido' });
  }

  const db = readDB();
  const alumno = db.usuarios.find(u => u.id === req.user.id);
  if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
  const allowedBooks = resolveEligibleBookIds(db, alumno);
  if (!allowedBooks.has(normalizedLibroId)) {
    return res.status(403).json({ error: 'Libro no asignado a este alumno' });
  }

  const progressEntries = db.progresos || [];
  const entry = progressEntries.find(p => p.alumnoId === req.user.id && Number(p.libroId) === normalizedLibroId);
  if (!entry) {
    return res.json({ currentPage: null, totalPages: null, percentage: 0 });
  }
  res.json({
    currentPage: entry.currentPage || null,
    totalPages: entry.totalPages || null,
    percentage: entry.percentage || 0,
    updatedAt: entry.updatedAt || null
  });
});

router.get('/notifications', (req, res) => {
  const db = readDB();
  res.json(buildNotifications(db, req.user.id, 50));
});

router.patch('/notifications/:id/read', (req, res) => {
  const db = readDB();
  const notif = (db.notificaciones || []).find(n => Number(n.id) === Number(req.params.id) && n.alumnoId === req.user.id);
  if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
  if (!notif.read) {
    notif.read = true;
    notif.readAt = new Date().toISOString();
    saveDB(db);
  }
  res.json({ ok: true });
});

router.post('/subrayados', (req, res) => {
  const { libroId, note, page } = req.body;
  if (!libroId || !note) {
    return res.status(400).json({ error: 'libroId y note son obligatorios' });
  }
  const db = readDB();
  const libroExiste = (db.libros || []).some(libro => Number(libro.id) === Number(libroId));
  if (!libroExiste) {
    return res.status(404).json({ error: 'Libro no encontrado' });
  }
  db.subrayados = db.subrayados || [];
  const id = db.subrayados.length ? Math.max(...db.subrayados.map(s => Number(s.id) || 0)) + 1 : 1;
  const subrayado = {
    id,
    alumnoId: req.user.id,
    libroId: Number(libroId),
    note: String(note).slice(0, 1000),
    page: page ? Number(page) : null,
    createdAt: new Date().toISOString()
  };
  db.subrayados.push(subrayado);
  saveDB(db);
  res.status(201).json({ ok: true, subrayado });
});

router.get('/subrayados', (req, res) => {
  const db = readDB();
  const entries = (db.subrayados || []).filter(item => item.alumnoId === req.user.id);
  res.json(entries);
});

module.exports = router;
