import { Link, useParams } from 'react-router-dom';

function DashboardPage() {
  const { cuentaId } = useParams();

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Resumen inicial de la cuenta seleccionada.</p>
        </div>
      </header>
      <div className="action-row">
        <Link className="primary-link" to={`/cuentas/${cuentaId}/gastos`}>Ver gastos</Link>
        <Link className="secondary-link" to={`/cuentas/${cuentaId}/importar`}>Importar Excel</Link>
      </div>
      <div className="summary-grid">
        <article><span>Gasto bancario</span><strong>$ 0</strong></article>
        <article><span>Gasto real</span><strong>$ 0</strong></article>
        <article><span>Pendientes</span><strong>0</strong></article>
      </div>
    </section>
  );
}

export default DashboardPage;
