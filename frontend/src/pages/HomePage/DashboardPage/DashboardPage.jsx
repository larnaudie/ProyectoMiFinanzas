import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";
import {
  formatearMontoMoneda,
  MONEDAS_SOPORTADAS,
  obtenerMonedaMovimiento,
  obtenerMonedasCuenta,
} from "../../../utils/monedas.js";
import {
  EquivalenciaMontoUi,
  UiExchangeReference,
} from "../../../components/UiExchangeReference.jsx";
import { useCotizacionUi } from "../../../hooks/useCotizacionUi.js";
import { calcularResultadoCuentaGasto } from "../../../utils/resultadoEconomico.js";

const MESES_DEL_ANIO = [
  { valor: "01", nombre: "Enero" },
  { valor: "02", nombre: "Febrero" },
  { valor: "03", nombre: "Marzo" },
  { valor: "04", nombre: "Abril" },
  { valor: "05", nombre: "Mayo" },
  { valor: "06", nombre: "Junio" },
  { valor: "07", nombre: "Julio" },
  { valor: "08", nombre: "Agosto" },
  { valor: "09", nombre: "Setiembre" },
  { valor: "10", nombre: "Octubre" },
  { valor: "11", nombre: "Noviembre" },
  { valor: "12", nombre: "Diciembre" },
];

const obtenerId = (valor) => {
  if (!valor) return "";
  return typeof valor === "object" ? valor._id || valor.id || "" : valor;
};

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const crearMesesDelAnio = (anio) =>
  MESES_DEL_ANIO.map((mes) => `${anio}-${mes.valor}`);

