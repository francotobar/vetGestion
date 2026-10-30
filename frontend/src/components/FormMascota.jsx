import { useState } from 'react';
import Campo from './Campo.jsx';

// Formulario de mascota (RF06), compartido por el alta (/mascotas/nueva)
// y la edición (/mascotas/:id). Valida en el cliente lo mismo que el
// backend (BE-05): especie perro|gato, sexo macho|hembra, fecha de
// nacimiento no futura y peso > 0. Peso, microchip y alergias son opcionales.
const ESPECIES = [
  { valor: 'perro', etiqueta: 'Perro' },
  { valor: 'gato', etiqueta: 'Gato' },
];

const SEXOS = [
  { valor: 'macho', etiqueta: 'Macho' },
  { valor: 'hembra', etiqueta: 'Hembra' },
];

// Valores iniciales del formulario (vacíos para el alta).
export const mascotaVacia = {
  nombre: '',
  especie: 'perro',
  raza: '',
  sexo: 'macho',
  fechaNacimiento: '',
  pesoKg: '',
  esterilizado: false,
  microchip: '',
  alergiasCondiciones: '',
};

// Convierte el estado del formulario al cuerpo camelCase del API y
// marca qué campos son obligatorios según el resultado de `validar`.
export function armarPayload(formulario) {
  return {
    nombre: formulario.nombre.trim(),
    especie: formulario.especie,
    raza: formulario.raza.trim(),
    sexo: formulario.sexo,
    fechaNacimiento: formulario.fechaNacimiento,
    // Opcionales: si vienen vacíos no se envían.
    pesoKg: formulario.pesoKg === '' ? undefined : Number(formulario.pesoKg),
    esterilizado: formulario.esterilizado,
    microchip: formulario.microchip.trim() || undefined,
    alergiasCondiciones: formulario.alergiasCondiciones.trim() || undefined,
  };
}

function validar(formulario) {
  const errores = {};
  if (!formulario.nombre.trim()) errores.nombre = 'El nombre es obligatorio.';
  if (!formulario.raza.trim()) errores.raza = 'La raza es obligatoria.';
  if (!formulario.fechaNacimiento) {
    errores.fechaNacimiento = 'La fecha de nacimiento es obligatoria.';
  } else if (formulario.fechaNacimiento > new Date().toISOString().slice(0, 10)) {
    errores.fechaNacimiento = 'La fecha de nacimiento no puede ser futura.';
  }
  if (formulario.pesoKg !== '' && !(Number(formulario.pesoKg) > 0)) {
    errores.pesoKg = 'El peso debe ser un número mayor a 0.';
  }
  return errores;
}

export default function FormMascota({ inicial = mascotaVacia, textoBoton = 'Guardar', onGuardar, children }) {
  const [formulario, setFormulario] = useState(inicial);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo) {
    return (valor) => setFormulario((f) => ({ ...f, [campo]: valor }));
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();
    const nuevosErrores = validar(formulario);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) return;

    setEnviando(true);
    try {
      await onGuardar(armarPayload(formulario));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} noValidate>
      {children /* caja de error de la API, etc. */}
      <div className="formulario__fila">
        <Campo
          id="nombre"
          etiqueta="Nombre"
          valor={formulario.nombre}
          onChange={cambiar('nombre')}
          error={errores.nombre}
          obligatorio
          maxLength={60}
        />
        <Campo
          id="especie"
          etiqueta="Especie"
          tipo="select"
          opciones={ESPECIES}
          valor={formulario.especie}
          onChange={cambiar('especie')}
          obligatorio
        />
      </div>
      <div className="formulario__fila">
        <Campo
          id="raza"
          etiqueta="Raza"
          valor={formulario.raza}
          onChange={cambiar('raza')}
          error={errores.raza}
          ayuda="Texto libre."
          obligatorio
          maxLength={60}
        />
        <Campo
          id="sexo"
          etiqueta="Sexo"
          tipo="select"
          opciones={SEXOS}
          valor={formulario.sexo}
          onChange={cambiar('sexo')}
          obligatorio
        />
      </div>
      <div className="formulario__fila">
        <Campo
          id="fechaNacimiento"
          etiqueta="Fecha de nacimiento"
          tipo="date"
          valor={formulario.fechaNacimiento}
          onChange={cambiar('fechaNacimiento')}
          error={errores.fechaNacimiento}
          obligatorio
        />
        <Campo
          id="pesoKg"
          etiqueta="Peso (kg)"
          tipo="number"
          valor={formulario.pesoKg}
          onChange={cambiar('pesoKg')}
          error={errores.pesoKg}
          ayuda="Opcional."
          min="0"
          step="0.01"
        />
      </div>
      <div className="campo campo--checkbox">
        <label>
          <input
            type="checkbox"
            checked={formulario.esterilizado}
            onChange={(e) => cambiar('esterilizado')(e.target.checked)}
          />
          <span>Está esterilizado</span>
        </label>
      </div>
      <Campo
        id="microchip"
        etiqueta="Microchip"
        valor={formulario.microchip}
        onChange={cambiar('microchip')}
        ayuda="Opcional."
        maxLength={30}
      />
      <Campo
        id="alergiasCondiciones"
        etiqueta="Alergias o condiciones preexistentes"
        tipo="textarea"
        valor={formulario.alergiasCondiciones}
        onChange={cambiar('alergiasCondiciones')}
        ayuda="Opcional."
        rows={3}
      />
      <button type="submit" className="boton" disabled={enviando}>
        {enviando ? 'Guardando…' : textoBoton}
      </button>
    </form>
  );
}
