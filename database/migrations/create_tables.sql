-- PostgreSQL schema (same as JSON structure)
CREATE TABLE usuarios (id SERIAL PRIMARY KEY, nombre TEXT, rut TEXT UNIQUE, email TEXT UNIQUE, password TEXT, role TEXT, created_at TIMESTAMP DEFAULT now());
CREATE TABLE libros (id SERIAL PRIMARY KEY, titulo TEXT, autor TEXT, descripcion TEXT, genero TEXT, fecha_publicacion DATE, portada TEXT, pdf TEXT, tipo TEXT, created_at TIMESTAMP DEFAULT now());
CREATE TABLE requests (
	id SERIAL PRIMARY KEY,
	book_id INTEGER REFERENCES libros(id),
	requester_name TEXT NOT NULL,
	requester_email TEXT NOT NULL,
	request_date TIMESTAMP DEFAULT now(),
	status TEXT DEFAULT 'pendiente',
	due_date DATE
);
CREATE TABLE logs (id SERIAL PRIMARY KEY, usuario TEXT, action TEXT, created_at TIMESTAMP DEFAULT now());
CREATE TABLE subrayados (id SERIAL PRIMARY KEY, usuario_id INTEGER, libro_id INTEGER, page INTEGER, content TEXT, created_at TIMESTAMP DEFAULT now());
