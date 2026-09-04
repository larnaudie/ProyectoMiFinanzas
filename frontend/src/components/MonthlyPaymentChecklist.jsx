import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const FECHA_ACTUAL = new Date();
const ANIO_ACTUAL = FECHA_ACTUAL.getFullYear();
const MES_ACTUAL = FECHA_ACTUAL.getMonth() + 1;
const ANIOS_DISPONIBLES = Array.from(
  { length: 7 },
  (_, indice) => ANIO_ACTUAL + 1 - indice,
);

const ESTADOS = {
  pagado: "Pagado",
  pendiente: "Pendiente de completar",
  no_encontrado: "No detectado",
  omitido: "No corresponde este mes",
};

export function MonthlyPaymentChecklist() {
  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [mes, setMes] = useState(MES_ACTUAL);
  const [analisis, setAnalisis] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(false);

    api.get("/analisis", { params: { anio, mes } })
      .then((response) => {
        if (activo) setAnalisis(response.data.analisis || null);
      })
      .catch((solicitudError) => {
        console.error("No se pudo cargar el checklist mensual:", solicitudError);
        if (activo) {
          setAnalisis(null);
          setError(true);
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [anio, mes]);

  const controles = analisis?.controles || [];
  const resumen = analisis?.resumen || {
    total: 0,
    totalConfigurados: 0,
    omitidos: 0,
    pagados: 0,
    pendientes: 0,
    noEncontrados: 0,
  };
  const cantidadSinConfirmar = resumen.total - resumen.pagados;
  const totalConfigurados = resumen.totalConfigurados ?? resumen.total;
  const porcentaje = resumen.total > 0
    ? Math.round((resumen.pagados / resumen.total) * 100)
    : 0;
  const todoPago = resumen.total > 0 && cantidadSinConfirmar === 0;

  return (
    <section
      className={`home-payment-checklist ${todoPago ? "is-complete" : "is-alert"}`}
      aria-labelledby="home-payment-checklist-title"
      aria-live="polite"
    >
      <header>
        <div>
          <span className="home-payment-checklist-kicker">Recordatorio mensual</span>
          <h2 id="home-payment-checklist-title">
            Checklist de {MESES[mes - 1]} de {anio}
          </h2>
          {cargando ? (
            <p>Revisando los pagos del período seleccionado…</p>
          ) : error ? (
            <p>No pudimos revisar los pagos de este período. Intentá nuevamente.</p>
          ) : totalConfigurados === 0 ? (
            <p>Todavía no configuraste pagos mensuales para controlar.</p>
          ) : resumen.total === 0 ? (
            <p>No hay pagos programados para este período.</p>
          ) : todoPago ? (
            <p>Todo al día: encontramos todos los pagos de este período.</p>
          ) : (
            <p>
              Atención: todavía no encontramos {cantidadSinConfirmar}
              {cantidadSinConfirmar === 1 ? " pago" : " pagos"} de este período.
            </p>
          )}
        </div>

        <div className="home-payment-checklist-actions">
          <div className="home-payment-checklist-period" aria-label="Período del checklist">
            <label>
              Mes
              <select
                value={mes}
                onChange={(event) => setMes(Number(event.target.value))}
              >
                {MESES.map((nombreMes, indice) => (
                  <option value={indice + 1} key={nombreMes}>{nombreMes}</option>
                ))}
              </select>
            </label>
            <label>
              Año
              <select
                value={anio}
                onChange={(event) => setAnio(Number(event.target.value))}
              >
                {ANIOS_DISPONIBLES.map((valor) => (
                  <option value={valor} key={valor}>{valor}</option>
                ))}
              </select>
            </label>
          </div>
          <Link
            className="home-payment-checklist-link"
            to={`/analisis?mes=${mes}&anio=${anio}`}
          >
            {!cargando && totalConfigurados === 0
              ? "Configurar checklist"
              : "Ver detalle"}
          </Link>
        </div>
      </header>

      {cargando ? (
        <div className="home-payment-checklist-status" role="status">
          <span className="home-payment-checklist-loading-mark" aria-hidden="true" />
          <span>
            <strong>Consultando {MESES[mes - 1]} de {anio}…</strong>
            <small>Buscando cada subcategoría en todas tus cuentas.</small>
          </span>
        </div>
      ) : error ? (
        <div className="home-payment-checklist-status is-error" role="status">
          <span>
            <strong>No se pudo cargar este período.</strong>
            <small>Podés elegir otro mes o abrir el detalle para volver a intentarlo.</small>
          </span>
        </div>
      ) : totalConfigurados > 0 ? (
        <>
          {resumen.total > 0 && (
            <>
              <div className="home-payment-checklist-progress-copy">
                <strong>{resumen.pagados} de {resumen.total} pagados</strong>
                <span>{porcentaje}%</span>
              </div>
              <div
                className="home-payment-checklist-progress"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax={resumen.total}
                aria-valuenow={resumen.pagados}
                aria-label="Progreso de pagos mensuales"
              >
                <span style={{ width: `${porcentaje}%` }} />
              </div>
            </>
          )}

          <div className="home-payment-checklist-items">
            {controles.map((control) => {
              const pagado = control.estado === "pagado";
              return (
                <div className={`home-payment-checklist-item status-${control.estado}`} key={control._id}>
                  <span
                    className={`monthly-payment-checkbox ${pagado ? "is-checked" : ""}`}
                    role="checkbox"
                    aria-checked={pagado}
                    aria-readonly="true"
                    aria-label={`${control.nombre}: ${ESTADOS[control.estado]}`}
                  >
                    {pagado ? "✓" : control.estado === "omitido" ? "—" : ""}
                  </span>
                  <span>
                    <strong>{control.nombre}</strong>
                    <small>{ESTADOS[control.estado]}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {!cargando && !error && (
        <small className="home-payment-checklist-help">
          Los checks se completan automáticamente al crear un movimiento con esa subcategoría.
        </small>
      )}
    </section>
  );
}
