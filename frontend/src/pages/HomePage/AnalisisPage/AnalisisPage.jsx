import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { NavegacionSecciones } from "../../../components/NavegacionSecciones.jsx";
import SearchableSubcategorySelect from "../../../components/SearchableSubcategorySelect.jsx";
import { api } from "../../../services/api.js";

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
const TODOS_LOS_MESES = Array.from({ length: 12 }, (_, indice) => indice + 1);
const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const ESTADOS = {
  pagado: {
    etiqueta: "Pagado",
    descripcion: "Hay al menos un gasto creado con esta subcategoría.",
  },
  pendiente: {
    etiqueta: "Pendiente de crear",
    descripcion: "Encontramos el movimiento, pero todavía está pendiente.",
  },
  no_encontrado: {
    etiqueta: "No encontrado",
    descripcion: "No aparece un movimiento con esta subcategoría en el mes.",
  },
  omitido: {
    etiqueta: "No corresponde",
    descripcion: "Este pago no forma parte del control para el período seleccionado.",
  },
};

const formatearFecha = (valor) => {
  if (!valor) return "Sin fecha";
  return new Intl.DateTimeFormat("es-UY", { timeZone: "UTC" }).format(
    new Date(valor),
  );
};

const formatearMonto = (moneda, valor) => {
  const simbolo = moneda === "USD" ? "US$" : moneda === "UI" ? "UI" : "$";
  return `${simbolo} ${Number(valor || 0).toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const describirCalendario = (meses = TODOS_LOS_MESES) => {
  if (meses.length === 12) return "Todos los meses";
  if (meses.length === 1) return `Solo ${MESES[meses[0] - 1]}`;
  return meses.map((numeroMes) => MESES_CORTOS[numeroMes - 1]).join(", ");
};

function SelectorMeses({ value, onChange }) {
  const alternarMes = (numeroMes) => {
    const siguientes = value.includes(numeroMes)
      ? value.filter((mesElegido) => mesElegido !== numeroMes)
      : [...value, numeroMes].sort((a, b) => a - b);
    onChange(siguientes);
  };

  return (
    <fieldset className="payment-analysis-month-selector">
      <legend>Meses en los que corresponde</legend>
      <div>
        {MESES_CORTOS.map((nombreMes, indice) => {
          const numeroMes = indice + 1;
          return (
            <label key={nombreMes}>
              <input
                type="checkbox"
                checked={value.includes(numeroMes)}
                onChange={() => alternarMes(numeroMes)}
              />
              <span>{nombreMes}</span>
            </label>
          );
        })}
      </div>
      <small>
        {value.length
          ? describirCalendario(value)
          : "Seleccioná al menos un mes."}
      </small>
    </fieldset>
  );
}

function AnalisisPage() {
  const contextoLayout = useOutletContext();
  const [parametrosBusqueda] = useSearchParams();
  const menuAbierto = contextoLayout?.menuAbierto || false;
  const mesSolicitado = Number(parametrosBusqueda.get("mes"));
  const anioSolicitado = Number(parametrosBusqueda.get("anio"));
  const [anio, setAnio] = useState(
    ANIOS_DISPONIBLES.includes(anioSolicitado) ? anioSolicitado : ANIO_ACTUAL,
  );
  const [mes, setMes] = useState(
    mesSolicitado >= 1 && mesSolicitado <= 12 ? mesSolicitado : MES_ACTUAL,
  );
  const [analisis, setAnalisis] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombre, setNombre] = useState("");
  const [subcategoriaId, setSubcategoriaId] = useState("");
  const [mesesActivos, setMesesActivos] = useState(TODOS_LOS_MESES);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState("");
  const [nombreEdicion, setNombreEdicion] = useState("");
  const [subcategoriaEdicionId, setSubcategoriaEdicionId] = useState("");
  const [mesesEdicion, setMesesEdicion] = useState(TODOS_LOS_MESES);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoId, setEliminandoId] = useState("");
  const [actualizandoPeriodoId, setActualizandoPeriodoId] = useState("");
  const [asignandoControl, setAsignandoControl] = useState(null);
  const [candidatosPago, setCandidatosPago] = useState([]);
  const [candidatoPagoId, setCandidatoPagoId] = useState("");
  const [cargandoCandidatos, setCargandoCandidatos] = useState(false);
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);

  const cargarAnalisis = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const response = await api.get("/analisis", { params: { anio, mes } });
      setAnalisis(response.data.analisis);
    } catch (solicitudError) {
      console.error("No se pudo cargar el control mensual:", solicitudError);
      setError("No se pudo consultar el control mensual. Intentá nuevamente.");
    } finally {
      setCargando(false);
    }
  }, [anio, mes]);

  useEffect(() => {
    cargarAnalisis();
  }, [cargarAnalisis]);

  const limpiarFormulario = () => {
    setNombre("");
    setSubcategoriaId("");
    setMesesActivos(TODOS_LOS_MESES);
    setMostrarFormulario(false);
  };

  const agregarControl = async (event) => {
    event.preventDefault();
    if (!subcategoriaId || !mesesActivos.length) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await api.post("/analisis/controles", {
        nombre,
        subcategoriaId,
        mesesActivos,
      });
      limpiarFormulario();
      setMensaje("Pago mensual agregado al control.");
      await cargarAnalisis();
    } catch (solicitudError) {
      console.error("No se pudo agregar el pago mensual:", solicitudError);
      setError(
        solicitudError.response?.data?.message
        || "No se pudo agregar el pago mensual.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const agregarSugerencias = async () => {
    const ids = (analisis?.sugerencias || []).map((item) => item._id);
    if (!ids.length) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await api.post("/analisis/controles/varios", { subcategoriaIds: ids });
      setMensaje(`${ids.length} pagos habituales agregados al control.`);
      await cargarAnalisis();
    } catch (solicitudError) {
      console.error("No se pudieron agregar las sugerencias:", solicitudError);
      setError(
        solicitudError.response?.data?.message
        || "No se pudieron agregar los pagos sugeridos.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const iniciarEdicion = (control) => {
    setEditandoId(control._id);
    setNombreEdicion(control.nombre);
    setSubcategoriaEdicionId(control.subcategoria._id);
    setMesesEdicion(control.mesesActivos || TODOS_LOS_MESES);
    setError("");
    setMensaje("");
  };

  const cancelarEdicion = () => {
    setEditandoId("");
    setNombreEdicion("");
    setSubcategoriaEdicionId("");
    setMesesEdicion(TODOS_LOS_MESES);
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();
    if (!editandoId || !subcategoriaEdicionId || !mesesEdicion.length) return;
    setGuardandoEdicion(true);
    setError("");
    setMensaje("");
    try {
      await api.patch(`/analisis/controles/${editandoId}`, {
        nombre: nombreEdicion,
        subcategoriaId: subcategoriaEdicionId,
        mesesActivos: mesesEdicion,
      });
      cancelarEdicion();
      setMensaje("Pago mensual actualizado. Ningún gasto fue modificado.");
      await cargarAnalisis();
    } catch (solicitudError) {
      console.error("No se pudo editar el pago mensual:", solicitudError);
      setError(
        solicitudError.response?.data?.message
        || "No se pudo editar el pago mensual.",
      );
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const cambiarExcepcionPeriodo = async (control, omitido) => {
    if (omitido) {
      const confirmar = window.confirm(
        `¿Dejar de controlar “${control.nombre}” solamente en ${MESES[mes - 1]} de ${anio}?`,
      );
      if (!confirmar) return;
    }
    setActualizandoPeriodoId(control._id);
    setError("");
    setMensaje("");
    try {
      await api.put(`/analisis/controles/${control._id}/excepcion`, {
        anio,
        mes,
        omitido,
      });
      setMensaje(omitido
        ? `“${control.nombre}” no se controlará en ${MESES[mes - 1]} de ${anio}.`
        : `“${control.nombre}” volvió al checklist de ${MESES[mes - 1]} de ${anio}.`);
      await cargarAnalisis();
    } catch (solicitudError) {
      console.error("No se pudo actualizar el período del pago:", solicitudError);
      setError(
        solicitudError.response?.data?.message
        || "No se pudo actualizar el control de este período.",
      );
    } finally {
      setActualizandoPeriodoId("");
    }
  };

  const abrirAsignacionPago = async (control) => {
    setAsignandoControl(control);
    setCandidatosPago([]);
    setCandidatoPagoId("");
    setCargandoCandidatos(true);
    setError("");
    setMensaje("");
    try {
      const response = await api.get(
        `/analisis/controles/${control._id}/candidatos`,
        { params: { anio, mes } },
      );
      setCandidatosPago(response.data.movimientos || []);
    } catch (solicitudError) {
      console.error("No se pudieron cargar movimientos para asignar:", solicitudError);
      setError(
        solicitudError.response?.data?.message
        || "No se pudieron buscar pagos de otros meses.",
      );
      setAsignandoControl(null);
    } finally {
      setCargandoCandidatos(false);
    }
  };

  const cerrarAsignacionPago = () => {
    if (guardandoAsignacion) return;
    setAsignandoControl(null);
    setCandidatosPago([]);
    setCandidatoPagoId("");
  };

  const guardarAsignacionPago = async () => {
    if (!asignandoControl || !candidatoPagoId) return;
    setGuardandoAsignacion(true);
    setError("");
    setMensaje("");
    try {
      await api.put(`/analisis/controles/${asignandoControl._id}/asignacion`, {
        anio,
        mes,
        gastoId: candidatoPagoId,
      });
      const nombreControl = asignandoControl.nombre;
      cerrarAsignacionPago();
      setMensaje(
        `Pago asignado a “${nombreControl}” para ${MESES[mes - 1]} de ${anio}.`,
      );
      await cargarAnalisis();
    } catch (solicitudError) {
      console.error("No se pudo asignar el pago al período:", solicitudError);
      setError(
        solicitudError.response?.data?.message
        || "No se pudo asignar el movimiento al período.",
      );
    } finally {
      setGuardandoAsignacion(false);
    }
  };

  const quitarAsignacionPago = async (control) => {
    const confirmar = window.confirm(
      `¿Desvincular el pago asignado a ${MESES[mes - 1]} de ${anio}? El movimiento no se eliminará.`,
    );
    if (!confirmar) return;
    setActualizandoPeriodoId(control._id);
    setError("");
    setMensaje("");
    try {
      await api.delete(`/analisis/controles/${control._id}/asignacion`, {
        params: { anio, mes },
      });
      setMensaje("La asignación se quitó. El movimiento original no fue modificado.");
      await cargarAnalisis();
    } catch (solicitudError) {
      console.error("No se pudo quitar la asignación del pago:", solicitudError);
      setError("No se pudo quitar la asignación del período.");
    } finally {
      setActualizandoPeriodoId("");
    }
  };

  const eliminarControl = async (control) => {
    const confirmar = window.confirm(
      `Esto eliminará “${control.nombre}” de TODOS los meses y años.\n\n`
      + `Para excluirlo únicamente de ${MESES[mes - 1]} de ${anio}, usá “Omitir ${MESES[mes - 1]} ${anio}”.\n\n`
      + "¿Querés eliminar igualmente el control completo?",
    );
    if (!confirmar) return;
    setEliminandoId(control._id);
    setError("");
    setMensaje("");
    try {
      await api.delete(`/analisis/controles/${control._id}`);
      setMensaje("El control fue quitado. Ningún gasto fue modificado.");
      await cargarAnalisis();
    } catch (solicitudError) {
      console.error("No se pudo quitar el control:", solicitudError);
      setError("No se pudo quitar el pago del control mensual.");
    } finally {
      setEliminandoId("");
    }
  };

  const resumen = analisis?.resumen || {
    total: 0,
    totalConfigurados: 0,
    omitidos: 0,
    pagados: 0,
    pendientes: 0,
    noEncontrados: 0,
  };

  return (
    <section className="page-section analysis-page payment-analysis-page">
      <nav
        className="expense-floating-actions secondary-sidebar-actions section-navigation-only"
        aria-label="Navegación del análisis"
        onMouseEnter={menuAbierto ? contextoLayout?.alEntrarMenu : undefined}
        onMouseLeave={menuAbierto ? contextoLayout?.alSalirMenu : undefined}
      >
        <NavegacionSecciones
          secciones={[
            { id: "analisis-control", etiqueta: "Checklist del mes" },
            { id: "analisis-configuracion", etiqueta: "Configurar pagos" },
          ]}
        />
      </nav>

      <header className="page-header analysis-header">
        <div>
          <span className="page-eyebrow">Recordatorio mensual</span>
          <h1>Checklist de pagos</h1>
          <p>
            Revisá qué servicios ya pagaste y cuáles siguen sin aparecer en tus cuentas.
          </p>
        </div>
        <span className="payment-analysis-readonly-badge">Detección automática</span>
      </header>

      <section className="analysis-period-panel payment-analysis-period">
        <label>
          Mes
          <select value={mes} onChange={(event) => setMes(Number(event.target.value))}>
            {MESES.map((nombreMes, indice) => (
              <option value={indice + 1} key={nombreMes}>{nombreMes}</option>
            ))}
          </select>
        </label>
        <label>
          Año
          <select value={anio} onChange={(event) => setAnio(Number(event.target.value))}>
            {ANIOS_DISPONIBLES.map((valor) => (
              <option value={valor} key={valor}>{valor}</option>
            ))}
          </select>
        </label>
        <div className="analysis-period-description">
          <small>Consultando</small>
          <strong>{MESES[mes - 1]} de {anio} · Todas las cuentas</strong>
        </div>
      </section>

      <aside className="payment-analysis-explanation">
        <strong>¿Cómo funciona?</strong>
        <p>
          Elegís una subcategoría y los meses en los que corresponde pagarla.
          La aplicación marca el check con el movimiento del mes, o con otro
          movimiento que vos asignes al período. También podés omitir un caso puntual.
        </p>
      </aside>

      {error && <p className="detail-feedback inline-error">{error}</p>}
      {mensaje && <p className="detail-feedback">{mensaje}</p>}
      {cargando && <p className="analysis-loading">Consultando tus pagos…</p>}

      {!cargando && analisis && (
        <>
          <section
            id="analisis-control"
            className="page-scroll-section payment-analysis-summary"
            aria-label="Resumen del control mensual"
          >
            <article>
              <small>Items del checklist</small>
              <strong>{resumen.totalConfigurados ?? resumen.total}</strong>
              {resumen.omitidos > 0 && <small>{resumen.omitidos} no corresponden este mes</small>}
            </article>
            <article className="is-success">
              <small>Pagados</small>
              <strong>{resumen.pagados}</strong>
            </article>
            <article className="is-pending">
              <small>Pendientes de crear</small>
              <strong>{resumen.pendientes}</strong>
            </article>
            <article className="is-missing">
              <small>No encontrados</small>
              <strong>{resumen.noEncontrados}</strong>
            </article>
          </section>

          <section className="analysis-panel payment-analysis-controls">
            <header className="analysis-panel-header">
              <div>
                <span className="page-eyebrow">{MESES[mes - 1]} de {anio}</span>
                <h2>Pagos del mes</h2>
                <p>Un check se completa cuando encontramos un gasto creado con esa subcategoría.</p>
              </div>
              <button type="button" onClick={() => setMostrarFormulario(true)}>
                Agregar pago mensual
              </button>
            </header>

            {analisis.controles.length === 0 ? (
              <div className="payment-analysis-empty">
                <strong>Empezá armando tu lista mensual</strong>
                <p>
                  Agregá Alquiler, UTE, OSE, Wi-Fi, Cuota Auto, BPS-Fonasa,
                  Mutualista, Contador, Facturación Electrónica, Patente,
                  Antel Móvil u ORT usando sus subcategorías.
                </p>
                <button type="button" onClick={() => setMostrarFormulario(true)}>
                  Agregar el primer pago
                </button>
              </div>
            ) : (
              <div className="payment-analysis-list">
                {analisis.controles.map((control) => {
                  const estado = ESTADOS[control.estado];
                  const estaEditando = editandoId === control._id;
                  return (
                    <article className="payment-analysis-item" key={control._id}>
                      {estaEditando ? (
                        <form
                          className="payment-analysis-edit-form"
                          onSubmit={guardarEdicion}
                        >
                          <label>
                            Nombre del pago
                            <input
                              type="text"
                              value={nombreEdicion}
                              maxLength="80"
                              onChange={(event) => setNombreEdicion(event.target.value)}
                            />
                          </label>
                          <label>
                            Subcategoría que debe buscar
                            <SearchableSubcategorySelect
                              subcategorias={analisis.subcategoriasDisponibles}
                              value={subcategoriaEdicionId}
                              onChange={setSubcategoriaEdicionId}
                              className="payment-analysis-select"
                              placeholder="Seleccionar subcategoría"
                              ariaLabel={`Subcategoría de ${control.nombre}`}
                            />
                          </label>
                          <SelectorMeses
                            value={mesesEdicion}
                            onChange={setMesesEdicion}
                          />
                          <div className="payment-analysis-edit-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={guardandoEdicion}
                              onClick={cancelarEdicion}
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={
                                guardandoEdicion
                                || !subcategoriaEdicionId
                                || !mesesEdicion.length
                              }
                            >
                              {guardandoEdicion ? "Guardando…" : "Guardar cambios"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="payment-analysis-item-main">
                          <div className="payment-analysis-check-status">
                            <span
                              className={`monthly-payment-checkbox ${control.estado === "pagado" ? "is-checked" : ""}`}
                              role="checkbox"
                              aria-checked={control.estado === "pagado"}
                              aria-readonly="true"
                              aria-label={`${control.nombre}: ${estado.etiqueta}`}
                            >
                              {control.estado === "pagado"
                                ? "✓"
                                : control.estado === "omitido"
                                  ? "—"
                                  : ""}
                            </span>
                            <span className={`analysis-status-chip status-${control.estado}`}>
                              {estado.etiqueta}
                            </span>
                          </div>
                          <div>
                            <h3>{control.nombre}</h3>
                            <p>
                              Busca la subcategoría <strong>{control.subcategoria.nombre}</strong>
                              {" "}en todas tus cuentas.
                            </p>
                            <small>
                              {control.motivoOmision === "fuera_calendario"
                                ? `Calendario: ${describirCalendario(control.mesesActivos)}.`
                                : estado.descripcion}
                            </small>
                            {control.estado !== "omitido" && (
                              <small>Calendario: {describirCalendario(control.mesesActivos)}.</small>
                            )}
                          </div>
                          <div className="payment-analysis-item-actions">
                            {control.estado !== "omitido" && control.estado !== "pagado" && (
                              <button
                                type="button"
                                onClick={() => abrirAsignacionPago(control)}
                              >
                                Usar pago de otro mes
                              </button>
                            )}
                            {control.pagoAsignado && (
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={actualizandoPeriodoId === control._id}
                                onClick={() => quitarAsignacionPago(control)}
                              >
                                Quitar asignación
                              </button>
                            )}
                            {control.motivoOmision === "excepcion_periodo" ? (
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={actualizandoPeriodoId === control._id}
                                onClick={() => cambiarExcepcionPeriodo(control, false)}
                              >
                                Incluir {MESES[mes - 1]} {anio}
                              </button>
                            ) : control.motivoOmision !== "fuera_calendario" ? (
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={actualizandoPeriodoId === control._id}
                                onClick={() => cambiarExcepcionPeriodo(control, true)}
                              >
                                Omitir {MESES[mes - 1]} {anio}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => iniciarEdicion(control)}
                            >
                              Configurar meses
                            </button>
                            <button
                              type="button"
                              className="secondary-button payment-analysis-remove"
                              disabled={eliminandoId === control._id}
                              onClick={() => eliminarControl(control)}
                            >
                              {eliminandoId === control._id
                                ? "Eliminando…"
                                : "Eliminar de todos los períodos"}
                            </button>
                          </div>
                        </div>
                      )}

                      {control.coincidencias.length > 0 && (
                        <details className="payment-analysis-matches" open>
                          <summary>
                            {control.coincidencias.length === 1
                              ? "1 movimiento encontrado"
                              : `${control.coincidencias.length} movimientos encontrados`}
                          </summary>
                          <div>
                            {control.coincidencias.map((movimiento) => (
                              <Link
                                to={`/cuentas/${movimiento.cuentaId}/gastos/gasto/${movimiento.gastoId}`}
                                className="payment-analysis-match"
                                key={movimiento.gastoId}
                              >
                                <span>
                                  <strong>{movimiento.detalle}</strong>
                                  <small>
                                    {movimiento.cuenta} · {formatearFecha(movimiento.fecha)}
                                    {movimiento.estado === "pendiente" ? " · Pendiente" : ""}
                                    {movimiento.asignadoAlPeriodo
                                      ? ` · Asignado a ${MESES[mes - 1]} de ${anio}`
                                      : ""}
                                  </small>
                                </span>
                                <strong>{formatearMonto(movimiento.moneda, movimiento.monto)}</strong>
                              </Link>
                            ))}
                          </div>
                        </details>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section
            id="analisis-configuracion"
            className="analysis-panel page-scroll-section payment-analysis-setup"
          >
            <header className="analysis-panel-header">
              <div>
                <span className="page-eyebrow">Configuración independiente</span>
                <h2>Pagos a controlar</h2>
                <p>Elegí la subcategoría y en qué meses debe aparecer en el checklist.</p>
              </div>
            </header>

            {analisis.sugerencias.length > 0 && (
              <div className="payment-analysis-suggestions">
                <div>
                  <strong>Sugerencias encontradas en tus subcategorías</strong>
                  <p>{analisis.sugerencias.map((item) => item.nombreSubcategoria).join(" · ")}</p>
                </div>
                <button type="button" disabled={guardando} onClick={agregarSugerencias}>
                  {guardando
                    ? "Agregando…"
                    : `Agregar sugeridos (${analisis.sugerencias.length})`}
                </button>
              </div>
            )}

            {mostrarFormulario ? (
              <form className="payment-analysis-form" onSubmit={agregarControl}>
                <label>
                  Nombre del pago
                  <input
                    type="text"
                    value={nombre}
                    maxLength="80"
                    placeholder="Ej.: UTE"
                    onChange={(event) => setNombre(event.target.value)}
                  />
                  <small>Es opcional; si queda vacío usamos el nombre de la subcategoría.</small>
                </label>
                <label>
                  Subcategoría que debe aparecer
                  <SearchableSubcategorySelect
                    subcategorias={analisis.subcategoriasDisponibles}
                    value={subcategoriaId}
                    onChange={setSubcategoriaId}
                    className="payment-analysis-select"
                    placeholder="Seleccionar subcategoría"
                    ariaLabel="Seleccionar subcategoría del pago mensual"
                  />
                </label>
                <SelectorMeses value={mesesActivos} onChange={setMesesActivos} />
                <div className="payment-analysis-form-actions">
                  <button type="button" className="secondary-button" onClick={limpiarFormulario}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando || !subcategoriaId || !mesesActivos.length}
                  >
                    {guardando ? "Guardando…" : "Agregar al control"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="secondary-button payment-analysis-add-secondary"
                onClick={() => setMostrarFormulario(true)}
              >
                Agregar otra subcategoría
              </button>
            )}
          </section>
        </>
      )}

      {asignandoControl && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cerrarAsignacionPago();
          }}
        >
          <form
            className="modal-panel payment-assignment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-assignment-title"
            onSubmit={(event) => {
              event.preventDefault();
              guardarAsignacionPago();
            }}
          >
            <header className="modal-header">
              <div>
                <span className="page-eyebrow">Pago realizado en otra fecha</span>
                <h2 id="payment-assignment-title">
                  Completar {MESES[mes - 1]} de {anio}
                </h2>
                <p>
                  Elegí qué movimiento de {asignandoControl.nombre} corresponde
                  a este período. Su fecha bancaria no cambiará.
                </p>
              </div>
            </header>

            <div className="payment-assignment-body">
              {cargandoCandidatos ? (
                <p className="analysis-loading">Buscando pagos creados…</p>
              ) : candidatosPago.length === 0 ? (
                <div className="payment-analysis-empty">
                  <strong>No encontramos movimientos disponibles</strong>
                  <p>
                    Primero creá o clasificá el pago con la subcategoría
                    {" "}<strong>{asignandoControl.subcategoria.nombre}</strong>.
                  </p>
                </div>
              ) : (
                <div className="payment-assignment-list">
                  {candidatosPago.map((movimiento) => (
                    <label
                      className={candidatoPagoId === movimiento.gastoId ? "is-selected" : ""}
                      key={movimiento.gastoId}
                    >
                      <input
                        type="radio"
                        name="movimientoPago"
                        value={movimiento.gastoId}
                        checked={candidatoPagoId === movimiento.gastoId}
                        onChange={(event) => setCandidatoPagoId(event.target.value)}
                      />
                      <span>
                        <strong>{movimiento.detalle}</strong>
                        <small>
                          {movimiento.cuenta} · {formatearFecha(movimiento.fecha)}
                        </small>
                      </span>
                      <strong>{formatearMonto(movimiento.moneda, movimiento.monto)}</strong>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <footer className="payment-assignment-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={guardandoAsignacion}
                onClick={cerrarAsignacionPago}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoAsignacion || !candidatoPagoId}
              >
                {guardandoAsignacion ? "Asignando…" : "Asignar a este período"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

export default AnalisisPage;
