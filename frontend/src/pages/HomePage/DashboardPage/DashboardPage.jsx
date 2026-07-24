import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";

const obtenerId = (valor) => {
  if (!valor) return "";
  return typeof valor === "object" ? valor._id || valor.id || "" : valor;
};

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const crearMeses = (cantidad) => {
  const actual = new Date();
  const meses = [];

  for (let indice = cantidad - 1; indice >= 0; indice -= 1) {
    const fecha = new Date(Date.UTC(actual.getUTCFullYear(), actual.getUTCMonth() - indice, 1));
    meses.push(fecha.toISOString().slice(0, 7));
  }

  return meses;
};

const formatearMes = (clave) => {
  const fecha = new Date(`${clave}-01T00:00:00.000Z`);
  const texto = fecha.toLocaleDateString("es-UY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const formatearMonto = (monto, moneda) => new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: moneda,
  minimumFractionDigits: 2,
}).format(numeroFinito(monto));

const impactoConsumo = (gasto, campo) => {
  const monto = numeroFinito(gasto[campo]);
  if (gasto.tipoMovimiento === "reintegro") return -Math.abs(monto);
  return monto < 0 ? Math.abs(monto) : 0;
};

function DashboardPage() {
  const { cuentaId } = useParams();
  const navigate = useNavigate();
  const [cuentas, setCuentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(cuentaId || "todas");
  const [moneda, setMoneda] = useState("UYU");
  const [cantidadMeses, setCantidadMeses] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const gastosUrl = cuentaId ? `/gastos?cuentaId=${cuentaId}` : "/gastos";
    Promise.all([api.get("/cuentas"), api.get(gastosUrl)])
      .then(([cuentasResponse, gastosResponse]) => {
        setCuentas(cuentasResponse.data.cuentas || []);
        setGastos(gastosResponse.data.gastos || []);
      })
      .catch((apiError) => {
        console.error("Error al cargar el dashboard:", apiError);
        setError(apiError.response?.data?.message || "No se pudieron cargar los datos del dashboard.");
      })
      .finally(() => setLoading(false));
  }, [cuentaId]);

  useEffect(() => {
    setCuentaSeleccionada(cuentaId || "todas");
  }, [cuentaId]);

  const cuentaActual = cuentas.find((cuenta) => cuenta._id === cuentaSeleccionada);
  const meses = useMemo(() => crearMeses(cantidadMeses), [cantidadMeses]);

  useEffect(() => {
    if (cuentaActual?.moneda) {
      setMoneda(cuentaActual.moneda === "USD" ? "USD" : "UYU");
    }
  }, [cuentaActual?._id, cuentaActual?.moneda]);

  const cambiarVista = (event) => {
    const nuevaCuentaId = event.target.value;
    setCuentaSeleccionada(nuevaCuentaId);
    navigate(
      nuevaCuentaId === "todas"
        ? "/dashboard"
        : `/cuentas/${nuevaCuentaId}/dashboard`,
    );
  };

  const datosMensuales = useMemo(() => {
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta._id, cuenta]));
    const clavesPermitidas = new Set(meses);
    const movimientosInternosVinculados = new Set();
    gastos.forEach((gasto) => {
      const referenciaId = obtenerId(gasto.origen?.referenciaId);
      if (!referenciaId) return;
      movimientosInternosVinculados.add(gasto._id);
      movimientosInternosVinculados.add(referenciaId);
    });
    const acumulados = new Map(
      meses.map((clave) => [clave, {
        clave,
        montoBancario: 0,
        montoReal: 0,
        variacion: 0,
        cantidad: 0,
        pendientes: 0,
      }]),
    );

    gastos.forEach((gasto) => {
      const clave = gasto.fecha ? String(gasto.fecha).slice(0, 7) : "";
      const gastoCuentaId = obtenerId(gasto.cuentaId);
      const coincideCuenta = cuentaSeleccionada === "todas" || gastoCuentaId === cuentaSeleccionada;
      const gastoMoneda = gasto.moneda === "USD" ? "USD" : "UYU";

      if (!clavesPermitidas.has(clave) || !coincideCuenta || gastoMoneda !== moneda) return;

      const acumulado = acumulados.get(clave);
      if (gasto.estado === "pendiente") {
        acumulado.pendientes += 1;
        return;
      }
      if (gasto.estado !== "creado") return;

      const esMovimientoInterno = cuentaSeleccionada === "todas"
        && movimientosInternosVinculados.has(gasto._id);

      if (!esMovimientoInterno) {
        acumulado.montoBancario += impactoConsumo(gasto, "montoBancario");
        acumulado.montoReal += impactoConsumo(gasto, "montoReal");
      }

      const cuentaGasto = cuentasPorId.get(gastoCuentaId);
      if (cuentaGasto?.tipoCuenta !== "credito") {
        acumulado.variacion += numeroFinito(gasto.montoBancario);
      }
      acumulado.cantidad += 1;
    });

    return meses.map((clave) => acumulados.get(clave));
  }, [cuentaSeleccionada, cuentas, gastos, meses, moneda]);

  const totales = useMemo(() => datosMensuales.reduce(
    (resultado, mes) => ({
      montoBancario: resultado.montoBancario + mes.montoBancario,
      montoReal: resultado.montoReal + mes.montoReal,
      pendientes: resultado.pendientes + mes.pendientes,
    }),
    { montoBancario: 0, montoReal: 0, pendientes: 0 },
  ), [datosMensuales]);

  const maximoBarras = Math.max(
    1,
    ...datosMensuales.flatMap((mes) => [mes.montoBancario, mes.montoReal]),
  );
  const ultimoMes = datosMensuales[datosMensuales.length - 1];
  const muestraAhorro = !cuentaActual || cuentaActual.tipoCuenta !== "credito";
  const tituloCuenta = cuentaActual?.nombreCuenta || "Todas las cuentas";

  if (loading) return <section className="page-section"><p>Cargando dashboard...</p></section>;

  return (
    <section className="page-section dashboard-page">
      <header className="page-header dashboard-header">
        <div>
          <p className="eyebrow">Visión mensual</p>
          <h1>{cuentaActual ? `Dashboard · ${cuentaActual.nombreCuenta}` : "Dashboard general"}</h1>
          <p>
            {cuentaActual
              ? "Analizá el monto bancario y el monto real de esta cuenta, mes a mes."
              : "Compará el monto bancario y el monto real de todas tus cuentas, mes a mes."}
          </p>
        </div>
        {cuentaActual && (
          <div className="action-row">
            <Link className="secondary-link" to="/dashboard">
              Dashboard general
            </Link>
            <Link className="primary-link" to={`/cuentas/${cuentaActual._id}/gastos`}>
              Ver movimientos
            </Link>
          </div>
        )}
      </header>

      {error && <p className="inline-error">{error}</p>}

      <section className="dashboard-filters" aria-label="Filtros del dashboard">
        <label>
          Vista
          <select value={cuentaSeleccionada} onChange={cambiarVista}>
            <option value="todas">Todas las cuentas</option>
            {cuentas.map((cuenta) => (
              <option key={cuenta._id} value={cuenta._id}>{cuenta.nombreCuenta}</option>
            ))}
          </select>
        </label>
        <label>
          Moneda
          <select value={moneda} onChange={(event) => setMoneda(event.target.value)}>
            <option value="UYU">UYU</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label>
          Período
          <select value={cantidadMeses} onChange={(event) => setCantidadMeses(Number(event.target.value))}>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
            <option value={24}>Últimos 24 meses</option>
          </select>
        </label>
        <div className="dashboard-filter-context">
          <span>Analizando</span>
          <strong>{tituloCuenta}</strong>
        </div>
      </section>

      {!cuentaActual && cuentas.length > 0 && (
        <nav className="dashboard-account-shortcuts" aria-label="Dashboards por cuenta">
          <span>Dashboards por cuenta</span>
          <div>
            {cuentas.map((cuenta) => (
              <Link key={cuenta._id} to={`/cuentas/${cuenta._id}/dashboard`}>
                {cuenta.nombreCuenta}
              </Link>
            ))}
          </div>
        </nav>
      )}

      <section className="dashboard-kpis">
        <article>
          <span>Monto bancario</span>
          <strong>{formatearMonto(totales.montoBancario, moneda)}</strong>
          <small>Consumo acumulado del período</small>
        </article>
        <article>
          <span>Monto real</span>
          <strong>{formatearMonto(totales.montoReal, moneda)}</strong>
          <small>Impacto personal acumulado</small>
        </article>
        <article className={muestraAhorro && ultimoMes?.variacion < 0 ? "dashboard-kpi-negative" : "dashboard-kpi-positive"}>
          <span>{muestraAhorro ? "Ahorro estimado del mes" : "Ahorro estimado"}</span>
          <strong>{muestraAhorro ? formatearMonto(ultimoMes?.variacion, moneda) : "No aplica"}</strong>
          <small>{muestraAhorro ? "Variación neta de cuentas de débito" : "Las tarjetas no representan ahorro"}</small>
        </article>
        <article>
          <span>Movimientos pendientes</span>
          <strong>{totales.pendientes}</strong>
          <small>Dentro del período seleccionado</small>
        </article>
      </section>

      <section className="monthly-comparison-card">
        <header className="monthly-comparison-header">
          <div>
            <h2>Comparación mensual</h2>
            <p>Cada mes conserva exactamente dos barras para facilitar la comparación.</p>
          </div>
        </header>

        <div className="monthly-legend-row">
          <span className="monthly-legend-spacer" aria-hidden="true" />
          <div className="dashboard-legend" aria-label="Leyenda">
            <span><i className="banking-dot" />Monto bancario</span>
            <span><i className="real-dot" />Monto real</span>
          </div>
        </div>

        <div className="monthly-bars-list">
          {datosMensuales.map((mes) => {
            const ahorroPositivo = mes.variacion >= 0;
            return (
              <article className="monthly-bar-row" key={mes.clave}>
                <div className="monthly-bar-label">
                  <strong>{formatearMes(mes.clave)}</strong>
                  <span>{mes.cantidad} movimientos</span>
                  {muestraAhorro && (
                    <small className={ahorroPositivo ? "monthly-saving-positive" : "monthly-saving-negative"}>
                      {ahorroPositivo ? "Ahorro est." : "Déficit"}: {formatearMonto(Math.abs(mes.variacion), moneda)}
                    </small>
                  )}
                </div>
                <div className="monthly-bars">
                  <div className="monthly-bar-line">
                    <span className="monthly-bar-name">Bancario</span>
                    <strong>{formatearMonto(mes.montoBancario, moneda)}</strong>
                    <div className="monthly-bar-track">
                      <span
                        className="monthly-bar-fill monthly-bar-banking"
                        style={{ width: `${Math.max(0, (mes.montoBancario / maximoBarras) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="monthly-bar-line">
                    <span className="monthly-bar-name">Real</span>
                    <strong>{formatearMonto(mes.montoReal, moneda)}</strong>
                    <div className="monthly-bar-track">
                      <span
                        className="monthly-bar-fill monthly-bar-real"
                        style={{ width: `${Math.max(0, (mes.montoReal / maximoBarras) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="dashboard-savings-note">
        <span className="dashboard-savings-icon">$</span>
        <div>
          <h3>¿Cómo se estima el ahorro?</h3>
          <p>
            Se toma la variación neta mensual de las cuentas de débito en la moneda elegida.
            Las transferencias internas de la misma moneda se compensan si están importadas en ambas cuentas.
            USD y UYU se muestran por separado para no inventar un tipo de cambio.
          </p>
        </div>
      </aside>
    </section>
  );
}

export default DashboardPage;
