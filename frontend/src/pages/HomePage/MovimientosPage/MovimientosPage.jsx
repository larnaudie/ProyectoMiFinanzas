import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ExpenseFiltersPanel from "../../../components/ExpenseFiltersPanel.jsx";
import SortableTableHeader from "../../../components/SortableTableHeader.jsx";
import { useSortableRows } from "../../../hooks/useSortableRows.js";
import { api } from "../../../services/api.js";
import {
  crearFiltrosGastosIniciales,
  fechaParaInput,
  filtrarGastos,
  obtenerFechaActualParaFiltro,
  obtenerId,
} from "../../../utils/filtrosGastos.js";
import {
  formatearMontoMoneda,
  MONEDAS_SOPORTADAS,
  obtenerMonedaMovimiento,
} from "../../../utils/monedas.js";

const columnasOrdenables = {
  cuenta: {
    type: "text",
    getValue: (gasto) => gasto.cuenta?.nombreCuenta || "",
  },
  fecha: { type: "date" },
  detalle: { type: "text" },
  montoBancario: { type: "number" },
  montoReal: { type: "number" },
};

const nombreRelacionado = (valor, campo, alternativa) => {
  if (valor && typeof valor === "object") return valor[campo] || alternativa;
  return alternativa;
};

const formatearFecha = (fecha) => {
  const [anio, mes, dia] = fechaParaInput(fecha).split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : "Sin fecha";
};

