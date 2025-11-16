const express = require('express');
const adminRouter = express.Router();
const { readDB, saveDB } = require('../services/db_json');
const { verifyToken, requireRole } = require('../middleware/auth');

adminRouter.use(verifyToken, requireRole('admin'));
adminRouter.get('/usuarios', (req,res)=>{
	const db = readDB();
	res.json(sanitizeUsers(db.usuarios || []));
});
adminRouter.get('/logs', (req,res)=>{ const db = readDB(); res.json(db.logs||[]); });
adminRouter.get('/requests', (req,res)=>{ const db = readDB(); res.json(db.requests||[]); });

adminRouter.get('/requests/overdue.csv', (req,res)=>{
	const db = readDB();
	const books = db.libros || [];
	const now = new Date();
	const overdue = (db.requests || []).filter(r => isOverdueRequest(r, now));
	const headers = ['titulo','nombre','telefono','fecha_solicitud','fecha_devolucion','estado'];
	const rows = overdue.map(r => [
		resolveBookTitle(books, r),
		(r.requester_name || r.nombre || '').trim(),
		r.requester_phone || r.celular || '',
		formatDateForCsv(r.request_date || r.creado),
		formatDateForCsv(r.due_date || r.devolucion),
		(r.status || r.estado || '').toLowerCase()
	]);
	const csv = [headers, ...rows].map(cols => cols.map(csvEscape).join(',')).join('\n');
	res.setHeader('Content-Type','text/csv; charset=utf-8');
	res.setHeader('Content-Disposition','attachment; filename="prestamos_vencidos.csv"');
	return res.send(csv);
});

adminRouter.put('/requests/:id', (req,res)=>{
	const { status, due_date } = req.body || {};
	const normalizedStatus = (status || '').toLowerCase();
	const allowed = ['pendiente','aprobado','recogido','devuelto','rechazado'];
	if(!allowed.includes(normalizedStatus)) return res.status(400).json({error:'Estado no soportado'});
	const db = readDB();
	db.requests = db.requests || [];
	const request = db.requests.find(r => String(r.id) === String(req.params.id));
	if(!request) return res.status(404).json({error:'Solicitud no encontrada'});
	const now = new Date().toISOString();
	if(normalizedStatus === 'aprobado'){
		if(!due_date) return res.status(400).json({error:'La fecha de devolución es obligatoria'});
		const parsedDueDate = new Date(due_date);
		if(Number.isNaN(parsedDueDate.getTime())) return res.status(400).json({error:'Fecha de devolución inválida'});
		request.due_date = parsedDueDate.toISOString().split('T')[0];
		request.approved_at = now;
	}
	if(normalizedStatus === 'recogido'){
		request.picked_at = now;
	}
	if(normalizedStatus === 'devuelto'){
		request.returned_at = now;
	}
	if(normalizedStatus === 'rechazado'){
		request.due_date = null;
	}
	request.status = normalizedStatus;
	request.updated_at = now;
	db.logs = db.logs || [];
	db.logs.push({usuario: req.user?.email || 'admin', action:`request_${normalizedStatus}`, at:now, requestId: request.id});
	saveDB(db);
	res.json({ok:true, request});
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
