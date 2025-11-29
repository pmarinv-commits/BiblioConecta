const { query } = require('./db_pg');

function mapPgLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    usuario: row.usuario,
    action: row.action,
    at: row.created_at ? new Date(row.created_at).toISOString() : null,
    libroId: row.libro_id || null,
    requestId: row.request_id || null
  };
}

async function appendLogEntry(entry = {}) {
  try {
    const { usuario, action, at = new Date(), libroId = null, requestId = null } = entry;
    await query(
      `INSERT INTO logs (usuario, action, created_at, libro_id, request_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [usuario, action, at instanceof Date ? at.toISOString() : at, libroId, requestId]
    );
  } catch (err) {
    console.error('[logs] No se pudo guardar el evento en PostgreSQL', err);
  }
}

async function getAllPgLogs() {
  const { rows } = await query('SELECT * FROM logs ORDER BY created_at DESC');
  return rows.map(mapPgLog);
}

module.exports = {
  appendLogEntry,
  getAllPgLogs
};
