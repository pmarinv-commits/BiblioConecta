const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname,'../database.json');
const defaultShape = {
	usuarios: [],
	libros: [],
	requests: [],
	logs: [],
	subrayados: [],
	listasLectura: [],
	notificaciones: [],
	progresos: []
};
if(!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(defaultShape,null,2));

function ensureShape(db){
	return { ...defaultShape, ...db };
}

function readDB(){ return ensureShape(JSON.parse(fs.readFileSync(DB_FILE,'utf8'))); }
function saveDB(obj){ fs.writeFileSync(DB_FILE, JSON.stringify({...defaultShape, ...obj},null,2)); }

module.exports = { readDB, saveDB, DB_FILE };
