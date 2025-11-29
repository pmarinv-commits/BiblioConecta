const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');

const adminGuard = [verifyToken, requireRole('admin')];

function nextId(collection = []) {
  if (!collection.length) return 1;
  return Math.max(...collection.map(item => Number(item.id) || 0)) + 1;
}

function normalizeRequestPayload(body = {}) {
  const {
    libroId,
    bookId,
    book_id,
    nombre,
    apellido,
    requesterName,
    requesterEmail,
    requesterRut,
    requesterPhone,
    rut,
    celular,
    direccion,
    fotoId,
    requester_address,
    requester_id_photo
  } = body;

  const composedName = requesterName || [nombre, apellido].filter(Boolean).join(' ').trim();
  return {
    book_id: Number(bookId || libroId || book_id) || null,
    requester_name: composedName || nombre || 'Visitante',
    requester_email: requesterEmail || body.email || '',
    requester_rut: requesterRut || rut || '',
    requester_phone: requesterPhone || celular || '',
    requester_address: direccion || requester_address || '',
    requester_id_photo: fotoId || requester_id_photo || '',
    book_title: body.bookTitle || null
  };
}

const { createPgRequest } = require('../services/requests');

router.post('/', async (req, res) => {
  try {
    const now = new Date();
    const normalized = normalizeRequestPayload(req.body || {});
    const request = await createPgRequest({
      ...normalized,
      request_date: now,
      status: 'pendiente',
      due_date: null
    });
    res.json({ ok: true, request });
  } catch (error) {
    console.error('[requests] Error al crear solicitud en PostgreSQL:', error);
    res.status(500).json({ error: 'No se pudo crear la solicitud' });
  }
});

// Eliminado endpoint legacy de requests basado en JSON

// TODO: Migrar lógica de overdue/list a PostgreSQL
// return res.status(501).json({ error: 'No implementado: migrar overdue/list a PostgreSQL' });

module.exports = router;
