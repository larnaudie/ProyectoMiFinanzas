import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";
import {
  formatearMontoMoneda,
  MONEDAS_SOPORTADAS,
  obtenerMonedasCuenta,
} from "../../../utils/monedas.js";
import { PlanesCuotasTarjeta } from "../../../components/PlanesCuotasTarjeta.jsx";

const formatearFecha = (fecha) => (
  fecha
    ? new Date(fecha).toLocaleDateString("es-UY", { timeZone: "UTC" })
    : "Sin fecha"
);

const formatearMonto = (monto, moneda) =>
  formatearMontoMoneda(monto, moneda);

const cantidadMovimientos = (totales = {}) => (
  Object.values(totales).reduce(
    (cantidad, total) => cantidad + Number(total?.cantidad || 0),
    0,
  )
);

const monedasVisibles = (resumen, cuenta) => {
  const habilitadas = obtenerMonedasCuenta(cuenta);
  return MONEDAS_SOPORTADAS.filter((moneda) =>
    habilitadas.includes(moneda) || Boolean(resumen.totales?.[moneda]),
  );
};

const cantidadPendientes = (totales = {}) => (
  Object.values(totales).reduce(
    (cantidad, total) => cantidad + Number(total?.pendientes || 0),
    0,
  )
);

function ResumenesCuentaCreditoPage({ cuenta }) {
  const { cuentaId } = useParams();
  const [resumenes, setResumenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [eliminandoResumenId, setEliminandoResumenId] = useState("");

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

  const eliminarResumen = async (resumen) => {
    const cantidad = cantidadMovimientos(resumen.totales);
    const nombre = resumen.periodo || `Cierre ${formatearFecha(resumen.cierre)}`;
    const confirmado = window.confirm(
      `¿Eliminar el resumen "${nombre}"?\n\n`
      + `También se eliminarán ${cantidad} movimiento${cantidad === 1 ? "" : "s"} `
      + "asociados al resumen. Esta acción no se puede deshacer.",
    );
    if (!confirmado) return;

    setEliminandoResumenId(resumen._id);
    setError("");
    setMensaje("");

    try {
      const response = await api.delete(
        `/importaciones/cuentas/${cuentaId}/resumenes-tarjeta/${resumen._id}`,
      );
      setResumenes((actuales) => (
        actuales.filter((item) => item._id !== resumen._id)
      ));

      const eliminados = Number(response.data.gastosEliminados || 0);
      setMensaje(
        `Resumen eliminado correctamente junto con ${eliminados} `
        + `movimiento${eliminados === 1 ? "" : "s"}.`,
      );
    } catch (apiError) {
      console.error("Error al eliminar el resumen:", apiError);
      setError(
        apiError.response?.data?.message
        || "No se pudo eliminar el resumen de la tarjeta.",
      );
    } finally {
      setEliminandoResumenId("");
    }
  };

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
      {mensaje && <p className="success-text" role="status">{mensaje}</p>}

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
          const monedas = monedasVisibles(resumen, cuenta);
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
                          <span>Cuotas futuras</span>
                          <strong>
                            {formatearMonto(total.cuotasFuturas, moneda)}
                          </strong>
                        </div>
                        <div>
                          <span>
                            {total.excesoLimite > 0
                              ? "Exceso del límite"
                              : "Disponible operativo"}
                          </span>
                          <strong
                            className={
                              total.excesoLimite > 0
                                ? "credit-summary-debt"
                                : "credit-summary-available"
                            }
                          >
                            {formatearMonto(
                              total.excesoLimite > 0
                                ? total.excesoLimite
                                : total.disponible,
                              moneda,
                            )}
                          </strong>
                        </div>
                      </div>
                      <div className="credit-summary-progress" aria-label={`${total.porcentajeUsado}% del límite utilizado`}>
                        <span
                          style={{
                            width: `${total.porcentajeBarra ?? Math.min(100, total.porcentajeUsado)}%`,
                          }}
                        />
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

              <PlanesCuotasTarjeta planes={resumen.planesCuotas || []} />

              <footer className="credit-summary-card-footer">
                <span>
                  {cantidadPendientes(resumen.totales)} pendientes
                </span>
                <div className="credit-summary-footer-actions">
                  <button
                    type="button"
                    className="selection-action delete-action"
                    disabled={Boolean(eliminandoResumenId)}
                    onClick={() => eliminarResumen(resumen)}
                  >
                    {eliminandoResumenId === resumen._id
                      ? "Eliminando..."
                      : "Eliminar resumen"}
                  </button>
                  <Link
                    className="primary-link"
                    to={`/cuentas/${cuentaId}/resumenes/${resumen._id}/gastos`}
                  >
                    Ver gastos del resumen
                  </Link>
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default ResumenesCuentaCreditoPage;
