const { createPgRequest, getAllPgRequests, updatePgRequest } = require('../services/admin_requests');
const express = require('express');
const adminRouter = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');

adminRouter.use(verifyToken, requireRole('admin'));

// POST /api/admin/requests - registrar préstamo físico manualmente (solo admin, PostgreSQL)
adminRouter.post('/requests', async (req, res) => {
	const { book_id, nombre, rut, telefono, email, due_date, status } = req.body || {};
	if (!book_id || !nombre || !rut || !telefono || !due_date) {
		return res.status(400).json({ error: 'Faltan campos obligatorios' });
	}
	try {
		const newRequest = await createPgRequest({
			book_id,
			requester_name: nombre,
			requester_rut: rut,
			requester_phone: telefono,
			requester_email: email || null,
			due_date,
			status: status || 'recogido',
			request_date: new Date(),
		});
		res.status(201).json({ ok: true, request: newRequest });
	} catch (error) {
		console.error('[admin] Error al registrar préstamo físico en PostgreSQL:', error);
		res.status(500).json({ error: 'No se pudo registrar el préstamo físico' });
	}
});
// Eliminado endpoint legacy de usuarios basado en JSON
const { getAllPgLogs } = require('../services/logs');
adminRouter.get('/logs', async (req, res) => {
	try {
		const logs = await getAllPgLogs();
		res.json(logs);
	} catch (error) {
		console.error('[admin] Error al obtener logs de PostgreSQL:', error);
		res.status(500).json({ error: 'No se pudieron obtener los logs' });
	}
});


adminRouter.get('/requests', async (req, res) => {
	try {
		const requests = await getAllPgRequests();
		res.json(requests);
	} catch (error) {
		console.error('[admin] Error al obtener solicitudes de PostgreSQL:', error);
		res.status(500).json({ error: 'No se pudieron obtener las solicitudes' });
	}
});

adminRouter.get('/requests/overdue.csv', async (req, res) => {
	try {
		const { getAllPgRequests } = require('../services/admin_requests');
		const { getAllPgLibros } = require('../services/libros');
		const books = await getAllPgLibros();
		const now = new Date();
		const requests = await getAllPgRequests();
		const overdue = requests.filter(r => {
			if (!r.due_date) return false;
			if ((r.status || '').toLowerCase() !== 'recogido') return false;
			return new Date(r.due_date) < now;
		});
		const headers = ['titulo','nombre','telefono','fecha_solicitud','fecha_devolucion','estado'];
		const rows = overdue.map(r => [
			resolveBookTitle(books, r),
			(r.requester_name || '').trim(),
			r.requester_phone || '',
			formatDateForCsv(r.request_date),
			formatDateForCsv(r.due_date),
			(r.status || '').toLowerCase()
		]);
		const csv = [headers, ...rows].map(cols => cols.map(csvEscape).join(',')).join('\n');
		res.setHeader('Content-Type','text/csv; charset=utf-8');
		res.setHeader('Content-Disposition','attachment; filename="prestamos_vencidos.csv"');
		return res.send(csv);
	} catch (error) {
		console.error('[admin] Error al exportar CSV de vencidos desde PostgreSQL:', error);
		res.status(500).send('No se pudo exportar el CSV');
	}
});

adminRouter.put('/requests/:id', async (req, res) => {
	const { status, due_date } = req.body || {};
	const normalizedStatus = (status || '').toLowerCase();
	const allowed = ['pendiente','aprobado','recogido','devuelto','rechazado'];
	if(!allowed.includes(normalizedStatus)) return res.status(400).json({error:'Estado no soportado'});
	try {
		// Validaciones de fechas
		if(normalizedStatus === 'aprobado'){
			if(!due_date) return res.status(400).json({error:'La fecha de devolución es obligatoria'});
			const parsedDueDate = new Date(due_date);
			if(Number.isNaN(parsedDueDate.getTime())) return res.status(400).json({error:'Fecha de devolución inválida'});
		}
		const request = await updatePgRequest(req.params.id, { status: normalizedStatus, due_date });
		if(!request) return res.status(404).json({error:'Solicitud no encontrada'});
		res.json({ok:true, request});
	} catch (error) {
		console.error('[admin] Error al actualizar solicitud en PostgreSQL:', error);
		res.status(500).json({ error: 'No se pudo actualizar la solicitud' });
	}
});

	function resolveBookTitle(books = [], request = {}){
		const bookId = Number(request.book_id || request.libroId || request.bookId);
		if(bookId){
			const match = books.find(b => Number(b.id) === bookId);
			if(match && match.titulo) return match.titulo;
		}
		return request.book_title || `Libro #${request.book_id || request.libroId || 's/n'}`;
	}

	function isOverdueRequest(request = {}, referenceDate = new Date()){
		const status = (request.status || request.estado || '').toLowerCase();
		if(status !== 'recogido') return false;
		if(!request.due_date && !request.devolucion) return false;
		const due = new Date(request.due_date || request.devolucion);
		if(Number.isNaN(due.getTime())) return false;
		const deadline = new Date(due);
		deadline.setHours(23,59,59,999);
		return deadline < referenceDate;
	}

	function formatDateForCsv(value){
		if(!value) return '';
		const date = new Date(value);
		if(Number.isNaN(date.getTime())) return value;
		return date.toISOString().split('T')[0];
	}

	function csvEscape(value = ''){
		const str = String(value ?? '');
		if(str.includes('"') || str.includes(',') || str.includes('\n')){
			return '"' + str.replace(/"/g,'""') + '"';
		}
		return str;
		}

	function sanitizeUsers(list = []){
		return list.map(user => {
			const { password, ...rest } = user || {};
			return rest;
		});
	}

	module.exports = { adminRouter };
