// Insignia de estado de turno (componente compartido, sección 8 del plan;
// la usan FE-05 (mis turnos) y FE-06 (agenda del admin)).
// Los estados son los del mapa de la sección 5: pendiente, confirmado,
// atendido, ausente y cancelado.
const COLORES = {
  pendiente: 'badge--pendiente',
  confirmado: 'badge--confirmado',
  atendido: 'badge--atendido',
  ausente: 'badge--ausente',
  cancelado: 'badge--cancelado',
};

export default function EstadoBadge({ estado }) {
  return (
    <span className={`badge ${COLORES[estado] || 'badge--pendiente'}`}>
      {estado ? estado[0].toUpperCase() + estado.slice(1) : ''}
    </span>
  );
}
