// Utilidades de fechas (sección 5 del plan). Funciones puras: "ahora" siempre
// llega como parámetro para que los tests no dependan de la fecha real.
// Formatos de intercambio (regla 8): fecha = 'YYYY-MM-DD', hora = 'HH:mm'.
const { env } = require('../config/env');
const { ApiError } = require('./errores');

function minutosDesdeMedianoche(hora) {
  const m = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

function horaDesdeMinutos(minutos) {
  const hh = String(Math.floor(minutos / 60)).padStart(2, '0');
  const mm = String(minutos % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ['09:00', '09:30', …, '18:30'] según HORA_INICIO, HORA_FIN y SLOT_MINUTOS
// del .env. Con los valores por defecto: 20 franjas.
function generarFranjas() {
  const inicio = minutosDesdeMedianoche(env.HORA_INICIO);
  const fin = minutosDesdeMedianoche(env.HORA_FIN);
  const paso = env.SLOT_MINUTOS;
  if (inicio === null || fin === null || fin <= inicio || paso <= 0) {
    throw new Error('Horario inválido en la configuración (HORA_INICIO / HORA_FIN / SLOT_MINUTOS)');
  }
  const franjas = [];
  for (let m = inicio; m < fin; m += paso) {
    franjas.push(horaDesdeMinutos(m));
  }
  return franjas;
}

function esFechaValida(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const fechaObj = new Date(anio, mes - 1, dia);
  return (
    fechaObj.getFullYear() === anio && fechaObj.getMonth() === mes - 1 && fechaObj.getDate() === dia
  );
}

// Lunes a viernes (0 domingo … 6 sábado). Fecha inválida → no laborable.
function esDiaLaborable(fecha) {
  if (!esFechaValida(fecha)) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const diaSemana = new Date(anio, mes - 1, dia).getDay();
  return diaSemana >= 1 && diaSemana <= 5;
}

// Construye un Date local (hora sin zona) a partir de 'YYYY-MM-DD' + 'HH:mm'.
function parsearFechaHora(fecha, hora) {
  if (!esFechaValida(fecha)) return null;
  const minutos = minutosDesdeMedianoche(hora);
  if (minutos === null) return null;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia, Math.floor(minutos / 60), minutos % 60);
}

// Valida una franja para reserva. Lanza ApiError 422 FRANJA_INVALIDA si:
// formato inválido, hora fuera de las franjas, fin de semana, feriado,
// fecha pasada o fuera del plazo máximo de reserva (DIAS_MAX_RESERVA).
function validarFranja(fecha, hora, { feriados = [], ahora, diasMax = env.DIAS_MAX_RESERVA } = {}) {
  if (!(ahora instanceof Date)) {
    throw new Error('validarFranja: falta el parámetro "ahora" (Date)');
  }

  const fechaHora = parsearFechaHora(fecha, hora);
  if (!fechaHora) {
    throw new ApiError(422, 'FRANJA_INVALIDA', 'Formato de fecha u hora inválido');
  }
  if (!generarFranjas().includes(hora)) {
    throw new ApiError(422, 'FRANJA_INVALIDA', 'La hora no corresponde a una franja del horario de atención');
  }
  if (!esDiaLaborable(fecha)) {
    throw new ApiError(422, 'FRANJA_INVALIDA', 'No se atiende ese día (sábado o domingo)');
  }
  if (feriados.includes(fecha)) {
    throw new ApiError(422, 'FRANJA_INVALIDA', 'No se atiende ese día (feriado)');
  }
  if (fechaHora < ahora) {
    throw new ApiError(422, 'FRANJA_INVALIDA', 'La franja ya pasó');
  }

  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const limite = new Date(hoy);
  limite.setDate(hoy.getDate() + diasMax);
  const diaSolicitado = new Date(fechaHora.getFullYear(), fechaHora.getMonth(), fechaHora.getDate());
  if (diaSolicitado > limite) {
    throw new ApiError(422, 'FRANJA_INVALIDA', `Solo se pueden pedir turnos hasta ${diasMax} días adelante`);
  }
}

// Horas de diferencia entre una fecha/hora local y "ahora" (puede ser negativo).
// Acepta 'YYYY-MM-DD HH:mm' y también con segundos ('… HH:mm:ss', formato BD).
function horasHasta(fechaHora, ahora) {
  if (!(ahora instanceof Date)) {
    throw new Error('horasHasta: falta el parámetro "ahora" (Date)');
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(fechaHora);
  if (!m) {
    throw new ApiError(422, 'FRANJA_INVALIDA', 'Formato de fecha y hora inválido');
  }
  const [, anio, mes, dia, hh, mm, ss] = m.map((v, i) => (i === 0 ? v : Number(v)));
  if (hh > 23 || mm > 59 || (ss || 0) > 59) {
    throw new ApiError(422, 'FRANJA_INVALIDA', 'Formato de fecha y hora inválido');
  }
  const fecha = new Date(anio, mes - 1, dia, hh, mm, ss || 0);
  return (fecha - ahora) / 3600000;
}

module.exports = { generarFranjas, esDiaLaborable, validarFranja, horasHasta };
