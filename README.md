    # Biblio Migrated Full

This project is a full migration from a PHP-based website to a Node.js backend + HTML/CSS/Vanilla JS frontend.

## What I migrated for you
- All PHP logic translated into JS (server-side controllers) following the same behaviors: auth, requests, book CRUD, PDF serving, highlights.
- Frontend visual recreated to follow the original video design: left sidebar auth, main catalog, modals, admin panel.
- Local development uses `backend/database.json` (JSON storage). You will be able to migrate to PostgreSQL in Render; a migration script template is included.

## How to run locally
1. cd backend
2. npm install
3. cp .env.example .env and set variables
4. npm run dev
5. Open http://localhost:3001

## Notes
- Google OAuth flow requires proper GOOGLE_CLIENT_ID and SECRET and correct redirect URIs in Google Cloud Console.
- For production, replace JSON storage with PostgreSQL and enable HTTPS, secure cookies, and proper CORS restrictions.
- Acceso institucional para alumnos ahora se valida con correo + contraseña via `/api/auth/login`; el RUT quedó reservado únicamente para visitantes que levantan solicitudes físicas.

## Admin login split

## Solicitudes de libros físicos
- `frontend/catalogo.html`: muestra el botón **Solicitar en físico** para cada libro y abre un modal embebido con el formulario.
- `frontend/src/ui.js`: controla el modal, envía los datos a `/api/requests` y expone `window.catalogRequestUI` que reutiliza el catálogo.
- `backend/routes/requests.js`: crea registros `{book_id, requester_name, requester_email, requester_rut, requester_phone, status, due_date}` en la colección/tabla `requests` con estado inicial `pendiente` (la fecha de devolución queda en `null` hasta que biblioteca apruebe).
- `backend/routes/admin.js`: expone `/api/admin/requests` (GET y PUT) y `/api/admin/requests/overdue.csv` para que el equipo admin descargue los préstamos vencidos.
- `frontend/admin_panel.html`: consume las nuevas rutas, ahora gestiona pestañas separadas (pendientes, aprobadas, historial), obliga a definir `due_date` al aprobar, permite filtrar “pendientes por entregar”, exportar vencidos a CSV y marca en rojo los préstamos `recogido` vencidos.
- `database/migrations/create_tables.sql`: define la tabla `requests` con las columnas solicitadas (`id, book_id, requester_name, requester_email, request_date, status, due_date`).

### Security checklist
- Define `SESSION_SECRET`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` in `.env` before running.
- Keep admin accounts flagged with `role: "admin"`; other roles cannot reuse the admin login nor OAuth.
- Revoke stolen tokens by rotating `JWT_SECRET` and clearing browser storage via `/admin/login`.

