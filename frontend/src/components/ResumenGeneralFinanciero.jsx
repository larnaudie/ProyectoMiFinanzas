import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";
import { useCotizacionUi } from "../hooks/useCotizacionUi.js";
import {
  formatearMontoMoneda,
  MONEDAS_SOPORTADAS,
  normalizarMoneda,
} from "../utils/monedas.js";
import {
  resumirMovimientosMensuales,
  resumirSaldosCuentas,
  totalizarSaldosEnUyu,
} from "../utils/resumenFinanciero.js";
import {
  resumirPresupuestoMensualPorTransferencias,
} from "../utils/presupuestoMensual.js";
import { EquivalenciaMontoUi } from "./UiExchangeReference.jsx";
import { DashboardLoadingState } from "./DashboardLoadingState.jsx";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const periodoActual = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
};

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const etiquetaPeriodo = (periodo) => {
  const [anio, mes] = periodo.split("-");
  return `${MESES[Number(mes) - 1] || "Mes"} de ${anio}`;
};

const formatearReferencia = (monto) => (
  monto === null
    ? "Cotización pendiente"
    : formatearMontoMoneda(monto, "UYU")
);

function FilaMoneda({ moneda, resumen }) {
  return (
    <div className="general-month-currency-row">
      <strong>{moneda}</strong>
      <span>
        Bancario {formatearMontoMoneda(resumen.resultadoBancario, moneda)}
      </span>
      <span>
        Gasto real {formatearMontoMoneda(resumen.gastoReal, moneda)}
      </span>
    </div>
  );
}

