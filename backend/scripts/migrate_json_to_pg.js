#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

const BACKEND_DIR = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(BACKEND_DIR, '.env') });

const DATA_PATH = path.join(BACKEND_DIR, 'database.json');
const DEFAULT_ROLE = ['alumno'];

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not defined. Please set it in backend/.env');
  process.exit(1);
}

function loadJsonDatabase() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`database.json not found at ${DATA_PATH}`);
  }
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

function normalizeRoles(roleField) {
  if (!roleField || (Array.isArray(roleField) && roleField.length === 0)) {
    return DEFAULT_ROLE;
  }
  if (Array.isArray(roleField)) {
    return roleField;
  }
  if (typeof roleField === 'string' && roleField.trim().length > 0) {
    return roleField.split(',').map(r => r.trim()).filter(Boolean);
  }
  return DEFAULT_ROLE;
}

async function ensureUsersTable(client) {
  const createSQL = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre TEXT,
      rut TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT[] DEFAULT ARRAY['alumno'],
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT now()
    );
  `;
  await client.query(createSQL);
}

async function ensureLibrosTable(client) {
  const createSQL = `
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
      updated_at TIMESTAMP
    );
  `;
  await client.query(createSQL);
}

async function ensureProgresosTable(client) {
  const createSQL = `
    CREATE TABLE IF NOT EXISTS progresos (
      id SERIAL PRIMARY KEY,
      alumnoId INTEGER,
      libroId INTEGER,
      percentage INTEGER,
      currentPage INTEGER,
      totalPages INTEGER,
      updatedAt TIMESTAMP
    );
  `;
  await client.query(createSQL);
}

async function ensureRequestsTable(client) {
  const createSQL = `
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      book_id INTEGER,
      requester_name TEXT,
      requester_email TEXT,
      requester_rut TEXT,
      requester_phone TEXT,
      requester_address TEXT,
      requester_id_photo TEXT,
      book_title TEXT,
      request_date TIMESTAMP,
      status TEXT,
      due_date TEXT,
      approved_at TIMESTAMP,
      updated_at TIMESTAMP,
      picked_at TIMESTAMP,
      returned_at TIMESTAMP
    );
  `;
  await client.query(createSQL);
}

async function syncUsers(client, usuarios) {
  if (!Array.isArray(usuarios)) {
    console.warn('No se encontró un arreglo "usuarios" en database.json. Nada que sincronizar.');
    return { inserted: 0, updated: 0 };
  }

  const upsertSQL = `
    INSERT INTO usuarios (id, nombre, rut, email, password, role, last_login)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE
    SET
      nombre = EXCLUDED.nombre,
      rut = EXCLUDED.rut,
      email = EXCLUDED.email,
      password = EXCLUDED.password,
      role = EXCLUDED.role,
      last_login = COALESCE(EXCLUDED.last_login, usuarios.last_login)
    RETURNING (xmax = 0) AS inserted;
  `;

  let inserted = 0;
  let updated = 0;

  for (const usuario of usuarios) {
    const roles = normalizeRoles(usuario.role);
    const values = [
      usuario.id,
      usuario.nombre,
      usuario.rut,
      usuario.email,
      usuario.password,
      roles,
      usuario.last_login ? new Date(usuario.last_login) : null
    ];

    const { rows } = await client.query(upsertSQL, values);
    if (rows[0]?.inserted) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  await client.query(`
    SELECT setval(
      pg_get_serial_sequence('usuarios', 'id'),
      (SELECT COALESCE(MAX(id), 1) FROM usuarios)
    );
  `);

  return { inserted, updated };
}

async function main() {
  const db = loadJsonDatabase();
  const usuarios = db.usuarios || [];
  const libros = db.libros || [];
  const progresos = db.progresos || [];
  const requests = db.requests || [];

  const useSSL = process.env.DATABASE_SSL !== 'false';
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false
  });

  console.log(`Conectando a PostgreSQL (${process.env.DATABASE_URL})...`);
  await client.connect();
  try {
    await client.query('BEGIN');
    await ensureUsersTable(client);
    await ensureLibrosTable(client);
    await ensureProgresosTable(client);
    await ensureRequestsTable(client);
    const resultUsuarios = await syncUsers(client, usuarios);
    const resultLibros = await syncLibros(client, libros);
    const resultProgresos = await syncProgresos(client, progresos);
    const resultRequests = await syncRequests(client, requests);
    await client.query('COMMIT');
    console.log(`Usuarios: ${resultUsuarios.inserted} insertados, ${resultUsuarios.updated} actualizados.`);
    console.log(`Libros: ${resultLibros.inserted} insertados, ${resultLibros.updated} actualizados.`);
    console.log(`Progresos: ${resultProgresos.inserted} insertados, ${resultProgresos.updated} actualizados.`);
    console.log(`Requests: ${resultRequests.inserted} insertados, ${resultRequests.updated} actualizados.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la sincronización:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
