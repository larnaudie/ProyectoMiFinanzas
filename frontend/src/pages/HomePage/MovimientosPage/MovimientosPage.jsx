import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import ExpenseFiltersPanel from "../../../components/ExpenseFiltersPanel.jsx";
import { NavegacionSecciones } from "../../../components/NavegacionSecciones.jsx";
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
  const contextoLayout = useOutletContext();
  const menuAbierto = contextoLayout?.menuAbierto || false;
  const mantenerMenuAbierto = contextoLayout?.alEntrarMenu;
  const permitirCerrarMenu = contextoLayout?.alSalirMenu;
  const [gastos, setGastos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
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
      <nav
        className="expense-floating-actions secondary-sidebar-actions section-navigation-only"
        aria-label="Navegación de movimientos"
        onMouseEnter={menuAbierto ? mantenerMenuAbierto : undefined}
        onMouseLeave={menuAbierto ? permitirCerrarMenu : undefined}
      >
        <NavegacionSecciones
          secciones={[
            { id: "filtros-movimientos", etiqueta: "Filtros" },
            { id: "resultados-movimientos", etiqueta: "Resultados" },
            { id: "lista-movimientos", etiqueta: "Lista de gastos" },
          ]}
        />
      </nav>

      <header className="page-header global-movements-header">
        <div>
          <span className="page-eyebrow">Consulta global</span>
          <h1>Todos tus movimientos</h1>
          <p>
            Busca gastos de todas tus cuentas desde un único lugar. La edición
            continúa dentro del desglose de cada cuenta.
          </p>
        </div>
      </header>

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
                <small>Monto bancario</small>
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

      <section id="lista-movimientos" className="page-scroll-section">
        <header className="global-movements-section-header">
          <div>
            <span className="page-eyebrow">Detalle centralizado</span>
            <h2>Lista de gastos</h2>
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
          <div className="table-shell global-movements-table-shell">
            <table>
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
                  <th>¿Suma en Presupuesto Mensual?</th>
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
                      <td>
                        {esCredito
                          ? <span className="muted-value">No aplica</span>
                          : gasto.sumaAlPresupuesto === true ? "Sí" : "No"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default MovimientosPage;
