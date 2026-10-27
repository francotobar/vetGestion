// Campo de formulario con etiqueta y mensaje de error (componente
// compartido, sección 8 del plan). Usa un <label> associationado por htmlFor.
export default function Campo({
  id,
  etiqueta,
  tipo = 'text',
  valor,
  onChange,
  error,
  ayuda,
  obligatorio = false,
  ...props
}) {
  return (
    <div className="campo">
      <label htmlFor={id}>
        {etiqueta}
        {obligatorio && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        name={id}
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {ayuda && <p className="campo__ayuda">{ayuda}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
