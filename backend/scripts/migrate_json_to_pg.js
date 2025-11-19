// Placeholder script that shows how to migrate data from database.json to PostgreSQL using node-postgres.
// Run with: node scripts/migrate_json_to_pg.js (after setting DATABASE_URL env var)
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { toRoleArray } = require('../services/roles');

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'database.json'), 'utf8')
);

const asTimestamp = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const asDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().substring(0, 10);
};

const ensureSchemaSQL = `
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre TEXT,
  rut TEXT UNIQUE,
  email TEXT UNIQUE,
  password TEXT,
  role TEXT[],
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS libros (
  id SERIAL PRIMARY KEY,
  titulo TEXT,
  autor TEXT,
  descripcion TEXT,
  genero TEXT,
  fecha_publicacion TEXT,
  portada TEXT,
  pdf TEXT,
  tipo TEXT,
  updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  book_id INTEGER REFERENCES libros(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT,
  requester_rut TEXT,
  requester_phone TEXT,
  requester_address TEXT,
  requester_id_photo TEXT,
  book_title TEXT,
  request_date TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'pendiente',
  due_date DATE,
  approved_at TIMESTAMP,
  picked_at TIMESTAMP,
  returned_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  usuario TEXT,
  action TEXT,
  libro_id INTEGER,
  request_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subrayados (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER,
  libro_id INTEGER,
  page INTEGER,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
`;

async function upsertUsuarios(client, usuarios = []) {
  if (!usuarios.length) return 0;
  await client.query('TRUNCATE TABLE usuarios RESTART IDENTITY CASCADE');
  for (const usuario of usuarios) {
    await client.query(
      `INSERT INTO usuarios (id, nombre, rut, email, password, role, last_login, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,NOW()))
       ON CONFLICT (id) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         rut = EXCLUDED.rut,
         email = EXCLUDED.email,
         password = EXCLUDED.password,
         role = EXCLUDED.role,
         last_login = EXCLUDED.last_login,
         created_at = LEAST(usuarios.created_at, EXCLUDED.created_at)` ,
      [
        usuario.id,
        usuario.nombre || null,
        usuario.rut || null,
        usuario.email || null,
        usuario.password || null,
        toRoleArray(usuario.role),
        asTimestamp(usuario.last_login),
        asTimestamp(usuario.created_at)
      ]
    );
  }
  return usuarios.length;
}

async function upsertLibros(client, libros = []) {
  if (!libros.length) return 0;
  await client.query('TRUNCATE TABLE libros RESTART IDENTITY CASCADE');
  for (const libro of libros) {
    await client.query(
      `INSERT INTO libros (id, titulo, autor, descripcion, genero, fecha_publicacion, portada, pdf, tipo, updated_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,NOW()))
       ON CONFLICT (id) DO UPDATE SET
         titulo = EXCLUDED.titulo,
         autor = EXCLUDED.autor,
         descripcion = EXCLUDED.descripcion,
         genero = EXCLUDED.genero,
         fecha_publicacion = EXCLUDED.fecha_publicacion,
         portada = EXCLUDED.portada,
         pdf = EXCLUDED.pdf,
         tipo = EXCLUDED.tipo,
         updated_at = EXCLUDED.updated_at,
         created_at = LEAST(libros.created_at, EXCLUDED.created_at)` ,
      [
        libro.id,
        libro.titulo || null,
        libro.autor || null,
        libro.descripcion || null,
        libro.genero || null,
        libro.fecha_publicacion || null,
        libro.portada || null,
        libro.pdf || null,
        libro.tipo || null,
        asTimestamp(libro.updated_at),
        asTimestamp(libro.created_at)
      ]
    );
  }
  return libros.length;
}

async function upsertRequests(client, requests = []) {
  if (!requests.length) {
    await client.query('TRUNCATE TABLE requests RESTART IDENTITY CASCADE');
    return 0;
  }
  await client.query('TRUNCATE TABLE requests RESTART IDENTITY CASCADE');
  for (const request of requests) {
    await client.query(
      `INSERT INTO requests (
        id, book_id, requester_name, requester_email, requester_rut,
        requester_phone, requester_address, requester_id_photo, book_title,
        request_date, status, due_date, approved_at, picked_at, returned_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         book_id = EXCLUDED.book_id,
         requester_name = EXCLUDED.requester_name,
         requester_email = EXCLUDED.requester_email,
         requester_rut = EXCLUDED.requester_rut,
         requester_phone = EXCLUDED.requester_phone,
         requester_address = EXCLUDED.requester_address,
         requester_id_photo = EXCLUDED.requester_id_photo,
         book_title = EXCLUDED.book_title,
         request_date = EXCLUDED.request_date,
         status = EXCLUDED.status,
         due_date = EXCLUDED.due_date,
         approved_at = EXCLUDED.approved_at,
         picked_at = EXCLUDED.picked_at,
         returned_at = EXCLUDED.returned_at,
         updated_at = EXCLUDED.updated_at` ,
      [
        request.id,
        request.book_id || request.bookId || null,
        request.requester_name || request.requesterName || request.nombre || 'Visitante',
        request.requester_email || request.requesterEmail || request.email || null,
        request.requester_rut || request.requesterRut || request.rut || null,
        request.requester_phone || request.requesterPhone || request.celular || null,
        request.requester_address || request.direccion || null,
        request.requester_id_photo || request.fotoId || null,
        request.book_title || request.bookTitle || null,
        asTimestamp(request.request_date),
        request.status || 'pendiente',
        asDate(request.due_date),
        asTimestamp(request.approved_at),
        asTimestamp(request.picked_at),
        asTimestamp(request.returned_at),
        asTimestamp(request.updated_at)
      ]
    );
  }
  return requests.length;
}

async function upsertLogs(client, logs = []) {
  await client.query('TRUNCATE TABLE logs RESTART IDENTITY CASCADE');
  if (!logs.length) return 0;
  for (const log of logs) {
    await client.query(
      `INSERT INTO logs (usuario, action, libro_id, request_id, created_at)
       VALUES ($1,$2,$3,$4,COALESCE($5,NOW()))` ,
      [
        log.usuario || null,
        log.action || null,
        log.libroId || log.libro_id || null,
        log.requestId || log.request_id || null,
        asTimestamp(log.at || log.created_at)
      ]
    );
  }
  return logs.length;
}

async function resetSequences(client) {
  const tables = ['usuarios', 'libros', 'requests', 'logs'];
  for (const table of tables) {
    const seq = `${table}_id_seq`;
    await client.query(
      `SELECT setval($1, COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)` ,
      [seq]
    ).catch(() => {});
  }
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definido. Configura backend/.env antes de migrar.');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('render.com')
      ? { rejectUnauthorized: false }
      : process.env.PGSSLMODE === 'require'
        ? { rejectUnauthorized: false }
        : undefined
  });
  await client.connect();
  console.log('Conectado a PostgreSQL. Iniciando migración...');

  try {
    await client.query('BEGIN');
    await client.query(ensureSchemaSQL);

    const userCount = await upsertUsuarios(client, data.usuarios || []);
    const bookCount = await upsertLibros(client, data.libros || []);
    const requestCount = await upsertRequests(client, data.requests || []);
    const logCount = await upsertLogs(client, data.logs || []);

    await resetSequences(client);
    await client.query('COMMIT');

    console.log('Migración finalizada ✅');
    console.log(`Usuarios: ${userCount}`);
    console.log(`Libros: ${bookCount}`);
    console.log(`Solicitudes: ${requestCount}`);
    console.log(`Logs: ${logCount}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch((e) => {
  console.error('Error durante la migración:', e.message);
  process.exit(1);
});
