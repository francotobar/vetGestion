// Campo de formulario con etiqueta y mensaje de error (componente
// compartido, sección 8 del plan). Usa un <label> associationado por htmlFor.
// Soporta input (cualquier tipo), select (con `opciones`) y textarea.
export default function Campo({
  id,
  etiqueta,
  tipo = 'text',
  valor,
  onChange,
  error,
  ayuda,
  obligatorio = false,
  opciones,
  ...props
}) {
  let control;
  if (tipo === 'select') {
    control = (
      <select id={id} name={id} value={valor} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} {...props}>
        {(opciones || []).map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    );
  } else if (tipo === 'textarea') {
    control = (
      <textarea id={id} name={id} value={valor} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} {...props} />
    );
  } else {
    control = (
      <input
        id={id}
        name={id}
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        {...props}
      />
    );
  }

  return (
    <div className="campo">
      <label htmlFor={id}>
        {etiqueta}
        {obligatorio && <span aria-hidden="true"> *</span>}
      </label>
      {control}
      {ayuda && <p className="campo__ayuda">{ayuda}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