export function ResumenGeneralFinanciero({ cuentas = [], onCuentaActualizada }) {
  const [gastos, setGastos] = useState([]);
  const [periodo, setPeriodo] = useState(periodoActual);
  const [cuentaMensualId, setCuentaMensualId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [edicionSaldo, setEdicionSaldo] = useState(null);
  const [guardandoSaldo, setGuardandoSaldo] = useState("");
  const [errorSaldo, setErrorSaldo] = useState("");
  const cotizacion = useCotizacionUi(true);

  useEffect(() => {
    let activo = true;

    api.get("/gastos", { params: { vista: "dashboard" } })
      .then((response) => {
        if (activo) setGastos(response.data.gastos || []);
      })
      .catch((apiError) => {
        if (!activo) return;
        console.error("Error al cargar el resumen general:", apiError);
        setError(
          apiError.response?.data?.message
          || "No se pudo cargar el resumen del mes.",
        );
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  const aniosDisponibles = useMemo(() => {
    const actual = String(new Date().getFullYear());
    return [...new Set([
      actual,
      ...gastos
        .map((gasto) => String(gasto?.fecha || "").slice(0, 4))
        .filter((anio) => /^\d{4}$/.test(anio)),
    ])].sort((a, b) => b.localeCompare(a));
  }, [gastos]);

  const saldos = useMemo(() => resumirSaldosCuentas(cuentas), [cuentas]);
  const cuentasBancarias = cuentas.filter((cuenta) => cuenta.tipoCuenta !== "credito");
  const cuentaMensual = cuentas.find((cuenta) => cuenta._id === cuentaMensualId) || null;
  const resumenMensual = useMemo(
    () => resumirMovimientosMensuales({
      gastos,
      cuentas,
      periodo,
      cuentaId: cuentaMensualId,
    }),
    [cuentaMensualId, cuentas, gastos, periodo],
  );
  const resumenPresupuesto = useMemo(
    () => resumirPresupuestoMensualPorTransferencias({
      gastos,
      cuentas,
      periodo,
    }),
    [cuentas, gastos, periodo],
  );
  const monedasConCuentas = MONEDAS_SOPORTADAS.filter(
    (moneda) => saldos[moneda].cuentas.length > 0,
  );
  const monedasDelMes = MONEDAS_SOPORTADAS.filter((moneda) => (
    cuentaMensual
      ? resumenMensual[moneda].cantidad > 0
        || (
          cuentaMensual.tipoCuenta !== "credito"
          && moneda === normalizarMoneda(cuentaMensual.moneda)
        )
      : resumenMensual[moneda].cantidad > 0 || saldos[moneda].cuentas.length > 0
  ));
  const duplicadosIgnorados = MONEDAS_SOPORTADAS.reduce(
    (total, moneda) => total + resumenMensual[moneda].duplicadosIgnorados,
    0,
  );
  const haySaldoInformado = cuentasBancarias.some((cuenta) => (
    cuenta.saldoActual !== null
    && cuenta.saldoActual !== undefined
    && cuenta.saldoActual !== ""
  ));

  const saldoTotalUyu = haySaldoInformado
    ? totalizarSaldosEnUyu(saldos, cotizacion.cotizacion)
    : null;
  const uyuPorDolar = numeroFinito(cotizacion.cotizacion?.usd?.uyuPorDolar);
  const saldoTotalUsd = saldoTotalUyu !== null && uyuPorDolar > 0
    ? saldoTotalUyu / uyuPorDolar
    : null;

  const cambiarMes = (mes) => {
    const [anio] = periodo.split("-");
    setPeriodo(`${anio}-${mes}`);
  };

  const cambiarAnio = (anio) => {
    const [, mes] = periodo.split("-");
    setPeriodo(`${anio}-${mes}`);
  };

  const empezarEdicionSaldo = (cuenta) => {
    setEdicionSaldo({
      cuentaId: cuenta._id,
      valor: cuenta.saldoActual ?? "",
    });
    setErrorSaldo("");
  };

  const guardarSaldo = async (event, cuenta) => {
    event.preventDefault();
    const valorTexto = String(edicionSaldo?.valor ?? "").trim();
    const saldoActual = valorTexto === "" ? null : Number(valorTexto);

    if (saldoActual !== null && !Number.isFinite(saldoActual)) {
      setErrorSaldo("Ingresá un saldo válido.");
      return;
    }

    setGuardandoSaldo(cuenta._id);
    setErrorSaldo("");

    try {
      const response = await api.patch(`/cuentas/${cuenta._id}`, { saldoActual });
      onCuentaActualizada?.(response.data.cuenta);
      setEdicionSaldo(null);
    } catch (apiError) {
      setErrorSaldo(
        apiError.response?.data?.message
        || "No se pudo actualizar el saldo.",
      );
    } finally {
      setGuardandoSaldo("");
    }
  };

  const resultadoDisponible = resumenPresupuesto.disponible;
  const resultadoEsDeficit = resultadoDisponible
    && resumenPresupuesto.resultadoUsd < 0;
  const resultadoEsCero = resultadoDisponible
    && resumenPresupuesto.resultadoUsd === 0;
  const etiquetaResultado = !resumenPresupuesto.cuentaFuenteEncontrada
    ? "Sin cuenta fuente"
    : !resumenPresupuesto.hayMovimientosPeriodo
      ? "Sin movimientos"
    : resultadoEsCero
      ? "Sin diferencia"
      : resultadoEsDeficit
        ? "Déficit"
        : "Ahorro";

  return (
    <section id="dashboard-general" className="general-finance-overview">
      <header className="general-overview-header">
        <div>
          <p className="eyebrow">Vista general</p>
          <h2>Tu situación financiera</h2>
          <p>Saldos actuales y resultado mensual, sin mezclar monedas directamente.</p>
        </div>
        <div className="general-rate-reference" aria-live="polite">
          {cotizacion.cotizacion ? (
            <>
              <span>Referencia BCU</span>
              <strong>
                US$ 1 = {formatearMontoMoneda(uyuPorDolar, "UYU")}
                {" · "}
                UI 1 = {formatearMontoMoneda(
                  cotizacion.cotizacion.ui.uyuPorUnidad,
                  "UYU",
                )}
              </strong>
            </>
          ) : (
            <span>{cotizacion.cargando ? "Consultando BCU..." : "Cotización no disponible"}</span>
          )}
          <button type="button" onClick={cotizacion.actualizar} disabled={cotizacion.cargando}>
            Actualizar
          </button>
        </div>
      </header>

      <section className="balance-overview" aria-labelledby="balance-overview-title">
        <header>
          <div>
            <span className="section-kicker">Lo que tenés hoy</span>
            <h3 id="balance-overview-title">Saldos por moneda</h3>
            <p>Son saldos informados; no se calculan a partir de los gastos del mes.</p>
          </div>
          <div className="balance-reference-total">
            <span>Patrimonio de referencia</span>
            <strong>
              {haySaldoInformado ? formatearReferencia(saldoTotalUyu) : "Sin saldos informados"}
            </strong>
            {saldoTotalUsd !== null && (
              <small>≈ {formatearMontoMoneda(saldoTotalUsd, "USD")}</small>
            )}
          </div>
        </header>

        {cuentasBancarias.length === 0 ? (
          <p className="general-empty-state">Todavía no hay cuentas bancarias.</p>
        ) : (
          <div className="balance-currency-grid">
            {monedasConCuentas.map((moneda) => (
              <article className="balance-currency-card" key={moneda}>
                <div className="balance-currency-heading">
                  <span>{moneda}</span>
                  <strong>{formatearMontoMoneda(saldos[moneda].total, moneda)}</strong>
                  {moneda === "UI" && (
                    <EquivalenciaMontoUi
                      monto={saldos[moneda].total}
                      cotizacion={cotizacion.cotizacion}
                    />
                  )}
                </div>

                <div className="balance-account-list">
                  {saldos[moneda].cuentas.map(({ cuenta, saldo, informado }) => (
                    <div className="balance-account-row" key={cuenta._id}>
                      {edicionSaldo?.cuentaId === cuenta._id ? (
                        <form onSubmit={(event) => guardarSaldo(event, cuenta)}>
                          <label>
                            <span>{cuenta.nombreCuenta}</span>
                            <input
                              type="number"
                              step="0.01"
                              autoFocus
                              value={edicionSaldo.valor}
                              placeholder="Saldo actual"
                              onChange={(event) => setEdicionSaldo({
                                cuentaId: cuenta._id,
                                valor: event.target.value,
                              })}
                            />
                          </label>
                          <div>
                            <button type="submit" disabled={guardandoSaldo === cuenta._id}>
                              {guardandoSaldo === cuenta._id ? "Guardando..." : "Guardar"}
                            </button>
                            <button type="button" onClick={() => setEdicionSaldo(null)}>
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div>
                            <span>{cuenta.nombreCuenta}</span>
                            <strong>
                              {informado
                                ? formatearMontoMoneda(saldo, moneda)
                                : "Saldo sin informar"}
                            </strong>
                          </div>
                          <button type="button" onClick={() => empezarEdicionSaldo(cuenta)}>
                            {informado ? "Actualizar" : "Informar"}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
        {errorSaldo && <p className="inline-error">{errorSaldo}</p>}
      </section>

      <section className="general-month-overview" aria-labelledby="general-month-title">
        <header>
          <div>
            <span className="section-kicker">Cómo cerró el mes</span>
            <h3 id="general-month-title">Resultado de {etiquetaPeriodo(periodo)}</h3>
          </div>
          <div className="general-period-filters">
            <label className="general-account-filter">
              Cuenta del detalle
              <select
                value={cuentaMensualId}
                onChange={(event) => setCuentaMensualId(event.target.value)}
              >
                <option value="">Todas las cuentas</option>
                {cuentas.map((cuenta) => (
                  <option key={cuenta._id} value={cuenta._id}>
                    {cuenta.nombreCuenta} · {cuenta.tipoCuenta === "credito" ? "Crédito" : normalizarMoneda(cuenta.moneda)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mes
              <select value={periodo.slice(5, 7)} onChange={(event) => cambiarMes(event.target.value)}>
                {MESES.map((mes, index) => {
                  const valor = String(index + 1).padStart(2, "0");
                  return <option key={valor} value={valor}>{mes}</option>;
                })}
              </select>
            </label>
            <label>
              Año
              <select value={periodo.slice(0, 4)} onChange={(event) => cambiarAnio(event.target.value)}>
                {aniosDisponibles.map((anio) => <option key={anio}>{anio}</option>)}
              </select>
            </label>
          </div>
        </header>

        {cargando && <DashboardLoadingState compacto />}
        {error && <p className="inline-error">{error}</p>}

        {!cargando && !error && (
          <>
            <div className="general-month-kpis">
              <article>
                <span>Presupuesto mensual fijo</span>
                <strong className="is-positive">
                  {formatearMontoMoneda(resumenPresupuesto.presupuestoUsd, "USD")}
                </strong>
                <small>
                  Corresponde al sueldo mensual disponible.
                </small>
              </article>

              <article>
                <span>Transferido desde CA USD</span>
                <strong className="is-negative">
                  {resultadoDisponible
                    ? formatearMontoMoneda(resumenPresupuesto.transferidoUsd, "USD")
                    : resumenPresupuesto.cuentaFuenteEncontrada
                      ? "Sin movimientos"
                      : "Cuenta no encontrada"}
                </strong>
                <small>
                  Suma las salidas con subcategoría Transf. durante el mes.
                </small>
              </article>

              <article className="economic-result-card">
                <span>Resultado del mes</span>
                <strong className={resultadoEsDeficit ? "is-negative" : resultadoDisponible ? "is-positive" : ""}>
                  {etiquetaResultado}{resultadoDisponible ? ": " : ""}
                  {resultadoDisponible
                    ? formatearMontoMoneda(resumenPresupuesto.resultadoUsd, "USD")
                    : ""}
                </strong>
                <small>
                  US$ 4.000 menos lo transferido desde Caja Ahorro USD.
                </small>
              </article>
            </div>

            <div className="general-month-currencies">
              <header>
                <strong>Detalle por moneda</strong>
                <span>
                  {cuentaMensual
                    ? `Filtrado por ${cuentaMensual.nombreCuenta}.`
                    : "Todas las cuentas."}
                  {" "}El resultado del sueldo siempre se calcula desde CA USD.
                </span>
              </header>
              {monedasDelMes.map((moneda) => (
                <FilaMoneda
                  key={moneda}
                  moneda={moneda}
                  resumen={resumenMensual[moneda]}
                />
              ))}
              {duplicadosIgnorados > 0 && (
                <p className="general-overview-note">
                  Se ignoraron {duplicadosIgnorados} duplicados bancarios exactos
                  encontrados en más de una cuenta.
                </p>
              )}
              {monedasDelMes.length === 0 && (
                <p className="general-empty-state">No hay movimientos en este período.</p>
              )}
            </div>
          </>
        )}
      </section>

      <p className="general-overview-note">
        El resumen consolida cuentas bancarias. Las tarjetas conservan su propio
        dashboard para mostrar consumos, pagos y deuda. El resultado mensual usa
        el cupo fijo de US$ 4.000 y las transferencias salientes desde CA USD.
      </p>
    </section>
  );
}
