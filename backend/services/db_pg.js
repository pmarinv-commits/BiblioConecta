const { Pool } = require('pg');

let pool;

function buildPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada; no es posible conectar a PostgreSQL.');
  }
  const useSsl = process.env.DATABASE_SSL !== 'false';
  pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });
  pool.on('error', (err) => {
    console.error('[pg] error en la conexión del pool', err);
  });
  return pool;
}

function getPool() {
  return buildPool();
}

async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}

module.exports = {
  getPool,
  query
};
