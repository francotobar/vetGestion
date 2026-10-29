// Modal de confirmación (componente compartido, sección 8 del plan).
// Se usa para acciones que no se pueden deshacer, como dar de baja una mascota.
export default function Modal({ titulo, mensaje, textoConfirmar = 'Confirmar', onConfirmar, onCancelar }) {
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
        <p>{mensaje}</p>
        <div className="modal__acciones">
          <button type="button" className="boton boton--secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="boton boton--peligro" onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
