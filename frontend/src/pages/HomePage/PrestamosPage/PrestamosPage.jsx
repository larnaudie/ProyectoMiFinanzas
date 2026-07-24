import { Link } from "react-router-dom";

function PrestamosPage() {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <p className="eyebrow">Financiación</p>
          <h1>Deudas y préstamos</h1>
          <p>Este es el espacio global para consultar tus préstamos, sin depender de una cuenta seleccionada.</p>
        </div>
        <Link className="secondary-link" to="/manage">Administrar</Link>
      </header>

      <p className="empty-state">Todavía no hay préstamos para mostrar.</p>
    </section>
  );
}

export default PrestamosPage;
