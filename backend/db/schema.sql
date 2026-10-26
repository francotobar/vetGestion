CREATE DATABASE IF NOT EXISTS vetgestion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vetgestion;

CREATE TABLE usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rol ENUM('admin','cliente') NOT NULL DEFAULT 'cliente',
  documento VARCHAR(20) NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  apellido VARCHAR(60) NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  email VARCHAR(120) NULL,
  password_hash VARCHAR(100) NULL,
  estado_cuenta ENUM('sin_cuenta','con_cuenta','inactiva') NOT NULL DEFAULT 'sin_cuenta',
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado TINYINT(1) NOT NULL DEFAULT 0,
  consentimiento_at DATETIME NULL,
  reset_token_hash CHAR(64) NULL,
  reset_expira DATETIME NULL,
  creado_por INT UNSIGNED NULL,
  modificado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modificado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_documento (documento),
  UNIQUE KEY uq_usuarios_email (email),            -- MySQL permite múltiples NULL
  CONSTRAINT fk_usr_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id),
  CONSTRAINT fk_usr_modificado FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE mascotas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  especie ENUM('perro','gato') NOT NULL,
  raza VARCHAR(60) NOT NULL,
  sexo ENUM('macho','hembra') NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  peso_kg DECIMAL(5,2) NULL,
  esterilizado TINYINT(1) NOT NULL DEFAULT 0,
  microchip VARCHAR(30) NULL,
  alergias_condiciones TEXT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  creado_por INT UNSIGNED NULL,
  modificado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modificado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_mascotas_usuario (usuario_id),
  CONSTRAINT fk_masc_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_masc_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id),
  CONSTRAINT fk_masc_modificado FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE servicios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  descripcion VARCHAR(255) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_servicios_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE feriados (
  fecha DATE PRIMARY KEY,
  motivo VARCHAR(120) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE turnos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  mascota_id INT UNSIGNED NOT NULL,
  servicio_id INT UNSIGNED NOT NULL,
  fecha_hora DATETIME NOT NULL,
  estado ENUM('pendiente','confirmado','cancelado','atendido','ausente') NOT NULL DEFAULT 'pendiente',
  canal ENUM('web','telefonico','presencial') NOT NULL,
  es_urgencia TINYINT(1) NOT NULL DEFAULT 0,
  motivo VARCHAR(255) NULL,                         -- motivo de cancelación/urgencia
  creado_por INT UNSIGNED NOT NULL,
  modificado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modificado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Columna generada: NULL cuando está cancelado → libera la franja
  fecha_hora_activa DATETIME GENERATED ALWAYS AS (IF(estado = 'cancelado', NULL, fecha_hora)) STORED,
  UNIQUE KEY uq_turnos_franja_activa (fecha_hora_activa),   -- ¡CLAVE para RF09!
  KEY idx_turnos_fecha (fecha_hora),
  KEY idx_turnos_usuario (usuario_id),
  CONSTRAINT fk_tur_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_tur_mascota FOREIGN KEY (mascota_id) REFERENCES mascotas(id),
  CONSTRAINT fk_tur_servicio FOREIGN KEY (servicio_id) REFERENCES servicios(id),
  CONSTRAINT fk_tur_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id),
  CONSTRAINT fk_tur_modificado FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- P1: historial clínico
CREATE TABLE atenciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  turno_id INT UNSIGNED NOT NULL,
  mascota_id INT UNSIGNED NOT NULL,
  profesional_nombre VARCHAR(100) NOT NULL,         -- texto libre; el profesional no es usuario
  anamnesis TEXT NULL,
  diagnostico TEXT NULL,
  tratamiento TEXT NULL,
  medicacion TEXT NULL,
  vacunas TEXT NULL,
  observaciones TEXT NULL,
  creado_por INT UNSIGNED NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_atenciones_turno (turno_id),
  KEY idx_atenciones_mascota (mascota_id),
  CONSTRAINT fk_at_turno FOREIGN KEY (turno_id) REFERENCES turnos(id),
  CONSTRAINT fk_at_mascota FOREIGN KEY (mascota_id) REFERENCES mascotas(id),
  CONSTRAINT fk_at_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE notas_atencion (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  atencion_id INT UNSIGNED NOT NULL,
  texto TEXT NOT NULL,
  creado_por INT UNSIGNED NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notas_atencion (atencion_id),
  CONSTRAINT fk_nota_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id),
  CONSTRAINT fk_nota_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Inmutabilidad de atenciones (RF26). Ejecutar con el cliente mysql (usa DELIMITER).
DELIMITER $$
CREATE TRIGGER atenciones_no_update BEFORE UPDATE ON atenciones FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las atenciones son inmutables'; END$$
CREATE TRIGGER atenciones_no_delete BEFORE DELETE ON atenciones FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las atenciones no se eliminan'; END$$
DELIMITER ;
