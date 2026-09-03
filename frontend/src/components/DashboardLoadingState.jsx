export function DashboardLoadingState({ nombreCuenta = "", compacto = false }) {
  const mensaje = nombreCuenta
    ? `Estamos reuniendo los movimientos de ${nombreCuenta}.`
    : "Estamos reuniendo tus saldos y movimientos.";

  return (
    <section
      className={`dashboard-loading${compacto ? " dashboard-loading-compact" : ""}`}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="dashboard-loading-copy">
        <span className="dashboard-loading-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div>
          <p className="eyebrow">Preparando tu dashboard</p>
          <h2>{compacto ? "Calculando el resultado del mes" : "Ordenando tus números"}</h2>
          <p>{mensaje} La primera carga puede demorar unos segundos.</p>
        </div>
      </div>

      <div
        className="dashboard-loading-progress"
        role="progressbar"
        aria-label="Cargando información financiera"
        aria-valuetext="Cargando"
      >
        <span />
      </div>

      <div className="dashboard-loading-kpis" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <div className="dashboard-loading-kpi" key={item}>
            <span />
            <strong />
            <small />
          </div>
        ))}
      </div>

      {!compacto && (
        <div className="dashboard-loading-panel" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </section>
  );
}

export default DashboardLoadingState;