// Sincronización de libros
async function syncLibros(client, libros) {
  if (!Array.isArray(libros)) return { inserted: 0, updated: 0 };
  const upsertSQL = `
    INSERT INTO libros (id, titulo, autor, descripcion, genero, fecha_publicacion, portada, pdf, tipo, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (id) DO UPDATE SET
      titulo=EXCLUDED.titulo,
      autor=EXCLUDED.autor,
      descripcion=EXCLUDED.descripcion,
      genero=EXCLUDED.genero,
      fecha_publicacion=EXCLUDED.fecha_publicacion,
      portada=EXCLUDED.portada,
      pdf=EXCLUDED.pdf,
      tipo=EXCLUDED.tipo,
      updated_at=EXCLUDED.updated_at
    RETURNING (xmax = 0) AS inserted;
  `;
  let inserted = 0, updated = 0;
  for (const libro of libros) {
    const values = [
      libro.id,
      libro.titulo,
      libro.autor,
      libro.descripcion,
      libro.genero,
      libro.fecha_publicacion,
      libro.portada,
      libro.pdf,
      libro.tipo,
      libro.updated_at ? new Date(libro.updated_at) : null
    ];
    const { rows } = await client.query(upsertSQL, values);
    if (rows[0]?.inserted) inserted++; else updated++;
  }
  await client.query(`SELECT setval(pg_get_serial_sequence('libros', 'id'), (SELECT COALESCE(MAX(id), 1) FROM libros));`);
  return { inserted, updated };
}

// Sincronización de progresos
async function syncProgresos(client, progresos) {
  if (!Array.isArray(progresos)) return { inserted: 0, updated: 0 };
  const upsertSQL = `
    INSERT INTO progresos (id, alumnoId, libroId, percentage, currentPage, totalPages, updatedAt)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (id) DO UPDATE SET
      alumnoId=EXCLUDED.alumnoId,
      libroId=EXCLUDED.libroId,
      percentage=EXCLUDED.percentage,
      currentPage=EXCLUDED.currentPage,
      totalPages=EXCLUDED.totalPages,
      updatedAt=EXCLUDED.updatedAt
    RETURNING (xmax = 0) AS inserted;
  `;
  let inserted = 0, updated = 0;
  for (const prog of progresos) {
    const values = [
      prog.id,
      prog.alumnoId,
      prog.libroId,
      prog.percentage,
      prog.currentPage,
      prog.totalPages,
      prog.updatedAt ? new Date(prog.updatedAt) : null
    ];
    const { rows } = await client.query(upsertSQL, values);
    if (rows[0]?.inserted) inserted++; else updated++;
  }
  await client.query(`SELECT setval(pg_get_serial_sequence('progresos', 'id'), (SELECT COALESCE(MAX(id), 1) FROM progresos));`);
  return { inserted, updated };
}

// Sincronización de requests (solicitudes físicas)
async function syncRequests(client, requests) {
  if (!Array.isArray(requests)) return { inserted: 0, updated: 0 };
  const upsertSQL = `
    INSERT INTO requests (id, book_id, requester_name, requester_email, requester_rut, requester_phone, requester_address, requester_id_photo, book_title, request_date, status, due_date, approved_at, updated_at, picked_at, returned_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (id) DO UPDATE SET
      book_id=EXCLUDED.book_id,
      requester_name=EXCLUDED.requester_name,
      requester_email=EXCLUDED.requester_email,
      requester_rut=EXCLUDED.requester_rut,
      requester_phone=EXCLUDED.requester_phone,
      requester_address=EXCLUDED.requester_address,
      requester_id_photo=EXCLUDED.requester_id_photo,
      book_title=EXCLUDED.book_title,
      request_date=EXCLUDED.request_date,
      status=EXCLUDED.status,
      due_date=EXCLUDED.due_date,
      approved_at=EXCLUDED.approved_at,
      updated_at=EXCLUDED.updated_at,
      picked_at=EXCLUDED.picked_at,
      returned_at=EXCLUDED.returned_at
    RETURNING (xmax = 0) AS inserted;
  `;
  let inserted = 0, updated = 0;
  for (const req of requests) {
    const values = [
      req.id,
      req.book_id,
      req.requester_name,
      req.requester_email,
      req.requester_rut,
      req.requester_phone,
      req.requester_address,
      req.requester_id_photo,
      req.book_title,
      req.request_date ? new Date(req.request_date) : null,
      req.status,
      req.due_date,
      req.approved_at ? new Date(req.approved_at) : null,
      req.updated_at ? new Date(req.updated_at) : null,
      req.picked_at ? new Date(req.picked_at) : null,
      req.returned_at ? new Date(req.returned_at) : null
    ];
    const { rows } = await client.query(upsertSQL, values);
    if (rows[0]?.inserted) inserted++; else updated++;
  }
  await client.query(`SELECT setval(pg_get_serial_sequence('requests', 'id'), (SELECT COALESCE(MAX(id), 1) FROM requests));`);
  return { inserted, updated };
}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
