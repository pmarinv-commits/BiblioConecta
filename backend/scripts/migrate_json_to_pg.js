// Placeholder script that shows how to migrate data from database.json to PostgreSQL using node-postgres.
// Run with: node scripts/migrate_json_to_pg.js (after setting DATABASE_URL env var)
const fs = require('fs');
const { Client } = require('pg');
const data = JSON.parse(fs.readFileSync(__dirname + '/../database.json','utf8'));
async function migrate(){
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to PG. This script will print sample INSERTs (manual run recommended).');
  console.log('Usuarios:', data.usuarios.length, 'Libros:', data.libros.length, 'Requests:', (data.requests||[]).length);
  // Implement actual inserts as needed.
  await client.end();
}
migrate().catch(e=>{ console.error(e); process.exit(1); });
