import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";

const formatearFecha = (fecha) => (
  fecha
    ? new Date(fecha).toLocaleDateString("es-UY", { timeZone: "UTC" })
    : "Sin fecha"
);

const formatearMonto = (monto, moneda) => new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: moneda,
  minimumFractionDigits: 2,
}).format(Number(monto || 0));

const cantidadMovimientos = (totales = {}) => (
  Number(totales.UYU?.cantidad || 0) + Number(totales.USD?.cantidad || 0)
);

const monedasVisibles = (resumen) => ["UYU", "USD"].filter((moneda) => {
  const total = resumen.totales?.[moneda];
  return total && (
    total.cantidad > 0
    || Number(total.limite || 0) !== 0
    || Number(total.deuda || 0) !== 0
    || Number(total.saldoAFavor || 0) !== 0
  );
});

function ResumenesCuentaCreditoPage({ cuenta }) {
  const { cuentaId } = useParams();
  const [resumenes, setResumenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/importaciones/cuentas/${cuentaId}/resumenes-tarjeta`)
      .then((response) => setResumenes(response.data.resumenes || []))
      .catch((apiError) => {
        console.error("Error al cargar los resúmenes:", apiError);
        setError(
          apiError.response?.data?.message
          || "No se pudieron cargar los resúmenes de la tarjeta.",
        );
      })
      .finally(() => setLoading(false));
  }, [cuentaId]);

  return (
    <section className="page-section credit-summaries-page">
      <header className="page-header credit-summaries-header">
        <div>
          <p className="eyebrow">Cuenta de crédito</p>
          <h1>{cuenta.nombreCuenta}</h1>
          <p>Los resúmenes están ordenados desde el cierre más reciente.</p>
        </div>
        <div className="action-row">
          <Link className="secondary-link" to={`/cuentas/${cuentaId}/dashboard`}>
            Ver dashboard
          </Link>
          <Link className="primary-link" to={`/cuentas/${cuentaId}/importar-excel`}>
            Importar Excel
          </Link>
        </div>
      </header>

      {loading && <p>Cargando resúmenes...</p>}
      {error && <p className="inline-error">{error}</p>}

      {!loading && !error && resumenes.length === 0 && (
        <section className="credit-summary-empty">
          <h2>Todavía no hay resúmenes</h2>
          <p>Importá el Excel bancario de la tarjeta para crear el primer período.</p>
          <Link className="primary-link" to={`/cuentas/${cuentaId}/importar-excel`}>
            Importar primer resumen
          </Link>
        </section>
      )}

      <div className="credit-summary-list">
        {resumenes.map((resumen) => {
          const monedas = monedasVisibles(resumen);
          return (
            <article className="credit-summary-card" key={resumen._id}>
              <header className="credit-summary-card-header">
                <div>
                  <p className="eyebrow">Resumen</p>
                  <h2>{resumen.periodo || `Cierre ${formatearFecha(resumen.cierre)}`}</h2>
                  <p>
                    Cierre: {formatearFecha(resumen.cierre)}
                    {" · "}
                    Vencimiento: {formatearFecha(resumen.vencimiento)}
                  </p>
                </div>
                <span className="credit-summary-count">
                  {cantidadMovimientos(resumen.totales)} movimientos
                </span>
              </header>

              <div className="credit-summary-currencies">
                {monedas.map((moneda) => {
                  const total = resumen.totales[moneda];
                  return (
                    <section className="credit-summary-currency" key={moneda}>
                      <div className="credit-summary-currency-title">
                        <strong>{moneda}</strong>
                        <span>{total.porcentajeUsado}% utilizado</span>
                      </div>
                      <div className="credit-summary-amounts">
                        <div>
                          <span>Límite de la tarjeta</span>
                          <strong>{formatearMonto(total.limite, moneda)}</strong>
                        </div>
                        <div>
                          <span>Monto bancario creado</span>
                          <strong>
                            {formatearMonto(total.montoBancarioCreado, moneda)}
                          </strong>
                        </div>
                        <div>
                          <span>Deuda del resumen</span>
                          <strong className="credit-summary-debt">
                            {formatearMonto(total.deuda, moneda)}
                          </strong>
                        </div>
                        {total.saldoAFavor > 0 && (
                          <div>
                            <span>Saldo a favor</span>
                            <strong className="credit-summary-credit-balance">
                              {formatearMonto(total.saldoAFavor, moneda)}
                            </strong>
                          </div>
                        )}
                        <div>
                          <span>Crédito disponible</span>
                          <strong className="credit-summary-available">
                            {formatearMonto(total.disponible, moneda)}
                          </strong>
                        </div>
                      </div>
                      <div className="credit-summary-progress" aria-label={`${total.porcentajeUsado}% del límite utilizado`}>
                        <span style={{ width: `${total.porcentajeUsado}%` }} />
                      </div>
                      <p className="credit-summary-breakdown">
                        Saldo anterior {formatearMonto(total.saldoAnterior, moneda)}
                        {" · "}
                        Consumos {formatearMonto(total.consumos, moneda)}
                        {" · "}
                        Pagos y reintegros {formatearMonto(total.pagosYReintegros, moneda)}
                        {total.saldoAFavor > 0
                          ? ` · Saldo a favor ${formatearMonto(total.saldoAFavor, moneda)}`
                          : ""}
                      </p>
                    </section>
                  );
                })}
              </div>

              <footer className="credit-summary-card-footer">
                <span>
                  {resumen.totales?.UYU?.pendientes + resumen.totales?.USD?.pendientes || 0} pendientes
                </span>
                <Link
                  className="primary-link"
                  to={`/cuentas/${cuentaId}/resumenes/${resumen._id}/gastos`}
                >
                  Ver gastos del resumen
                </Link>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default ResumenesCuentaCreditoPage;
