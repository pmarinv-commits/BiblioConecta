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

async function createPgRequest({
  book_id,
  requester_name,
  requester_email,
  requester_rut,
  requester_phone,
  requester_address,
  requester_id_photo,
  book_title,
  request_date = new Date(),
  status = 'pendiente',
  due_date = null
}) {
  const { rows } = await query(
    `INSERT INTO requests (book_id, requester_name, requester_email, requester_rut, requester_phone, requester_address, requester_id_photo, book_title, request_date, status, due_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      book_id,
      requester_name,
      requester_email,
      requester_rut,
      requester_phone,
      requester_address,
      requester_id_photo,
      book_title,
      request_date instanceof Date ? request_date.toISOString() : request_date,
      status,
      due_date
    ]
  );
  return mapPgRequest(rows[0]);
}

module.exports = {
  createPgRequest
};
