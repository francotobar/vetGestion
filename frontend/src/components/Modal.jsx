// Modal de confirmación (componente compartido, sección 8 del plan).
// Se usa para acciones que no se pueden deshacer, como dar de baja una
// mascota (FE-03) o cancelar un turno (FE-05). Acepta `children` para
// agregar contenido extra al cuerpo (por ejemplo el SelectorFranja al
// reprogramar) y `tipo="normal"` para acciones no destructivas.
export default function Modal({
  titulo,
  mensaje,
  children,
  textoConfirmar = 'Confirmar',
  tipo = 'peligro',
  onConfirmar,
  onCancelar,
}) {
  const claseConfirmar = tipo === 'peligro' ? 'boton boton--peligro' : 'boton';
  return (
    <div className="modal-overlay" role="presentation" onClick={onCancelar}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{titulo}</h2>
        {mensaje && <p>{mensaje}</p>}
        {children}
        <div className="modal__acciones">
          <button type="button" className="boton boton--secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className={claseConfirmar} onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
