const { query } = require('./db_pg');

function mapPgRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    book_id: row.book_id,
    requester_name: row.requester_name,
    requester_email: row.requester_email,
    requester_rut: row.requester_rut,
    requester_phone: row.requester_phone,
    requester_address: row.requester_address,
    requester_id_photo: row.requester_id_photo,
    book_title: row.book_title,
    request_date: row.request_date ? new Date(row.request_date).toISOString() : null,
    status: row.status,
    due_date: row.due_date,
    approved_at: row.approved_at,
    picked_at: row.picked_at,
    returned_at: row.returned_at,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

async function getAllPgRequests() {
  const { rows } = await query('SELECT * FROM requests ORDER BY id DESC');
  return rows.map(mapPgRequest);
}

async function updatePgRequest(id, { status, due_date }) {
  // Solo permite actualizar status, due_date y fechas relacionadas
  let now = new Date();
  let updateFields = ['status = $2', 'updated_at = $3'];
  let params = [id, status, now.toISOString()];
  let paramIdx = 4;
  if (due_date !== undefined) {
    updateFields.push('due_date = $' + paramIdx);
    params.push(due_date);
    paramIdx++;
  }
  // Manejo de fechas especiales según status
  let extraFields = [];
  if (status === 'aprobado') {
    extraFields.push('approved_at = $' + paramIdx);
    params.push(now.toISOString());
    paramIdx++;
  }
  if (status === 'recogido') {
    extraFields.push('picked_at = $' + paramIdx);
    params.push(now.toISOString());
    paramIdx++;
  }
  if (status === 'devuelto') {
    extraFields.push('returned_at = $' + paramIdx);
    params.push(now.toISOString());
    paramIdx++;
  }
  if (status === 'rechazado') {
    updateFields.push('due_date = NULL');
  }
  const setClause = [...updateFields, ...extraFields].join(', ');
  const { rows } = await query(
    `UPDATE requests SET ${setClause} WHERE id = $1 RETURNING *`,
    params
  );
  return mapPgRequest(rows[0]);
}

module.exports = {
  getAllPgRequests,
  updatePgRequest
};
