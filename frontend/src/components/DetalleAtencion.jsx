import dayjs from 'dayjs';

// Detalle de una atención en modo solo lectura (FE-10): encabezado con fecha
// del turno, servicio y profesional; los textos que vinieron cargados (los
// vacíos no se muestran) y, debajo, las notas aclaratorias con su fecha.
// Las atenciones son inmutables (RF26): nunca hay edición ni borrado.
const CAMPOS = [
  ['anamnesis', 'Anamnesis'],
  ['diagnostico', 'Diagnóstico'],
  ['tratamiento', 'Tratamiento'],
  ['medicacion', 'Medicación'],
  ['vacunas', 'Vacunas'],
  ['observaciones', 'Observaciones'],
];

export default function DetalleAtencion({ atencion, encabezado = true }) {
  return (
    <>
      {encabezado && (
        <p className="tarjeta__detalle">
          <strong>
            {dayjs(atencion.fechaHora).format('DD/MM/YYYY [de] HH:mm[h]')} · {atencion.servicioNombre}
          </strong>{' '}
          · Prof. {atencion.profesionalNombre}
        </p>
      )}
      {!encabezado && (
        <p className="tarjeta__detalle">
          Prof. {atencion.profesionalNombre} · {dayjs(atencion.fechaHora).format('DD/MM/YYYY')}
        </p>
      )}
      {CAMPOS.filter(([campo]) => atencion[campo]).map(([campo, etiqueta]) => (
        <p key={campo} className="tarjeta__detalle">
          <strong>{etiqueta}:</strong> {atencion[campo]}
        </p>
      ))}
      {atencion.notas.map((nota) => (
        <p key={nota.id} className="tarjeta__detalle">
          <strong>Nota aclaratoria ({dayjs(nota.creadoEn).format('DD/MM/YYYY')}):</strong> {nota.texto}
        </p>
      ))}
    </>
  );
}
