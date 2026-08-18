import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
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

function AnalisisPage() {
  const contextoLayout = useOutletContext();
  const menuAbierto = contextoLayout?.menuAbierto || false;
  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [mes, setMes] = useState(MES_ACTUAL);
  const [analisis, setAnalisis] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombre, setNombre] = useState("");
  const [subcategoriaId, setSubcategoriaId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState("");
  const [nombreEdicion, setNombreEdicion] = useState("");
  const [subcategoriaEdicionId, setSubcategoriaEdicionId] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoId, setEliminandoId] = useState("");

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
    setMostrarFormulario(false);
  };

  const agregarControl = async (event) => {
    event.preventDefault();
    if (!subcategoriaId) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await api.post("/analisis/controles", { nombre, subcategoriaId });
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
    setError("");
    setMensaje("");
  };

  const cancelarEdicion = () => {
    setEditandoId("");
    setNombreEdicion("");
    setSubcategoriaEdicionId("");
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();
    if (!editandoId || !subcategoriaEdicionId) return;
    setGuardandoEdicion(true);
    setError("");
    setMensaje("");
    try {
      await api.patch(`/analisis/controles/${editandoId}`, {
        nombre: nombreEdicion,
        subcategoriaId: subcategoriaEdicionId,
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

  const eliminarControl = async (control) => {
    const confirmar = window.confirm(
      `¿Quitar “${control.nombre}” del control mensual? El gasto no se eliminará.`,
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
            { id: "analisis-control", etiqueta: "Control del mes" },
            { id: "analisis-configuracion", etiqueta: "Configurar pagos" },
          ]}
        />
      </nav>

      <header className="page-header analysis-header">
        <div>
          <span className="page-eyebrow">Consulta mensual</span>
          <h1>Análisis</h1>
          <p>
            Revisá si tus pagos habituales aparecen en alguna de tus cuentas,
            de forma simple y sin modificar tus gastos.
          </p>
        </div>
        <span className="payment-analysis-readonly-badge">Solo consulta</span>
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
          Elegís una subcategoría para cada pago mensual. La aplicación busca
          movimientos de esa subcategoría durante el mes en todas tus cuentas.
          Esta pantalla no cambia montos, estados ni clasificaciones.
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
              <small>Pagos controlados</small>
              <strong>{resumen.total}</strong>
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
                <h2>Mis pagos mensuales</h2>
                <p>“No encontrado” significa que conviene revisarlo; no confirma una deuda.</p>
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
                              disabled={guardandoEdicion || !subcategoriaEdicionId}
                            >
                              {guardandoEdicion ? "Guardando…" : "Guardar cambios"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="payment-analysis-item-main">
                          <span className={`analysis-status-chip status-${control.estado}`}>
                            {estado.etiqueta}
                          </span>
                          <div>
                            <h3>{control.nombre}</h3>
                            <p>
                              Busca la subcategoría <strong>{control.subcategoria.nombre}</strong>
                              {" "}en todas tus cuentas.
                            </p>
                            <small>{estado.descripcion}</small>
                          </div>
                          <div className="payment-analysis-item-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => iniciarEdicion(control)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="secondary-button payment-analysis-remove"
                              disabled={eliminandoId === control._id}
                              onClick={() => eliminarControl(control)}
                            >
                              {eliminandoId === control._id ? "Quitando…" : "Quitar control"}
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
                <p>Solo guardamos qué subcategorías querés consultar cada mes.</p>
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
                <div className="payment-analysis-form-actions">
                  <button type="button" className="secondary-button" onClick={limpiarFormulario}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardando || !subcategoriaId}>
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
    </section>
  );
}

export default AnalisisPage;
