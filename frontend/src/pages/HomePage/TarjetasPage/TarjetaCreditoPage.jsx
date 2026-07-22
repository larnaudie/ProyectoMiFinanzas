import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";

const formatearFecha = (fecha) =>
  fecha
    ? new Date(fecha).toLocaleDateString("es-UY", { timeZone: "UTC" })
    : "Sin fecha";

const formatearMonto = (monto, moneda) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(Number(monto || 0));

function TarjetaCreditoPage() {
  const { cuentaId, tarjetaId } = useParams();
  const [tarjeta, setTarjeta] = useState(null);
  const [resumenes, setResumenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get(`/tarjetas/${tarjetaId}`),
      api.get(`/tarjetas/${tarjetaId}/resumenes`),
    ])
      .then(([tarjetaResponse, resumenesResponse]) => {
        setTarjeta(tarjetaResponse.data.tarjeta);
        setResumenes(resumenesResponse.data.resumenes || []);
      })
      .catch((apiError) => {
        console.error("Error al cargar la tarjeta:", apiError);
        setError(apiError.response?.data?.message || "No se pudo cargar la tarjeta.");
      })
      .finally(() => setLoading(false));
  }, [tarjetaId]);

  return (
    <section className="page-section credit-card-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tarjeta de crédito</p>
          <h1>{tarjeta?.nombreTarjeta || "Tarjeta"}</h1>
          <p>
            {tarjeta?.ultimosDigitos ? `Terminada en ${tarjeta.ultimosDigitos} · ` : ""}
            {tarjeta?.cuentaId?.nombreCuenta || "Cuenta"}
          </p>
        </div>
      </header>

      <div className="action-row">
        <Link className="secondary-link" to={`/cuentas/${cuentaId}/tarjetas`}>Volver a tarjetas</Link>
        <Link className="primary-link" to={`/cuentas/${cuentaId}/tarjetas/${tarjetaId}/importar-excel`}>
          Importar resumen
        </Link>
      </div>

      <section className="credit-card-panel">
        <header>
          <h2>Resúmenes</h2>
          <p>Los movimientos pendientes se revisan dentro de cada resumen antes de aparecer en el desglose general.</p>
        </header>

        {loading && <p>Cargando resúmenes...</p>}
        {error && <p className="inline-error">{error}</p>}
        {!loading && !error && resumenes.length === 0 && (
          <p className="empty-state">Todavía no hay resúmenes importados para esta tarjeta.</p>
        )}

        <div className="card-grid">
          {resumenes.map((resumen) => (
            <Link
              className="account-card summary-card-link"
              key={resumen._id}
              to={`/cuentas/${cuentaId}/tarjetas/${tarjetaId}/resumenes/${resumen._id}`}
            >
              <span className="eyebrow">Resumen</span>
              <strong>{resumen.periodo || formatearFecha(resumen.cierre)}</strong>
              <span>Cierre: {formatearFecha(resumen.cierre)}</span>
              <span>Vencimiento: {formatearFecha(resumen.vencimiento)}</span>
              <span>{resumen.cantidadMovimientos} movimientos</span>
              <span>{formatearMonto(resumen.totales?.UYU, "UYU")}</span>
              <span>{formatearMonto(resumen.totales?.USD, "USD")}</span>
              <span>{resumen.totales?.pendientes || 0} pendientes · {resumen.totales?.creados || 0} confirmados</span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}

export default TarjetaCreditoPage;
