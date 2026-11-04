import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

// Pantalla de inicio pública (ruta /). Contenido estático: no consulta la API.
// Mientras carga la sesión no muestra "Ir a mi panel" para que no aparezca ni
// desaparezca al resolverse; con sesión vigente lo ofrece según su rol.

const SERVICIOS = [
  { nombre: 'Consulta general', icono: 'estetoscopio' },
  { nombre: 'Vacunación', icono: 'jeringa' },
  { nombre: 'Control de peso', icono: 'balanza' },
  { nombre: 'Desparasitación', icono: 'capsula' },
  { nombre: 'Castración (consulta)', icono: 'tijeras' },
];

const PASOS = [
  {
    titulo: 'Registrate',
    texto: 'Creá tu cuenta con tus datos personales y cargá los datos de tus mascotas.',
    icono: 'usuario',
  },
  {
    titulo: 'Elegí tu turno',
    texto: 'Seleccioná la mascota, el servicio y una franja libre. Las franjas son de 30 minutos, de lunes a viernes.',
    icono: 'calendario',
  },
  {
    titulo: 'Esperá la confirmación',
    texto: 'La veterinaria confirma tu turno. Podés verlo y cancelarlo en "Mis turnos" con hasta 24 horas de anticipación.',
    icono: 'confirmado',
  },
];

// Íconos SVG propios, dibujados con formas simples (trazo, sin imágenes externas).
// Son decorativos: el texto que los acompaña transmite el significado.
const TRAZO = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const DIBUJOS = {
  usuario: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M19 8v6M16 11h6" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h2M14 14h2M8 17h2" />
    </>
  ),
  confirmado: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  estetoscopio: (
    <>
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M10 12v1a5 5 0 0 0 10 0v-2" />
      <circle cx="20" cy="9" r="2" />
    </>
  ),
  jeringa: (
    <>
      <path d="M16 4l4 4" />
      <path d="M14 6l4 4-8 8-4-4z" />
      <path d="M5 19l-2 2" />
      <path d="M11 9l4 4" />
    </>
  ),
  balanza: (
    <>
      <path d="M12 3v17M7 20h10" />
      <path d="M5 7h14" />
      <path d="M5 7l-3 6a3 3 0 0 0 6 0z" />
      <path d="M19 7l-3 6a3 3 0 0 0 6 0z" />
    </>
  ),
  capsula: (
    <>
      <rect x="2" y="8.5" width="20" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="M9 15l6-6" />
    </>
  ),
  tijeras: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.1 8.1L20 20" />
      <path d="M8.1 15.9L20 4" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  noAtiende: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  telefono: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
  correo: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  ubicacion: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
};

function Icono({ nombre }) {
  return (
    <svg className="inicio-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...TRAZO}>
      {DIBUJOS[nombre]}
    </svg>
  );
}

