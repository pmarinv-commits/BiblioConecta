const { readDB, saveDB } = require('./db_json');

function appendLogEntry(entry = {}) {
  try {
    const db = readDB();
    db.logs = db.logs || [];
    db.logs.push(entry);
    saveDB(db);
  } catch (err) {
    console.error('[logs] No se pudo guardar el evento en database.json', err);
  }
}

module.exports = {
  appendLogEntry
};