const formatearMes = (clave) => {
  const fecha = new Date(`${clave}-01T00:00:00.000Z`);
  const texto = fecha.toLocaleDateString("es-UY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const formatearMonto = (monto, moneda) =>
  formatearMontoMoneda(numeroFinito(monto), moneda);

const impactoConsumo = (gasto, campo) => {
  if (campo === "montoReal" && gasto.incluirMontoReal !== true) {
    return 0;
  }

  const monto = numeroFinito(gasto[campo]);
  if (gasto.tipoMovimiento === "reintegro") return -Math.abs(monto);
  return monto < 0 ? Math.abs(monto) : 0;
};

const crearAcumuladoMensual = (clave) => ({
  clave,
  montoBancario: 0,
  montoReal: 0,
  variacion: 0,
  cantidad: 0,
  pendientes: 0,
});

function DashboardPage({ embedded = false }) {
  const { cuentaId } = useParams();
  const cuentaSeleccionada = cuentaId || "todas";
  const anioActual = String(new Date().getFullYear());
  const [cuentas, setCuentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [fechaModo, setFechaModo] = useState("mes");
  const [fechaMes, setFechaMes] = useState("");
  const [fechaAnio, setFechaAnio] = useState(anioActual);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comparacionesContraidas, setComparacionesContraidas] = useState({});

  useEffect(() => {
    const gastosUrl = cuentaId ? `/gastos?cuentaId=${cuentaId}` : "/gastos";
    setLoading(true);
    setError("");

    Promise.all([api.get("/cuentas"), api.get(gastosUrl)])
      .then(([cuentasResponse, gastosResponse]) => {
        setCuentas(cuentasResponse.data.cuentas || []);
        setGastos(gastosResponse.data.gastos || []);
      })
      .catch((apiError) => {
        console.error("Error al cargar el dashboard:", apiError);
        setError(
          apiError.response?.data?.message ||
            "No se pudieron cargar los datos del dashboard.",
        );
      })
      .finally(() => setLoading(false));
  }, [cuentaId]);

  const cuentaActual = cuentas.find(
    (cuenta) => cuenta._id === cuentaSeleccionada,
  );

  const gastosDelDashboard = useMemo(
    () =>
      gastos.filter(
        (gasto) =>
          cuentaSeleccionada === "todas" ||
          obtenerId(gasto.cuentaId) === cuentaSeleccionada,
      ),
    [cuentaSeleccionada, gastos],
  );

  const aniosDisponibles = useMemo(
    () =>
      [
        ...new Set([
          anioActual,
          ...gastosDelDashboard
            .map((gasto) =>
              gasto.fecha ? String(gasto.fecha).slice(0, 4) : "",
            )
            .filter(Boolean),
        ]),
      ].sort((a, b) => b.localeCompare(a)),
    [anioActual, gastosDelDashboard],
  );

  const clavesMensualesDisponibles = useMemo(
    () =>
      [
        ...new Set(
          gastosDelDashboard
            .map((gasto) =>
              gasto.fecha ? String(gasto.fecha).slice(0, 7) : "",
            )
            .filter((clave) => /^\d{4}-\d{2}$/.test(clave)),
        ),
      ].sort(),
    [gastosDelDashboard],
  );

  const meses = useMemo(() => {
    if (fechaModo !== "mes") {
      return clavesMensualesDisponibles.length > 0
        ? clavesMensualesDisponibles
        : crearMesesDelAnio(anioActual);
    }

    if (fechaAnio) {
      return fechaMes
        ? [`${fechaAnio}-${fechaMes}`]
        : crearMesesDelAnio(fechaAnio);
    }

    const mesesFiltrados = fechaMes
      ? clavesMensualesDisponibles.filter(
          (clave) => clave.slice(5, 7) === fechaMes,
        )
      : clavesMensualesDisponibles;

    return mesesFiltrados.length > 0
      ? mesesFiltrados
      : crearMesesDelAnio(anioActual);
  }, [
    anioActual,
    clavesMensualesDisponibles,
    fechaAnio,
    fechaMes,
    fechaModo,
  ]);

  const monedasDashboard = useMemo(() => {
    if (cuentaActual) {
      return obtenerMonedasCuenta(cuentaActual);
    }

    const monedasEncontradas = new Set([
      ...cuentas.flatMap((cuenta) => obtenerMonedasCuenta(cuenta)),
      ...gastosDelDashboard.map((gasto) => {
        const cuentaGasto = cuentas.find(
          (cuenta) => cuenta._id === obtenerId(gasto.cuentaId),
        );
        return obtenerMonedaMovimiento(cuentaGasto, gasto.moneda);
      }),
    ]);
    const monedas = MONEDAS_SOPORTADAS.filter((moneda) =>
      monedasEncontradas.has(moneda),
    );

    return monedas.length > 0 ? monedas : ["UYU"];
  }, [cuentaActual, cuentas, gastosDelDashboard]);
  const manejaUi = monedasDashboard.includes("UI");
  const cotizacionUi = useCotizacionUi(manejaUi);

  const datosMensualesPorMoneda = useMemo(() => {
    const cuentasPorId = new Map(
      cuentas.map((cuenta) => [cuenta._id, cuenta]),
    );
    const clavesPermitidas = new Set(meses);
    const movimientosInternosVinculados = new Set();

    gastosDelDashboard.forEach((gasto) => {
      const referenciaId = obtenerId(gasto.origen?.referenciaId);
      if (!referenciaId) return;
      movimientosInternosVinculados.add(gasto._id);
      movimientosInternosVinculados.add(referenciaId);
    });

    const acumuladosPorMoneda = Object.fromEntries(
      monedasDashboard.map((moneda) => [
        moneda,
        new Map(
          meses.map((clave) => [clave, crearAcumuladoMensual(clave)]),
        ),
      ]),
    );

    gastosDelDashboard.forEach((gasto) => {
      const clave = gasto.fecha ? String(gasto.fecha).slice(0, 7) : "";
      const gastoCuentaId = obtenerId(gasto.cuentaId);
      const cuentaGasto = cuentasPorId.get(gastoCuentaId);
      const monedaGasto = obtenerMonedaMovimiento(
        cuentaGasto,
        gasto.moneda,
      );
      const acumulado =
        acumuladosPorMoneda[monedaGasto]?.get(clave);

      if (!clavesPermitidas.has(clave) || !acumulado) return;

      if (gasto.estado === "pendiente") {
        acumulado.pendientes += 1;
        return;
      }
      if (gasto.estado !== "creado") return;

      const esMovimientoInterno =
        cuentaSeleccionada === "todas" &&
        movimientosInternosVinculados.has(gasto._id);

      if (!esMovimientoInterno) {
        acumulado.montoBancario += impactoConsumo(
          gasto,
          "montoBancario",
        );
        acumulado.montoReal += impactoConsumo(gasto, "montoReal");
      }

      if (cuentaGasto?.tipoCuenta !== "credito") {
        acumulado.variacion += calcularResultadoCuentaGasto(gasto);
      }
      acumulado.cantidad += 1;
    });

    return Object.fromEntries(
      monedasDashboard.map((moneda) => [
        moneda,
        meses.map((clave) =>
          acumuladosPorMoneda[moneda].get(clave),
        ),
      ]),
    );
  }, [
    cuentaSeleccionada,
    cuentas,
    gastosDelDashboard,
    meses,
    monedasDashboard,
  ]);

  const totalesPorMoneda = useMemo(
    () =>
      Object.fromEntries(
        monedasDashboard.map((moneda) => [
          moneda,
          datosMensualesPorMoneda[moneda].reduce(
            (resultado, mes) => ({
              montoBancario:
                resultado.montoBancario + mes.montoBancario,
              montoReal: resultado.montoReal + mes.montoReal,
              variacion: resultado.variacion + mes.variacion,
              pendientes: resultado.pendientes + mes.pendientes,
            }),
            {
              montoBancario: 0,
              montoReal: 0,
              variacion: 0,
              pendientes: 0,
            },
          ),
        ]),
      ),
    [datosMensualesPorMoneda, monedasDashboard],
  );

  const pendientesTotales = monedasDashboard.reduce(
    (total, moneda) => total + totalesPorMoneda[moneda].pendientes,
    0,
  );
  const muestraAhorro =
    !cuentaActual || cuentaActual.tipoCuenta !== "credito";
  const tituloCuenta = cuentaActual?.nombreCuenta || "Todas las cuentas";
  const nombreMesSeleccionado =
    MESES_DEL_ANIO.find((mes) => mes.valor === fechaMes)?.nombre || "";
  const periodoSeleccionado =
    fechaModo !== "mes"
      ? "Todos los períodos"
      : [
          nombreMesSeleccionado || "Todos los meses",
          fechaAnio ? `de ${fechaAnio}` : "de todos los años",
        ].join(" ");

  const cambiarModoFecha = (valor) => {
    setFechaModo(valor);
    if (valor === "mes" && !fechaAnio) setFechaAnio(anioActual);
  };

  const alternarComparacion = (moneda) => {
    setComparacionesContraidas((estadoActual) => ({
      ...estadoActual,
      [moneda]: !estadoActual[moneda],
    }));
  };

  if (loading) {
    return (
      <section
        className={embedded ? "dashboard-page dashboard-page-embedded" : "page-section"}
      >
        <p>Cargando dashboard...</p>
      </section>
    );
  }

  return (
    <section
      className={`${embedded ? "" : "page-section "}dashboard-page${embedded ? " dashboard-page-embedded" : ""}`}
    >
      {!embedded && cuentas.length > 0 && (
        <nav
          className="dashboard-account-shortcuts dashboard-account-shortcuts-top"
          aria-label="Cambiar dashboard de cuenta"
        >
          <span>Tus cuentas</span>
          <div>
            <Link
              className={cuentaSeleccionada === "todas" ? "is-active" : ""}
              aria-current={
                cuentaSeleccionada === "todas" ? "page" : undefined
              }
              to="/home#dashboard-general"
            >
              Todas las cuentas
            </Link>
            {cuentas.map((cuenta) => {
              const activa = cuentaSeleccionada === cuenta._id;

              return (
                <Link
                  key={cuenta._id}
                  className={activa ? "is-active" : ""}
                  aria-current={activa ? "page" : undefined}
                  to={`/cuentas/${cuenta._id}/dashboard`}
                >
                  {cuenta.nombreCuenta}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <header className="page-header dashboard-header">
        <div>
          <p className="eyebrow">Visión mensual</p>
          <h1>
            {cuentaActual
              ? `Dashboard · ${cuentaActual.nombreCuenta}`
              : "Dashboard general"}
          </h1>
          <p>
            {cuentaActual
              ? "Analizá el monto bancario, el monto real y el ahorro de esta cuenta mes a mes."
              : "Compará todas tus cuentas por mes, con los importes separados por moneda."}
          </p>
        </div>
        {cuentaActual && (
          <div className="action-row">
            <Link className="secondary-link" to="/home#dashboard-general">
              Dashboard general
            </Link>
            <Link
              className="primary-link"
              to={`/cuentas/${cuentaActual._id}/gastos`}
            >
              Ver movimientos
            </Link>
          </div>
        )}
      </header>

      {error && <p className="inline-error">{error}</p>}

      {manejaUi && (
        <UiExchangeReference
          cotizacion={cotizacionUi.cotizacion}
          cargando={cotizacionUi.cargando}
          error={cotizacionUi.error}
          onActualizar={cotizacionUi.actualizar}
        />
      )}

      <section
        className="dashboard-filters"
        aria-label="Filtros del dashboard"
      >
        <label>
          Fecha
          <select
            value={fechaModo}
            onChange={(event) => cambiarModoFecha(event.target.value)}
          >
            <option value="">Sin filtro</option>
            <option value="mes">Por mes</option>
          </select>
        </label>

        {fechaModo === "mes" && (
          <>
            <label>
              Mes
              <select
                value={fechaMes}
                onChange={(event) => setFechaMes(event.target.value)}
              >
                <option value="">Todos los meses</option>
                {MESES_DEL_ANIO.map((mes) => (
                  <option key={mes.valor} value={mes.valor}>
                    {mes.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Año
              <select
                value={fechaAnio}
                onChange={(event) => setFechaAnio(event.target.value)}
              >
                <option value="">Todos los años</option>
                {aniosDisponibles.map((anio) => (
                  <option key={anio} value={anio}>
                    {anio}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="dashboard-filter-context">
          <span>Analizando</span>
          <strong>
            {tituloCuenta} · {periodoSeleccionado}
          </strong>
        </div>
      </section>

      <section className="dashboard-kpis">
        <article>
          <span>Monto bancario</span>
          {monedasDashboard.map((moneda) => (
            <div className="dashboard-kpi-value" key={moneda}>
              <strong>
                {formatearMonto(
                  totalesPorMoneda[moneda].montoBancario,
                  moneda,
                )}
              </strong>
              {moneda === "UI" && (
                <EquivalenciaMontoUi
                  monto={totalesPorMoneda[moneda].montoBancario}
                  cotizacion={cotizacionUi.cotizacion}
                />
              )}
            </div>
          ))}
          <small>Consumo acumulado de los meses filtrados</small>
        </article>
        <article>
          <span>Monto real</span>
          {monedasDashboard.map((moneda) => (
            <div className="dashboard-kpi-value" key={moneda}>
              <strong>
                {formatearMonto(
                  totalesPorMoneda[moneda].montoReal,
                  moneda,
                )}
              </strong>
              {moneda === "UI" && (
                <EquivalenciaMontoUi
                  monto={totalesPorMoneda[moneda].montoReal}
                  cotizacion={cotizacionUi.cotizacion}
                />
              )}
            </div>
          ))}
          <small>Impacto personal acumulado de los meses filtrados</small>
        </article>
        <article>
          <span>
            {muestraAhorro
              ? "Ahorro total de los meses"
              : "Ahorro total"}
          </span>
          {muestraAhorro ? (
            monedasDashboard.map((moneda) => {
              const ahorro = totalesPorMoneda[moneda].variacion;
              return (
                <div className="dashboard-kpi-value" key={moneda}>
                  <strong
                    className={
                      ahorro < 0
                        ? "dashboard-value-negative"
                        : "dashboard-value-positive"
                    }
                  >
                    {formatearMonto(ahorro, moneda)}
                  </strong>
                  {moneda === "UI" && (
                    <EquivalenciaMontoUi
                      monto={ahorro}
                      cotizacion={cotizacionUi.cotizacion}
                    />
                  )}
                </div>
              );
            })
          ) : (
            <strong>No aplica</strong>
          )}
          <small>
            {muestraAhorro
              ? cuentaSeleccionada === "todas"
                ? "Sumatoria de los resultados de todas las cuentas"
                : "Monto real incluido más transferencias netas"
              : "Las tarjetas no representan ahorro"}
          </small>
        </article>
        <article>
          <span>Movimientos pendientes</span>
          <strong>{pendientesTotales}</strong>
          <small>Dentro de los meses filtrados</small>
        </article>
      </section>

      {monedasDashboard.map((moneda) => {
        const datosMensuales = datosMensualesPorMoneda[moneda];
        const comparacionContraida = Boolean(
          comparacionesContraidas[moneda],
        );
        const comparacionId = [
          "comparacion-mensual",
          cuentaSeleccionada,
          moneda.toLowerCase(),
        ].join("-");
        const maximoBarras = Math.max(
          1,
          ...datosMensuales.flatMap((mes) => [
            mes.montoBancario,
            mes.montoReal,
          ]),
        );

        return (
          <section className="monthly-comparison-card" key={moneda}>
            <header className="monthly-comparison-header">
              <div>
                <h2>
                  Comparación mensual
                  {monedasDashboard.length > 1 ? ` · ${moneda}` : ""}
                </h2>
                <p>
                  Cada mes conserva exactamente dos barras para facilitar
                  la comparación.
                </p>
              </div>
              <button
                type="button"
                className="monthly-comparison-toggle"
                onClick={() => alternarComparacion(moneda)}
                aria-expanded={!comparacionContraida}
                aria-controls={comparacionId}
                aria-label={
                  comparacionContraida
                    ? `Desplegar comparación mensual ${moneda}`
                    : `Contraer comparación mensual ${moneda}`
                }
                title={
                  comparacionContraida
                    ? "Desplegar dashboard"
                    : "Contraer dashboard"
                }
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className={comparacionContraida ? "is-collapsed" : ""}
                >
                  <path d="M5.5 7.5 10 12l4.5-4.5" />
                </svg>
              </button>
            </header>

            <div id={comparacionId} hidden={comparacionContraida}>
              <div className="monthly-legend-row">
                <span
                  className="monthly-legend-spacer"
                  aria-hidden="true"
                />
                <div className="dashboard-legend" aria-label="Leyenda">
                  <span>
                    <i className="banking-dot" />
                    Monto bancario
                  </span>
                  <span>
                    <i className="real-dot" />
                    Monto real
                  </span>
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
                          <small
                            className={
                              ahorroPositivo
                                ? "monthly-saving-positive"
                                : "monthly-saving-negative"
                            }
                          >
                            {ahorroPositivo ? "Ahorro" : "Déficit"}:{" "}
                            {formatearMonto(
                              Math.abs(mes.variacion),
                              moneda,
                            )}
                          </small>
                        )}
                      </div>
                      <div className="monthly-bars">
                        <div className="monthly-bar-line">
                          <span className="monthly-bar-name">Bancario</span>
                          <span className="monthly-bar-amount">
                            <strong>
                              {formatearMonto(mes.montoBancario, moneda)}
                            </strong>
                            {moneda === "UI" && (
                              <EquivalenciaMontoUi
                                monto={mes.montoBancario}
                                cotizacion={cotizacionUi.cotizacion}
                              />
                            )}
                          </span>
                          <div className="monthly-bar-track">
                            <span
                              className="monthly-bar-fill monthly-bar-banking"
                              style={{
                                width: `${Math.max(
                                  0,
                                  (mes.montoBancario / maximoBarras) * 100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="monthly-bar-line">
                          <span className="monthly-bar-name">Real</span>
                          <span className="monthly-bar-amount">
                            <strong>
                              {formatearMonto(mes.montoReal, moneda)}
                            </strong>
                            {moneda === "UI" && (
                              <EquivalenciaMontoUi
                                monto={mes.montoReal}
                                cotizacion={cotizacionUi.cotizacion}
                              />
                            )}
                          </span>
                          <div className="monthly-bar-track">
                            <span
                              className="monthly-bar-fill monthly-bar-real"
                              style={{
                                width: `${Math.max(
                                  0,
                                  (mes.montoReal / maximoBarras) * 100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      <aside className="dashboard-savings-note">
        <span className="dashboard-savings-icon">$</span>
        <div>
          <h3>¿Cómo se calcula el ahorro total?</h3>
          {cuentaSeleccionada === "todas" ? (
            <p>
              El dashboard general suma el resultado de cada cuenta usando la
              misma regla individual: monto real cuando Incluye está activado
              y monto bancario para las transferencias. Las transferencias
              entre cuentas de la misma moneda se compensan entre origen y
              destino. UYU, USD y UI permanecen separados.
            </p>
          ) : (
            <p>
              En una cuenta individual, los movimientos con Incluye activado
              aportan su monto real y las transferencias aportan su monto
              bancario firmado. Una transferencia recibida suma y una enviada
              resta. Así se conserva el flujo de la cuenta y también se
              contemplan los gastos reales sin movimiento bancario.
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}

export default DashboardPage;
