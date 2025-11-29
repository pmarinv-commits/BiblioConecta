const { query } = require('./db_pg');

function mapPgHighlight(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    libroId: row.libro_id,
    page: row.page,
    color: row.color,
    rect: row.rect,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

async function createPgHighlight({ usuarioId, libroId, page, color, rect }) {
  const { rows } = await query(
    `INSERT INTO highlights (user_id, libro_id, page, color, rect, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [usuarioId, libroId, page, color, JSON.stringify(rect)]
  );
  return mapPgHighlight(rows[0]);
}

async function getPgHighlights({ usuarioId, libroId, page }) {
  let sql = 'SELECT * FROM highlights WHERE user_id = $1 AND libro_id = $2';
  const params = [usuarioId, libroId];
  if (page !== undefined) {
    sql += ' AND page = $3';
    params.push(page);
  }
  sql += ' ORDER BY id ASC';
  const { rows } = await query(sql, params);
  return rows.map(mapPgHighlight);
}

async function deletePgHighlight(id, usuarioId) {
  const { rows } = await query(
    'DELETE FROM highlights WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, usuarioId]
  );
  return mapPgHighlight(rows[0]);
}

module.exports = {
  createPgHighlight,
  getPgHighlights,
  deletePgHighlight
};
