import { useMemo, useState } from "react";
import { api } from "../services/api.js";
import { useCotizacionUi } from "../hooks/useCotizacionUi.js";
import {
  formatearMontoMoneda,
  MONEDAS_SOPORTADAS,
} from "../utils/monedas.js";
import {
  resumirSaldosCuentas,
  totalizarSaldosEnUyu,
} from "../utils/resumenFinanciero.js";
import { EquivalenciaMontoUi } from "./UiExchangeReference.jsx";

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const formatearReferencia = (monto) => (
  monto === null
    ? "Cotización pendiente"
    : formatearMontoMoneda(monto, "UYU")
);

export function ResumenGeneralFinanciero({ cuentas = [], onCuentaActualizada }) {
  const [edicionSaldo, setEdicionSaldo] = useState(null);
  const [guardandoSaldo, setGuardandoSaldo] = useState("");
  const [errorSaldo, setErrorSaldo] = useState("");
  const cotizacion = useCotizacionUi(true);

  const saldos = useMemo(() => resumirSaldosCuentas(cuentas), [cuentas]);
  const cuentasBancarias = cuentas.filter((cuenta) => cuenta.tipoCuenta !== "credito");
  const monedasConCuentas = MONEDAS_SOPORTADAS.filter(
    (moneda) => saldos[moneda].cuentas.length > 0,
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

  return (
    <section id="dashboard-general" className="general-finance-overview">
      <header className="general-overview-header">
        <div>
          <p className="eyebrow">Vista general</p>
          <h2>Tu situación financiera</h2>
          <p>Saldos actuales por cuenta y moneda.</p>
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

    </section>
  );
}
