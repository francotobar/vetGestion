# Inmutabilidad de los registros clínicos

Este documento describe cómo se garantiza que los registros clínicos no se modifican ni se borran (RF19 para la atención, RF20 para la nota aclaratoria, y la regla de la especificación: "los registros clínicos no se modifican ni se eliminan; solo se agregan notas aclaratorias"), qué cubre cada mecanismo y cuáles son sus límites reales. El código y algunos tests citan estos requisitos como RF26 y RF27; esa diferencia de numeración está registrada en `docs/DECISIONES.md`.

## Qué se protege

| Registro | Tabla | Protección |
| --- | --- | --- |
| Atención clínica (anamnesis, diagnóstico, tratamiento, medicación, vacunas, observaciones) | `atenciones` | Triggers `BEFORE UPDATE` y `BEFORE DELETE` en la base de datos |
| Nota aclaratoria sobre una atención | `notas_atencion` | Solo se agregan (`INSERT`); no hay endpoint que la edite ni la borre |

## Mecanismo 1: triggers en la base de datos

Definidos en `backend/db/schema.sql`:

```sql
CREATE TRIGGER atenciones_no_update BEFORE UPDATE ON atenciones FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las atenciones son inmutables'; END
CREATE TRIGGER atenciones_no_delete BEFORE DELETE ON atenciones FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las atenciones no se eliminan'; END
```

Cualquier `UPDATE` o `DELETE` sobre `atenciones`, venga de la aplicación, de una consola SQL o de un script, falla con `SQLSTATE 45000`. Esta es la garantía principal: no depende de que el código de la aplicación sea correcto.

Los triggers se crean junto con la tabla y la base de datos los conserva. `db:reset` y `demo:reset` los vuelven a crear al recrear el esquema.

## Mecanismo 2: sin endpoints de edición ni borrado

La API no expone ninguna ruta `PUT`, `PATCH` ni `DELETE` sobre atenciones o notas. Las rutas relevantes (`backend/src/modules/atenciones/routes.js` y `backend/src/modules/turnos/routes.js`) son:

| Método y ruta | Qué hace |
| --- | --- |
| `POST /api/admin/turnos/:id/atencion` | Crea la atención de un turno `atendido` (una sola por turno, `UNIQUE` en `turno_id`) |
| `GET /api/mascotas/:id/historial` (cliente) y `GET /api/admin/mascotas/:id/historial` (admin) | Lectura del historial |
| `POST /api/admin/atenciones/:id/notas` | Agrega una nota aclaratoria |

En el código de la aplicación no hay ninguna sentencia `UPDATE atenciones`, `DELETE FROM atenciones`, `UPDATE notas_atencion` ni `DELETE FROM notas_atencion` fuera de los tests (ver "Verificación").

## Mecanismo 3: correcciones con notas, no con ediciones

Un error en una atención se corrige agregando una nota aclaratoria (`notas_atencion`) con fecha y autor. La atención original queda intacta y el historial muestra ambos. El cliente ve la atención y sus notas en orden cronológico (solo lectura).

## Mecanismo 4: bajas lógicas en lugar de borrados

La aplicación nunca borra usuarios, mascotas ni turnos. Las bajas son lógicas:

- **Mascotas:** `activa = 0`. La mascota deja de aparecer en la ficha y no recibe reservas (`MASCOTA_INACTIVA`). Sus turnos futuros pendientes o confirmados se cancelan; los pasados no se tocan. La baja de mascota no toca `atenciones`.
- **Clientes:** `estado_cuenta = 'inactiva'`. La anonimización reemplaza los datos personales, pero no modifica `atenciones` ni `notas_atencion`: el historial clínico queda vinculado a la mascota, no a la identidad del cliente.
- **Turnos:** `estado = 'cancelado'`. Solo se cancelan turnos `pendiente` o `confirmado`. Un turno `atendido`, `ausente` o `cancelado` no puede volver a cambiar de estado (`TRANSICION_INVALIDA`), por lo que un turno con atención no se modifica desde la aplicación.

## Verificación

**Tests automatizados** (`backend/tests/atenciones.test.js`, prueba "trigger rechaza UPDATE y DELETE sobre atenciones"): intentan un `UPDATE` y un `DELETE` directos sobre una atención y comprueban `sqlState = '45000'` y el mensaje "inmutables". Los tests de `anonimizacion.test.js` y `baja-mascotas.test.js` comprueban que sus operaciones no alteran atenciones ni turnos pasados.

**Comprobación manual en la base:**

```sql
SHOW TRIGGERS WHERE `Table` = 'atenciones';
-- Deben aparecer atenciones_no_update (BEFORE UPDATE) y atenciones_no_delete (BEFORE DELETE).
```

**Comprobación de la aplicación:** buscar en `backend/src` sentencias `UPDATE` o `DELETE` que afecten a `atenciones` o `notas_atencion` (resultado esperado: ninguna).

## Limitaciones conocidas

1. **Las notas no tienen triggers.** `notas_atencion` no tiene triggers `BEFORE UPDATE`/`BEFORE DELETE`. La aplicación no las modifica ni las borra, pero una consulta SQL directa sí podría hacerlo. Si la inmutabilidad debe ser total también para las notas, hace falta agregar esos dos triggers (decisión pendiente).
2. **`TRUNCATE` no dispara triggers de `DELETE`.** Vaciar la tabla con `TRUNCATE atenciones` elimina los registros sin que el trigger lo impida. Lo mismo ocurre con `DROP TABLE`, que además elimina los triggers.
3. **`demo:reset` borra tablas.** Por diseño, el script de demostración elimina y recrea `atenciones` (y sus triggers) para cargar datos ficticios. Solo debe ejecutarse sobre una base de demostración. Por eso pide confirmar el nombre de la base y verifica antes que puede crear triggers.
4. **Quien administra la base puede eliminar los triggers.** Un usuario con privilegio `TRIGGER` o `ALTER` puede ejecutar `DROP TRIGGER`. Además, el usuario de la aplicación configurado en `.env` puede tener todos los privilegios sobre la base (`GRANT ALL`), y en ese caso también podría eliminarlos. La protección real depende de que el usuario de la aplicación tenga solo los privilegios necesarios (`SELECT`, `INSERT`, `UPDATE`, `DELETE` sobre las tablas que usa la aplicación, sin `TRIGGER`, `ALTER` ni `DROP`). Esa configuración no está automatizada en el proyecto.
5. **Backups y restauraciones.** Un `mysqldump` restaurado en otra base recrea los triggers, pero una restauración que sustituya la base reemplaza también los datos que hubiera. La inmutabilidad protege contra modificaciones posteriores, no contra una decisión de restaurar un respaldo anterior.
6. **Requisito de entorno local.** Con el binlog activo, MySQL exige el privilegio `SUPER` o `log_bin_trust_function_creators = 1` para crear triggers. En el entorno de desarrollo se usa esta última variable (ver `README.md`).
7. **Carreras entre reservas y bajas.** No afectan a la inmutabilidad de los registros clínicos, pero son parte del estado real del proyecto: las reservas y reprogramaciones bloquean la fila de la mascota antes de validar y escribir, y la baja bloquea la misma fila antes de cancelar turnos futuros. Un turno nuevo no puede quedar activo para una mascota inactiva (test `reservas-bloqueo-mascota.test.js`).
