const { query } = require('./db_pg');

function mapPgNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    alumnoId: row.alumno_id,
    title: row.title,
    message: row.message,
    read: row.read,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  };
}

async function getPgNotifications(alumnoId, limit = 50) {
  const { rows } = await query(
    'SELECT * FROM notifications WHERE alumno_id = $1 ORDER BY created_at DESC LIMIT $2',
    [alumnoId, limit]
  );
  return rows.map(mapPgNotification);
}

async function markPgNotificationRead(id, alumnoId) {
  const { rows } = await query(
    'UPDATE notifications SET read = true, read_at = NOW() WHERE id = $1 AND alumno_id = $2 RETURNING *',
    [id, alumnoId]
  );
  return mapPgNotification(rows[0]);
}

async function createPgNotification({ alumnoId, title, message }) {
  const { rows } = await query(
    'INSERT INTO notifications (alumno_id, title, message, read, created_at) VALUES ($1, $2, $3, false, NOW()) RETURNING *',
    [alumnoId, title, message]
  );
  return mapPgNotification(rows[0]);
}

module.exports = {
  getPgNotifications,
  markPgNotificationRead,
  createPgNotification
};
