const { query } = require('./db_pg');

function mapPgLibro(row) {
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    autor: row.autor,
    descripcion: row.descripcion,
    genero: row.genero,
    fecha_publicacion: row.fecha_publicacion,
    portada: row.portada,
    pdf: row.pdf,
    tipo: row.tipo,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

async function getAllPgLibros() {
  const { rows } = await query('SELECT * FROM libros ORDER BY id ASC');
  return rows.map(mapPgLibro);
}

async function createPgLibro({ titulo, autor, descripcion, genero, fecha_publicacion, portada, pdf, tipo = 'digital', updated_at = new Date() }) {
  const { rows } = await query(
    `INSERT INTO libros (titulo, autor, descripcion, genero, fecha_publicacion, portada, pdf, tipo, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      titulo,
      autor,
      descripcion,
      genero,
      fecha_publicacion,
      portada,
      pdf,
      tipo,
      updated_at instanceof Date ? updated_at.toISOString() : updated_at
    ]
  );
  return mapPgLibro(rows[0]);
}

async function updatePgLibro(id, { titulo, autor, descripcion, genero, fecha_publicacion, portada, pdf, tipo = 'digital', updated_at = new Date() }) {
  const { rows } = await query(
    `UPDATE libros SET
      titulo = COALESCE($2, titulo),
      autor = COALESCE($3, autor),
      descripcion = COALESCE($4, descripcion),
      genero = COALESCE($5, genero),
      fecha_publicacion = COALESCE($6, fecha_publicacion),
      portada = COALESCE($7, portada),
      pdf = COALESCE($8, pdf),
      tipo = COALESCE($9, tipo),
      updated_at = $10
     WHERE id = $1
     RETURNING *`,
    [
      id,
      titulo,
      autor,
      descripcion,
      genero,
      fecha_publicacion,
      portada,
      pdf,
      tipo,
      updated_at instanceof Date ? updated_at.toISOString() : updated_at
    ]
  );
  return mapPgLibro(rows[0]);
}

async function deletePgLibro(id) {
  const { rows } = await query(
    'DELETE FROM libros WHERE id = $1 RETURNING *',
    [id]
  );
  return mapPgLibro(rows[0]);
}

async function getPgLibroById(id) {
  const { rows } = await query('SELECT * FROM libros WHERE id = $1 LIMIT 1', [id]);
  return mapPgLibro(rows[0]);
}

module.exports = {
  getAllPgLibros,
  createPgLibro,
  updatePgLibro,
  deletePgLibro,
  getPgLibroById
};
