const { query } = require('./db_pg');

function mapPgProgress(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    libroId: row.libro_id,
    percentage: row.percentage,
    currentPage: row.current_page,
    totalPages: row.total_pages,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

async function upsertPgProgress({ alumnoId, libroId, percentage, currentPage, totalPages }) {
  const { rows } = await query(
    `INSERT INTO progress (user_id, libro_id, page, percentage, total_pages, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, libro_id)
     DO UPDATE SET page = $3, percentage = $4, total_pages = $5, updated_at = NOW()
     RETURNING *`,
    [alumnoId, libroId, currentPage, percentage, totalPages]
  );
  return mapPgProgress(rows[0]);
}

async function getPgProgress(alumnoId, libroId) {
  const { rows } = await query(
    'SELECT * FROM progress WHERE user_id = $1 AND libro_id = $2 LIMIT 1',
    [alumnoId, libroId]
  );
  return mapPgProgress(rows[0]);
}

module.exports = {
  upsertPgProgress,
  getPgProgress
};
