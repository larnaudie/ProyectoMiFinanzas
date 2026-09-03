import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ESTADOS = {
  pagado: "Pagado",
  pendiente: "Pendiente de completar",
  no_encontrado: "No detectado",
};

export function MonthlyPaymentChecklist() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth() + 1;
  const [analisis, setAnalisis] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;

    api.get("/analisis", { params: { anio, mes } })
      .then((response) => {
        if (activo) setAnalisis(response.data.analisis || null);
      })
      .catch((solicitudError) => {
        console.error("No se pudo cargar el checklist mensual:", solicitudError);
        if (activo) setError(true);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [anio, mes]);

  if (cargando) {
    return (
      <section className="home-payment-checklist is-loading" aria-live="polite">
        <span className="home-payment-checklist-loading-mark" aria-hidden="true" />
        <div>
          <strong>Revisando tus pagos de {MESES[mes - 1]}…</strong>
          <small>Buscando las subcategorías de tu checklist.</small>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="home-payment-checklist is-error" role="status">
        <div>
          <strong>No pudimos revisar los pagos de este mes.</strong>
          <small>Podés consultar el checklist completo desde su sección.</small>
        </div>
        <Link to="/analisis">Abrir checklist</Link>
      </section>
    );
  }

  const controles = analisis?.controles || [];
  const resumen = analisis?.resumen || {
    total: 0,
    pagados: 0,
    pendientes: 0,
    noEncontrados: 0,
  };
  const cantidadSinConfirmar = resumen.total - resumen.pagados;
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
          <h2 id="home-payment-checklist-title">Checklist de {MESES[mes - 1]}</h2>
          {resumen.total === 0 ? (
            <p>Todavía no configuraste pagos mensuales para controlar.</p>
          ) : todoPago ? (
            <p>Todo al día: encontramos todos los pagos de este mes.</p>
          ) : (
            <p>
              Atención: todavía no encontramos {cantidadSinConfirmar}
              {cantidadSinConfirmar === 1 ? " pago" : " pagos"} de este mes.
            </p>
          )}
        </div>
        <Link to="/analisis">
          {resumen.total === 0 ? "Configurar checklist" : "Ver detalle"}
        </Link>
      </header>

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
                    {pagado ? "✓" : ""}
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
      )}

      <small className="home-payment-checklist-help">
        Los checks se completan automáticamente al crear un movimiento con esa subcategoría.
      </small>
    </section>
  );
}
