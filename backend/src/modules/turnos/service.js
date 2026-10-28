const { pool } = require('../../config/db');
const { generarFranjas, esDiaLaborable, parsearFechaHora } = require('../../utils/fechas');

// Formatea un Date local como 'YYYY-MM-DD' (regla 8: intercambio de fechas).
function aFechaLocal(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// Disponibilidad del día (sección 5 del plan):
// 1. Día sin atención (no laborable, feriado o fecha pasada) → [].
// 2. Franjas ocupadas: turnos del día con estado <> 'cancelado'.
// 3. Libres = franjas del horario, menos las ocupadas y menos las ya
//    pasadas si el día es hoy.
// "ahora" es parametrizable (mismo criterio que utils/fechas) para que los
// tests no dependan de la fecha real; el controller usa el valor por defecto.
async function disponibilidad(fecha, ahora = new Date()) {
  if (!esDiaLaborable(fecha)) return [];

  const hoy = aFechaLocal(ahora);
  if (fecha < hoy) return [];

  const [[feriado]] = await pool.execute('SELECT fecha FROM feriados WHERE fecha = ?', [fecha]);
  if (feriado) return [];

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const siguiente = aFechaLocal(new Date(anio, mes - 1, dia + 1));
  const [filas] = await pool.execute(
    `SELECT TIME_FORMAT(fecha_hora, '%H:%i') AS hora
       FROM turnos
      WHERE fecha_hora >= ? AND fecha_hora < ? AND estado <> 'cancelado'`,
    [`${fecha} 00:00:00`, `${siguiente} 00:00:00`]
  );
  const ocupadas = new Set(filas.map((f) => f.hora));

  return generarFranjas().filter((hora) => {
    if (ocupadas.has(hora)) return false;
    if (fecha === hoy && parsearFechaHora(fecha, hora) < ahora) return false;
    return true;
  });
}

module.exports = { disponibilidad };
