-- Convierte la columna role a TEXT[] y asegura que los administradores reciban roles duales.

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

ALTER TABLE usuarios
ALTER COLUMN role TYPE TEXT[]
USING CASE
  WHEN role IS NULL THEN ARRAY['alumno']
  WHEN role::text LIKE '%,%'
    THEN string_to_array(role::text, ',')
  ELSE ARRAY[role]
END;

INSERT INTO usuarios (nombre, rut, email, password, role, last_login, created_at)
VALUES
  ('Gonzalo Garrido', 'ggarridot', 'ggarridot@alumnos.ceduc.cl', 'ggarridot', ARRAY['admin','alumno'], NULL, NOW()),
  ('Natalia Castañeda', 'ncastanedac', 'ncastanedac@alumnos.ceduc.cl', 'ncastanedac', ARRAY['admin','alumno'], NULL, NOW()),
  ('Yire Inostroza', 'Yinostrozag', 'Yinostrozag@alumnos.ceduc.cl', 'Yinostrozag', ARRAY['admin','alumno'], NULL, NOW()),
  ('Pablo Vidal', 'pvidals', 'pvidals@alumnos.ceduc.cl', 'pvidals', ARRAY['admin','alumno'], NULL, NOW()),
  ('Gabriel Bueno', 'gbuenov', 'gbuenov@alumnos.ceduc.cl', 'gbuenov', ARRAY['admin','alumno'], NULL, NOW())
ON CONFLICT (email)
DO UPDATE SET
  nombre = EXCLUDED.nombre,
  rut = EXCLUDED.rut,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  last_login = COALESCE(usuarios.last_login, EXCLUDED.last_login);

UPDATE usuarios
SET role = ARRAY['admin','alumno']
WHERE email IN (
    'ggarridot@alumnos.ceduc.cl',
    'ncastanedac@alumnos.ceduc.cl',
    'Yinostrozag@alumnos.ceduc.cl',
    'pvidals@alumnos.ceduc.cl',
    'btolozaa@alumnos.ceduc.cl',
    'pmarinv@alumnos.ceduc.cl',
    'gbuenov@alumnos.ceduc.cl'
);
