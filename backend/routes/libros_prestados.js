const express = require('express');
const router = express.Router();
const { query } = require('../services/db_pg');

// Ruta pública: Libros físicos actualmente prestados
router.get('/activos', async (req, res) => {
  try {
    // Solo prestamos activos (aprobado o recogido, no devuelto ni rechazado)
    const { rows } = await query(
      `SELECT book_id, due_date FROM requests WHERE (status = 'aprobado' OR status = 'recogido') AND status NOT IN ('devuelto','rechazado')`
    );
    // Agrupar por book_id, tomar el due_date más reciente si hay varios
    const prestamos = {};
    for (const row of rows) {
      const id = String(row.book_id);
      if (!prestamos[id] || (row.due_date && row.due_date > prestamos[id].due_date)) {
        prestamos[id] = { book_id: row.book_id, due_date: row.due_date };
      }
    }
    res.json(Object.values(prestamos));
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron obtener los préstamos activos' });
  }
});

module.exports = router;