// Ilustración original: un perro y un gato en formas planas, con la paleta celeste/azul.
function IlustracionMascotas() {
  return (
    <svg className="inicio-ilustracion" viewBox="0 0 400 320" aria-hidden="true" focusable="false">
      <circle cx="200" cy="165" r="140" fill="#dbeafe" />
      <ellipse cx="200" cy="284" rx="160" ry="14" fill="#bfdbfe" />
      <path d="M200 60c-6-10-18-8-18 2 0 9 18 18 18 18s18-9 18-18c0-10-12-12-18-2z" fill="#93c5fd" />

      {/* Perro */}
      <path d="M212 210q42-6 40-52" fill="none" stroke="#1e40af" strokeWidth="13" strokeLinecap="round" />
      <rect x="92" y="186" width="112" height="78" rx="39" fill="#1d4ed8" />
      <rect x="112" y="236" width="20" height="40" rx="10" fill="#1e3a8a" />
      <rect x="170" y="236" width="20" height="40" rx="10" fill="#1e3a8a" />
      <ellipse cx="122" cy="122" rx="16" ry="30" fill="#1e3a8a" transform="rotate(18 122 122)" />
      <ellipse cx="178" cy="122" rx="16" ry="30" fill="#1e3a8a" transform="rotate(-18 178 122)" />
      <circle cx="150" cy="140" r="44" fill="#2563eb" />
      <ellipse cx="150" cy="166" rx="22" ry="16" fill="#bfdbfe" />
      <ellipse cx="150" cy="158" rx="7" ry="5" fill="#0f172a" />
      <circle cx="134" cy="132" r="6" fill="#ffffff" />
      <circle cx="166" cy="132" r="6" fill="#ffffff" />
      <circle cx="135" cy="133" r="3" fill="#0f172a" />
      <circle cx="165" cy="133" r="3" fill="#0f172a" />

      {/* Gato */}
      <path d="M318 262q22-14 10-44" fill="none" stroke="#0284c7" strokeWidth="11" strokeLinecap="round" />
      <ellipse cx="282" cy="222" rx="50" ry="54" fill="#38bdf8" />
      <rect x="264" y="246" width="16" height="36" rx="8" fill="#0284c7" />
      <rect x="290" y="246" width="16" height="36" rx="8" fill="#0284c7" />
      <path d="M246 150L240 96L274 128Z" fill="#38bdf8" />
      <path d="M318 150L324 96L290 128Z" fill="#38bdf8" />
      <circle cx="282" cy="158" r="40" fill="#38bdf8" />
      <ellipse cx="268" cy="154" rx="5" ry="6.5" fill="#ffffff" />
      <ellipse cx="296" cy="154" rx="5" ry="6.5" fill="#ffffff" />
      <ellipse cx="268" cy="155" rx="2" ry="4" fill="#0f172a" />
      <ellipse cx="296" cy="155" rx="2" ry="4" fill="#0f172a" />
      <path d="M279 170h6l-3 4z" fill="#f472b6" />
      <path d="M276 177q3 3 6 0q3 3 6 0" fill="none" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M262 172l-28-4M262 179l-28 4M302 172l28-4M302 179l28 4"
        stroke="#0f172a"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export default function Inicio() {
  const { usuario, cargando } = useAuth();
  const panel = usuario?.rol === 'admin' ? '/admin/agenda' : '/turnos';

  function irAComoFunciona() {
    const seccion = document.getElementById('inicio-como');
    const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    seccion?.scrollIntoView({ behavior: reducirMovimiento ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div className="inicio-pagina">
      <section className="inicio-hero" aria-labelledby="inicio-titulo">
        <div className="inicio-hero__texto">
          <p className="inicio-etiqueta">Turnos online para tu veterinaria</p>
          <h1 id="inicio-titulo">Turnos claros para el cuidado de tus mascotas</h1>
          <p className="inicio-hero__descripcion">
            VetGestión organiza la agenda de la veterinaria: reservá turnos online, consultá los datos de
            tus mascotas y seguí su historial clínico desde un mismo lugar.
          </p>
          <div className="inicio-acciones">
            <button type="button" className="boton inicio-boton" onClick={irAComoFunciona}>
              Descubrí VetGestión
            </button>
            {!cargando && usuario && (
              <Link to={panel} className="boton boton--secundario inicio-boton">
                Ir a mi panel
              </Link>
            )}
          </div>
        </div>
        <div className="inicio-hero__ilustracion">
          <IlustracionMascotas />
        </div>
      </section>

      <section id="inicio-como" className="inicio-seccion" aria-labelledby="inicio-como-titulo">
        <div className="inicio-seccion__cabecera">
          <p className="inicio-etiqueta">Paso a paso</p>
          <h2 id="inicio-como-titulo">Cómo funciona</h2>
        </div>
        <ol className="inicio-pasos">
          {PASOS.map((paso, indice) => (
            <li key={paso.titulo} className="inicio-paso">
              <span className="inicio-paso__numero" aria-hidden="true">
                {indice + 1}
              </span>
              <span className="inicio-paso__icono">
                <Icono nombre={paso.icono} />
              </span>
              <h3>{paso.titulo}</h3>
              <p>{paso.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="inicio-seccion" aria-labelledby="inicio-servicios-titulo">
        <div className="inicio-seccion__cabecera">
          <p className="inicio-etiqueta">Atención</p>
          <h2 id="inicio-servicios-titulo">Servicios</h2>
          <p className="inicio-seccion__texto">Descubrí los servicios disponibles al solicitar tu turno.</p>
        </div>
        <ul className="inicio-servicios">
          {SERVICIOS.map((servicio) => (
            <li key={servicio.nombre} className="inicio-servicio">
              <span className="inicio-servicio__icono">
                <Icono nombre={servicio.icono} />
              </span>
              <span className="inicio-servicio__nombre">{servicio.nombre}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="inicio-seccion" aria-labelledby="inicio-horarios-titulo">
        <div className="inicio-seccion__cabecera">
          <p className="inicio-etiqueta">Agenda</p>
          <h2 id="inicio-horarios-titulo">Horarios de atención</h2>
        </div>
        <div className="inicio-horario">
          <span className="inicio-horario__icono">
            <Icono nombre="reloj" />
          </span>
          <div>
            <p className="inicio-horario__dias">Lunes a viernes</p>
            <p className="inicio-horario__hora">09:00 a 19:00</p>
            <p className="inicio-horario__detalle">Turnos de 30 minutos. La última franja comienza a las 18:30.</p>
          </div>
          <p className="inicio-horario__cerrado">
            <Icono nombre="noAtiende" />
            Sábados, domingos y feriados: no se atiende.
          </p>
        </div>
      </section>

      <section className="inicio-seccion" aria-labelledby="inicio-contacto-titulo">
        <div className="inicio-seccion__cabecera">
          <h2 id="inicio-contacto-titulo">Contacto</h2>
        </div>
        <ul className="inicio-contacto">
          <li>
            <span className="inicio-contacto__icono">
              <Icono nombre="telefono" />
            </span>
            <div>
              <p className="inicio-contacto__rotulo">Teléfono</p>
              <p className="inicio-contacto__dato">1512345678</p>
            </div>
          </li>
          <li>
            <span className="inicio-contacto__icono">
              <Icono nombre="correo" />
            </span>
            <div>
              <p className="inicio-contacto__rotulo">Correo electrónico</p>
              <p className="inicio-contacto__dato">vetgestion@example.com</p>
            </div>
          </li>
          <li>
            <span className="inicio-contacto__icono">
              <Icono nombre="ubicacion" />
            </span>
            <div>
              <p className="inicio-contacto__rotulo">Dirección</p>
              <p className="inicio-contacto__dato">Avenida Siempre Viva 123</p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}
