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
    const result = await syncUsers(client, usuarios);
    await client.query('COMMIT');
    console.log(`Sincronización exitosa: ${result.inserted} insertados, ${result.updated} actualizados.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la sincronización:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
