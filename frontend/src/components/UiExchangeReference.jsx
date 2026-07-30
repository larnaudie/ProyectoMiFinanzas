import { formatearMontoMoneda } from "../utils/monedas.js";
import { convertirMontoUi } from "../utils/cotizaciones.js";

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const formatearFecha = (fecha) => {
  if (!fecha) return "sin fecha";
  const [anio, mes, dia] = String(fecha).slice(0, 10).split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : fecha;
};

const formatearUiPorUnidad = (valor) =>
  numeroFinito(valor).toLocaleString("es-UY", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

const formatearUiEnUsd = (valor) =>
  numeroFinito(valor).toLocaleString("es-UY", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });

export function EquivalenciaMontoUi({
  monto,
  cotizacion,
  className = "",
}) {
  if (!cotizacion) return null;

  const equivalencia = convertirMontoUi(monto, cotizacion);

  return (
    <small className={`ui-amount-equivalence ${className}`.trim()}>
      ≈ {formatearMontoMoneda(equivalencia.montoUyu, "UYU")}
      {" · "}
      {formatearMontoMoneda(equivalencia.montoUsd, "USD")}
    </small>
  );
}

export function UiExchangeReference({
  cotizacion,
  cargando,
  error,
  onActualizar,
}) {
  return (
    <aside className="ui-exchange-reference" aria-live="polite">
      <div className="ui-exchange-reference-copy">
        <span className="ui-exchange-reference-eyebrow">
          Equivalencia dinámica
        </span>
        <strong>Unidad Indexada · referencia BCU</strong>
        {cotizacion ? (
          <p>
            1 UI = $ {formatearUiPorUnidad(cotizacion.ui.uyuPorUnidad)} UYU
            {" · "}
            1 UI = US$ {formatearUiEnUsd(
              cotizacion.equivalencias.unaUiEnUsd,
            )}
          </p>
        ) : (
          <p>
            {cargando
              ? "Consultando el último valor publicado..."
              : error || "Cotización no disponible."}
          </p>
        )}
      </div>

      {cotizacion && (
        <div className="ui-exchange-reference-meta">
          <span>
            UI: {formatearFecha(cotizacion.ui.fecha)}
          </span>
          <span>
            Dólar: {formatearFecha(cotizacion.usd.fecha)}
          </span>
          {cotizacion.desactualizada && (
            <span className="ui-exchange-warning">
              {cotizacion.advertencia || "Último dato disponible"}
            </span>
          )}
        </div>
      )}

      <button
        className="secondary-button"
        type="button"
        disabled={cargando}
        onClick={onActualizar}
      >
        {cargando ? "Actualizando..." : "Actualizar BCU"}
      </button>
    </aside>
  );
}