function MovimientosPage() {
  const [gastos, setGastos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [vistaLista, setVistaLista] = useState("puntual");
  const [filtros, setFiltros] = useState(() =>
    crearFiltrosGastosIniciales({ incluirFiltrosGlobales: true }),
  );

  useEffect(() => {
    let solicitudActiva = true;
    setCargando(true);
    setError("");

    Promise.all([
      api.get("/gastos"),
      api.get("/cuentas"),
      api.get("/categorias"),
      api.get("/subcategorias"),
    ])
      .then(([respuestaGastos, respuestaCuentas, respuestaCategorias, respuestaSubcategorias]) => {
        if (!solicitudActiva) return;
        setGastos(respuestaGastos.data.gastos || []);
        setCuentas(respuestaCuentas.data.cuentas || []);
        setCategorias(respuestaCategorias.data.categorias || []);
        setSubcategorias(respuestaSubcategorias.data.subcategorias || []);
      })
      .catch((solicitudError) => {
        console.error("No se pudieron cargar los movimientos globales:", solicitudError);
        if (solicitudActiva) {
          setError("No se pudieron cargar tus movimientos. Intenta nuevamente.");
        }
      })
      .finally(() => {
        if (solicitudActiva) setCargando(false);
      });

    return () => {
      solicitudActiva = false;
    };
  }, []);

  const cuentasPorId = useMemo(
    () => new Map(cuentas.map((cuenta) => [cuenta._id, cuenta])),
    [cuentas],
  );

  const gastosConCuenta = useMemo(
    () => gastos.map((gasto) => ({
      ...gasto,
      cuenta: gasto?.cuentaId && typeof gasto.cuentaId === "object"
        ? gasto.cuentaId
        : cuentasPorId.get(obtenerId(gasto?.cuentaId)) || null,
    })),
    [cuentasPorId, gastos],
  );

  const aniosDisponibles = useMemo(() => [
    ...new Set([
      obtenerFechaActualParaFiltro().anio,
      ...gastosConCuenta
        .map((gasto) => fechaParaInput(gasto.fecha).slice(0, 4))
        .filter(Boolean),
    ]),
  ].sort().reverse(), [gastosConCuenta]);

  const gastosFiltrados = useMemo(
    () => filtrarGastos(gastosConCuenta, filtros, {
      obtenerCuenta: (gasto) => gasto.cuenta,
    }),
    [filtros, gastosConCuenta],
  );

  const orden = useSortableRows(gastosFiltrados, columnasOrdenables);

  const totalesPorMoneda = useMemo(() => {
    const totales = Object.fromEntries(
      MONEDAS_SOPORTADAS.map((moneda) => [moneda, {
        cantidad: 0,
        montoBancario: 0,
        montoReal: 0,
      }]),
    );

    gastosFiltrados.forEach((gasto) => {
      const moneda = obtenerMonedaMovimiento(gasto.cuenta, gasto.moneda);
      if (!totales[moneda]) return;
      totales[moneda].cantidad += 1;
      totales[moneda].montoBancario += Number(gasto.montoBancario || 0);
      if (gasto.incluirMontoReal === true && gasto.cuenta?.tipoCuenta !== "credito") {
        totales[moneda].montoReal += Number(gasto.montoReal || 0);
      }
    });

    return totales;
  }, [gastosFiltrados]);

  const monedasVisibles = MONEDAS_SOPORTADAS.filter(
    (moneda) => totalesPorMoneda[moneda].cantidad > 0,
  );
  const cantidadPendientes = gastosFiltrados.filter(
    (gasto) => gasto.estado === "pendiente",
  ).length;

  const cambiarFiltro = (campo, valor) => {
    setFiltros((actual) => {
      if (campo === "fechaModo" && valor === "mes") {
        return {
          ...actual,
          fechaModo: valor,
          fechaAnio: actual.fechaAnio || obtenerFechaActualParaFiltro().anio,
        };
      }
      return { ...actual, [campo]: valor };
    });
  };

  const limpiarFiltros = () => {
    setFiltros(crearFiltrosGastosIniciales({ incluirFiltrosGlobales: true }));
  };

  return (
    <section className="page-section global-movements-page">
      <header className="page-header global-movements-header">
        <div>
          <span className="page-eyebrow">Dinero que entra y sale</span>
          <h1>Movimientos</h1>
          <p>
            Buscá, filtrá y recorré los gastos sin perder el contexto de la cuenta elegida.
          </p>
        </div>
      </header>

      <nav className="movements-context-tabs" aria-label="Vistas de movimientos">
        <a className="active" href="#lista-movimientos">Lista</a>
        <a href="#resultados-movimientos">Ahorros</a>
        <Link to="/dashboard">Comparaciones</Link>
      </nav>

      <ExpenseFiltersPanel
        id="filtros-movimientos"
        filtros={filtros}
        onChange={cambiarFiltro}
        onClear={limpiarFiltros}
        cantidadVisible={gastosFiltrados.length}
        categorias={categorias}
        subcategorias={subcategorias}
        cuentas={cuentas}
        aniosDisponibles={aniosDisponibles}
        mostrarCuenta
        mostrarEstado
        mostrarMoneda
        mostrarIncluye
      />

      {error && <p className="detail-feedback inline-error global-movements-error">{error}</p>}

      <section
        id="resultados-movimientos"
        className="global-movements-results page-scroll-section"
      >
        <header className="global-movements-section-header">
          <div>
            <span className="page-eyebrow">Resultados visibles</span>
            <h2>Resumen de la búsqueda</h2>
          </div>
          <span>{cantidadPendientes} pendientes</span>
        </header>

        <div className="global-movements-totals">
          <article className="global-total-count">
            <span>Movimientos</span>
            <strong>{gastosFiltrados.length}</strong>
            <small>Según los filtros aplicados</small>
          </article>

          {monedasVisibles.map((moneda) => (
            <article key={moneda}>
              <span>{moneda}</span>
              <div>
                <small>Movimiento neto</small>
                <strong>{formatearMontoMoneda(totalesPorMoneda[moneda].montoBancario, moneda)}</strong>
              </div>
              <div>
                <small>Monto real incluido</small>
                <strong>{formatearMontoMoneda(totalesPorMoneda[moneda].montoReal, moneda)}</strong>
              </div>
            </article>
          ))}

          {!cargando && monedasVisibles.length === 0 && (
            <article className="global-total-empty">
              <span>Sin importes</span>
              <strong>—</strong>
              <small>No hay movimientos para totalizar.</small>
            </article>
          )}
        </div>
      </section>

      <section className="expense-view-toolbar" aria-label="Formato de la lista">
        <div>
          <strong>Formato de la lista</strong>
          <small>Cambiá la presentación sin modificar la cuenta ni los filtros.</small>
        </div>
        <div className="expense-view-switch" role="group" aria-label="Elegir formato de movimientos">
          <button
            type="button"
            className={vistaLista === "general" ? "active" : ""}
            aria-pressed={vistaLista === "general"}
            onClick={() => setVistaLista("general")}
          >
            Detalle general
          </button>
          <button
            type="button"
            className={vistaLista === "puntual" ? "active" : ""}
            aria-pressed={vistaLista === "puntual"}
            onClick={() => setVistaLista("puntual")}
          >
            Detalle puntual
          </button>
        </div>
      </section>

      <section id="lista-movimientos" className="page-scroll-section">
        <header className="global-movements-section-header">
          <div>
            <span className="page-eyebrow">{vistaLista === "general" ? "Detalle general" : "Detalle puntual"}</span>
            <h2>{vistaLista === "general" ? "Lista de gastos de todas las cuentas" : "Movimientos con contexto completo"}</h2>
            <small>
              {vistaLista === "general"
                ? "Lectura centralizada con todas las columnas."
                : "La información relacionada se agrupa para entrar al 100% de zoom."}
            </small>
          </div>
          <span>{gastosFiltrados.length} visibles</span>
        </header>

        {cargando ? (
          <p className="empty-state">Cargando tus movimientos...</p>
        ) : gastosFiltrados.length === 0 ? (
          <p className="empty-state">
            No hay movimientos que coincidan con los filtros elegidos.
          </p>
        ) : (
          <div className={`table-shell global-movements-table-shell is-${vistaLista}`}>
            {vistaLista === "general" ? <table>
              <thead>
                <tr>
                  <SortableTableHeader
                    label="Cuenta"
                    sortKey="cuenta"
                    sortConfig={orden.sortConfig}
                    onSort={orden.requestSort}
                  />
                  <SortableTableHeader
                    label="Fecha"
                    sortKey="fecha"
                    sortConfig={orden.sortConfig}
                    onSort={orden.requestSort}
                  />
                  <SortableTableHeader
                    label="Detalle"
                    sortKey="detalle"
                    sortConfig={orden.sortConfig}
                    onSort={orden.requestSort}
                  />
                  <SortableTableHeader
                    label="Bancario"
                    sortKey="montoBancario"
                    sortConfig={orden.sortConfig}
                    onSort={orden.requestSort}
                  />
                  <SortableTableHeader
                    label="Real"
                    sortKey="montoReal"
                    sortConfig={orden.sortConfig}
                    onSort={orden.requestSort}
                  />
                  <th>Moneda</th>
                  <th>Categoría</th>
                  <th>Subcategoría</th>
                  <th>Estado</th>
                  <th>¿Cuenta en Gasto Real?</th>
                </tr>
              </thead>
              <tbody>
                {orden.sortedRows.map((gasto) => {
                  const cuenta = gasto.cuenta;
                  const cuentaId = obtenerId(cuenta || gasto.cuentaId);
                  const moneda = obtenerMonedaMovimiento(cuenta, gasto.moneda);
                  const esCredito = cuenta?.tipoCuenta === "credito";

                  return (
                    <tr key={gasto._id}>
                      <td>
                        <Link
                          className="global-account-link"
                          to={`/cuentas/${cuentaId}/gastos`}
                          title={`Abrir ${cuenta?.nombreCuenta || "cuenta"}`}
                        >
                          {cuenta?.nombreCuenta || "Cuenta no disponible"}
                        </Link>
                      </td>
                      <td>{formatearFecha(gasto.fecha)}</td>
                      <td>
                        <Link
                          className="global-expense-detail detail-name-link"
                          to={`/cuentas/${cuentaId}/gastos/gasto/${gasto._id}`}
                          title={gasto.detalle || "Sin detalle"}
                          aria-label={`Abrir gasto: ${gasto.detalle || "Sin detalle"}`}
                        >
                          {gasto.detalle || "Sin detalle"}
                        </Link>
                      </td>
                      <td>{formatearMontoMoneda(gasto.montoBancario, moneda)}</td>
                      <td>
                        {esCredito
                          ? <span className="muted-value">No aplica</span>
                          : formatearMontoMoneda(gasto.montoReal, moneda)}
                      </td>
                      <td><span className="currency-badge">{moneda}</span></td>
                      <td>{nombreRelacionado(gasto.categoriaId, "nombreCategoria", "Sin categoría")}</td>
                      <td>{nombreRelacionado(gasto.subcategoriaId, "nombreSubcategoria", "Sin subcategoría")}</td>
                      <td>
                        <span className={`expense-status-badge is-${gasto.estado || "pendiente"}`}>
                          {gasto.estado === "creado" ? "Creado" : "Pendiente"}
                        </span>
                      </td>
                      <td>
                        {esCredito
                          ? <span className="muted-value">No aplica</span>
                          : gasto.incluirMontoReal === true ? "Sí" : "No"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table> : (
              <table className="global-movements-punctual-table">
                <thead>
                  <tr>
                    <SortableTableHeader
                      label="Cuenta y fecha"
                      sortKey="cuenta"
                      sortConfig={orden.sortConfig}
                      onSort={orden.requestSort}
                    />
                    <SortableTableHeader
                      label="Detalle"
                      sortKey="detalle"
                      sortConfig={orden.sortConfig}
                      onSort={orden.requestSort}
                    />
                    <SortableTableHeader
                      label="Movimiento"
                      sortKey="montoBancario"
                      sortConfig={orden.sortConfig}
                      onSort={orden.requestSort}
                    />
                    <th>Clasificación</th>
                    <th>Estado</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {orden.sortedRows.map((gasto) => {
                    const cuenta = gasto.cuenta;
                    const cuentaId = obtenerId(cuenta || gasto.cuentaId);
                    const moneda = obtenerMonedaMovimiento(cuenta, gasto.moneda);
                    const esCredito = cuenta?.tipoCuenta === "credito";
                    const categoria = nombreRelacionado(gasto.categoriaId, "nombreCategoria", "Sin categoría");
                    const subcategoria = nombreRelacionado(gasto.subcategoriaId, "nombreSubcategoria", "Sin subcategoría");

                    return (
                      <tr key={gasto._id}>
                        <td data-label="Cuenta y fecha">
                          <Link className="global-account-link" to={`/cuentas/${cuentaId}/gastos`}>
                            {cuenta?.nombreCuenta || "Cuenta no disponible"}
                          </Link>
                          <small>{formatearFecha(gasto.fecha)} · {moneda}</small>
                        </td>
                        <td data-label="Detalle">
                          <Link
                            className="global-expense-detail detail-name-link"
                            to={`/cuentas/${cuentaId}/gastos/gasto/${gasto._id}`}
                            title={gasto.detalle || "Sin detalle"}
                          >
                            {gasto.detalle || "Sin detalle"}
                          </Link>
                          <small>{categoria} · {subcategoria}</small>
                        </td>
                        <td data-label="Movimiento" className="movement-amount-cell">
                          <strong>{formatearMontoMoneda(gasto.montoBancario, moneda)}</strong>
                          <small>
                            Real: {esCredito ? "No aplica" : formatearMontoMoneda(gasto.montoReal, moneda)}
                          </small>
                        </td>
                        <td data-label="Clasificación">
                          <strong>{subcategoria}</strong>
                          <small>{categoria}</small>
                        </td>
                        <td data-label="Estado">
                          <span className={`expense-status-badge is-${gasto.estado || "pendiente"}`}>
                            {gasto.estado === "creado" ? "Creado" : "Pendiente"}
                          </span>
                          <small>{esCredito ? "Crédito" : gasto.incluirMontoReal === true ? "Incluido en gasto real" : "Fuera de gasto real"}</small>
                        </td>
                        <td className="punctual-row-action">
                          <Link to={`/cuentas/${cuentaId}/gastos/gasto/${gasto._id}`}>Abrir</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </section>
  );
}

export default MovimientosPage;
