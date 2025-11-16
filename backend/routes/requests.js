const express = require('express');
const router = express.Router();
const { readDB, saveDB } = require('../services/db_json');
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

router.post('/', (req, res) => {
  const db = readDB();
  db.requests = db.requests || [];
  db.logs = db.logs || [];
  const id = nextId(db.requests);
  const now = new Date().toISOString();
  const normalized = normalizeRequestPayload(req.body || {});
  const request = {
    id,
    ...normalized,
    request_date: now,
    status: 'pendiente',
    due_date: null
  };
  db.requests.push(request);
  db.logs.push({ usuario: request.requester_email || request.requester_rut || 'visitante', action: 'request_created', at: now, requestId: id });
  saveDB(db);
  res.json({ ok: true, request });
});

router.get('/', adminGuard, (req, res) => {
  const db = readDB();
  res.json(db.requests || []);
});

router.get('/overdue/list', adminGuard, (req, res) => {
  const db = readDB();
  const now = new Date();
  const overdue = (db.requests || []).filter(r => {
    if (!r.due_date) return false;
    if ((r.status || '').toLowerCase() !== 'recogido') return false;
    return new Date(r.due_date) < now;
  });
  res.json(overdue);
});

module.exports = router;
