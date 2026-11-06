-- Migración 001: revocación de sesiones (usuarios.token_version).
-- Para bases ya creadas con una versión anterior de schema.sql.
-- Idempotente: si la columna ya existe, no hace nada. No borra datos.
-- Ejecutar sentencia por sentencia (ver README); no ejecutar contra bases remotas sin revisar.

SET @existe = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'token_version'
);
SET @sql = IF(
  @existe = 0,
  'ALTER TABLE usuarios ADD COLUMN token_version INT NOT NULL DEFAULT 1 AFTER reset_expira',
  'SELECT 1'
);
PREPARE sentencia FROM @sql;
EXECUTE sentencia;
DEALLOCATE PREPARE sentencia;
