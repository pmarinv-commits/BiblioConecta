# Copilot Instructions for Biblioconecta

## Architecture in one glance
- `backend/server.js` is a single Express app that also serves the static `frontend/` pages; no bundler or SSR is involved.
- Persistence defaults to the JSON document `backend/database.json` via `services/db_json.js`; every route mutates that file synchronously, so keep writes small and always reuse `readDB/saveDB` helpers.
- The PostgreSQL migration path is manual: see `backend/scripts/migrate_json_to_pg.js` for the expected shape when porting data or wiring Render.

## Core workflows
- Local dev: `cd backend`, `npm install`, `cp .env.example .env`, `npm run dev`; the server hosts both API routes (`/api/**`) and the static catalog/login pages.
- File uploads (book covers, PDFs) land under `backend/uploads/` and are exposed via `/uploads/*`; keep paths relative when saving metadata in `db.libros`.
- Use `npm run migrate-json-to-pg` only after setting `DATABASE_URL`; it currently just connects and prints counts—extend it instead of reinventing migrations.

## Backend conventions
- Add endpoints inside `backend/routes/` and mount them in `server.js`; keep the route modules thin and rely on shared helpers for persistence/logging.
- Authentication is JWT-based for alumnos (`/api/auth/login`) and Google OAuth for admins via `services/passport.js`; every successful login appends an entry to `db.logs`.
- Physical book requests live in `db.requests` and flow through `routes/requests.js`; the status lifecycle is `pendiente → aceptado → entregado`, so reuse those strings when extending features.
- Highlights/PDF delivery are handled by `routes/pdf.js`; PDFs are served from disk, so validate file existence (`fs.existsSync`) before responding.

## Frontend conventions
- Pages like `frontend/index.html`, `catalogo.html`, and `request_form.html` are vanilla HTML + inline JS; no framework build step exists, so include new scripts/styles directly.
- `frontend/public/styles.css` stores the landing theme, while individual pages may declare additional `<style>` blocks—avoid breaking existing selectors relied upon by other pages.
- UI interactions talk to the API with `fetch`, store auth tokens in `localStorage`, and navigate using hard-coded `.html` files (see `frontend/src/ui.js`).

## Data contracts & integration points
- `db.libros` items minimally include `{id, titulo, autor, descripcion, genero, fecha_publicacion, portada, pdf, tipo}`; new consumers should tolerate missing optional fields because legacy data might omit them.
- User records created via `/api/users` default the password to the RUT and set `role` to `alumno | admin`; mirror that when seeding data.
- When extending catalog filters, prefer client-side search first (as in `catalogo.html`) and only hit new endpoints when filtering depends on backend state.

## Testing & safety checks
- There is no automated test suite; manual QA involves loading `http://localhost:3000/` plus `/catalogo.html` and exercising the API through the browser/DevTools.
- Because persistence is a flat JSON file, always back up `backend/database.json` before running destructive scripts or bulk updates.
- Keep an eye on session secrets (`SESSION_SECRET`, `JWT_SECRET`, Google credentials) when sharing `.env`—the app expects them but falls back to dev defaults.
