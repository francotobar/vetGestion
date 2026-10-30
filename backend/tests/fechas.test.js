// Tests unitarios de utilidades de fechas (BE-02).
// Todas las fechas son fijas: los tests no dependen de la fecha real.
const { generarFranjas, esDiaLaborable, validarFranja, horasHasta } = require('../src/utils/fechas');

// Referencias fijas (hora local):
const AHORA = new Date(2026, 9, 28, 10, 0); // miércoles 28/10/2026 10:00
const VIERNES = new Date(2026, 9, 23, 8, 0); // viernes 23/10/2026 08:00

// Devuelve el error lanzado (o null si no lanzó nada).
function errorDe(fecha, hora, opciones) {
  try {
    validarFranja(fecha, hora, opciones);
    return null;
  } catch (err) {
    return err;
  }
}

describe('generarFranjas', () => {
  test('genera 20 franjas de 09:00 a 18:30', () => {
    const franjas = generarFranjas();
    expect(franjas).toHaveLength(20);
    expect(franjas[0]).toBe('09:00');
    expect(franjas[1]).toBe('09:30');
    expect(franjas[19]).toBe('18:30');
    expect(franjas).not.toContain('19:00');
  });
});

describe('esDiaLaborable', () => {
  test('lunes a viernes son laborables; sábado y domingo no', () => {
    expect(esDiaLaborable('2026-10-26')).toBe(true); // lunes
    expect(esDiaLaborable('2026-10-23')).toBe(true); // viernes
    expect(esDiaLaborable('2026-10-24')).toBe(false); // sábado
    expect(esDiaLaborable('2026-10-25')).toBe(false); // domingo
    expect(esDiaLaborable('2026-02-30')).toBe(false); // fecha inexistente
  });
});

describe('validarFranja', () => {
  test('una franja válida no lanza error', () => {
    const error = errorDe('2026-10-29', '09:30', { feriados: [], ahora: AHORA, diasMax: 60 });
    expect(error).toBeNull();
  });

  test('un sábado es inválido (422 FRANJA_INVALIDA)', () => {
    const error = errorDe('2026-10-24', '09:00', { feriados: [], ahora: AHORA, diasMax: 60 });
    expect(error.codigo).toBe('FRANJA_INVALIDA');
    expect(error.status).toBe(422);
  });

  test('un feriado es inválido', () => {
    const error = errorDe('2026-12-08', '09:00', {
      feriados: ['2026-12-08'],
      ahora: AHORA,
      diasMax: 100,
    });
    expect(error.codigo).toBe('FRANJA_INVALIDA');
  });

  test('09:15 no es una franja válida', () => {
    const error = errorDe('2026-10-29', '09:15', { feriados: [], ahora: AHORA, diasMax: 60 });
    expect(error.codigo).toBe('FRANJA_INVALIDA');
  });

  test('19:00 queda fuera del horario (la última franja es 18:30)', () => {
    const error = errorDe('2026-10-29', '19:00', { feriados: [], ahora: AHORA, diasMax: 60 });
    expect(error.codigo).toBe('FRANJA_INVALIDA');
  });

  test('un formato de fecha inválido es rechazado', () => {
    expect(errorDe('29/10/2026', '09:00', { ahora: AHORA }).codigo).toBe('FRANJA_INVALIDA');
    expect(errorDe('2026-13-40', '09:00', { ahora: AHORA }).codigo).toBe('FRANJA_INVALIDA');
  });

  test('una fecha pasada es inválida', () => {
    const error = errorDe('2026-10-27', '09:00', { feriados: [], ahora: AHORA, diasMax: 60 });
    expect(error.codigo).toBe('FRANJA_INVALIDA');
    expect(error.mensaje).toContain('pasó');
  });

  test('hoy + 61 días supera el máximo; hoy + 60 días está permitido', () => {
    const opciones = { feriados: [], ahora: VIERNES, diasMax: 60 };
    // viernes 23/10 + 60 = martes 22/12 (válido) ; + 61 = miércoles 23/12 (no)
    expect(errorDe('2026-12-22', '09:00', opciones)).toBeNull();
    const error = errorDe('2026-12-23', '09:00', opciones);
    expect(error.codigo).toBe('FRANJA_INVALIDA');
    expect(error.mensaje).toContain('60');
  });

  test('sin el parámetro "ahora" lanza error de programación', () => {
    expect(() => validarFranja('2026-10-29', '09:00', { diasMax: 60 })).toThrow('ahora');
  });
});

describe('horasHasta', () => {
  test('devuelve las horas de diferencia respecto de "ahora"', () => {
    expect(horasHasta('2026-10-29 12:00', AHORA)).toBeCloseTo(26);
    expect(horasHasta('2026-10-29 09:00', AHORA)).toBeCloseTo(23); // menos de 24 h
  });

  test('acepta el formato de la base de datos (con segundos)', () => {
    expect(horasHasta('2026-10-29 12:00:00', AHORA)).toBeCloseTo(26);
  });

  test('un formato inválido lanza FRANJA_INVALIDA', () => {
    expect(() => horasHasta('29/10/2026 12:00', AHORA)).toThrow('Formato');
    expect(() => horasHasta('2026-10-29 25:00', AHORA)).toThrow('Formato');
  });
});
