// Ruta provisoria: cada pantalla se implementa en su tarea del plan
// (FE-02 login/registro, FE-03 mascotas, FE-04 reserva, etc.).
export default function PaginaEnConstruccion({ titulo }) {
  return (
    <section className="pagina">
      <h1>{titulo}</h1>
      <p>Esta pantalla se implementa en una tarea siguiente del plan.</p>
    </section>
  );
}
