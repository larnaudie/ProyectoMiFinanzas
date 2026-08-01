import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { api } from "../../../services/api.js";
import SearchableCategorySelect from "../../../components/SearchableCategorySelect.jsx";
import SearchableSubcategorySelect from "../../../components/SearchableSubcategorySelect.jsx";
import SortableTableHeader, {
  useSortableRows,
} from "../../../components/SortableTableHeader.jsx";
import { NavegacionSecciones } from "../../../components/NavegacionSecciones.jsx";
import { obtenerMonedasCuenta } from "../../../utils/monedas.js";

const fechaInput = (fecha) => (fecha ? String(fecha).slice(0, 10) : "");
const obtenerId = (valor) => (
  typeof valor === "object" ? valor?._id || "" : valor || ""
);
const mensajeError = (error) =>
  error.response?.data?.message || error.response?.data?.mensaje || "No se pudo procesar el archivo.";

const filtrosIniciales = {
  detalle: "",
  tipo: "",
  moneda: "",
  fechaDesde: "",
  fechaHasta: "",
  montoDesde: "",
  montoHasta: "",
  categoriaId: "",
  subcategoriaId: "",
  seleccion: "",
};

const bulkInicial = {
  tipo: "",
  montoBancario: "",
  categoriaId: "",
  subcategoriaId: "",
};

const normalizarTexto = (texto) => String(texto || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const columnasOrdenablesTarjeta = {
  fecha: { type: "date" },
  detalle: { type: "text" },
  montoBancario: { type: "number" },
};

function ImportarExcelCuentaCreditoPage({ cuenta }) {
  const { cuentaId } = useParams();
  const navigate = useNavigate();
  const contextoLayout = useOutletContext();
  const menuAbierto = contextoLayout?.menuAbierto || false;
  const mantenerMenuAbierto = contextoLayout?.alEntrarMenu;
  const permitirCerrarMenu = contextoLayout?.alSalirMenu;
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [bulk, setBulk] = useState(bulkInicial);
  const [mensajeBulk, setMensajeBulk] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [modalCatalogo, setModalCatalogo] = useState("");
  const [nombreCategoria, setNombreCategoria] = useState("");
  const [formSubcategoria, setFormSubcategoria] = useState({
    nombreSubcategoria: "",
    categoria: "",
  });
  const [guardandoCatalogo, setGuardandoCatalogo] = useState(false);
  const [errorCatalogo, setErrorCatalogo] = useState("");
  const [mensajeCatalogo, setMensajeCatalogo] = useState("");
  const monedasHabilitadas = obtenerMonedasCuenta(cuenta);

  useEffect(() => {
    let activo = true;

    Promise.all([api.get("/categorias"), api.get("/subcategorias")])
      .then(([categoriasResponse, subcategoriasResponse]) => {
        if (!activo) return;
        setCategorias(categoriasResponse.data.categorias || []);
        setSubcategorias(subcategoriasResponse.data.subcategorias || []);
      })
      .catch((apiError) => {
        console.error("Error al cargar categorías y subcategorías:", apiError);
        if (activo) setError("No se pudieron cargar las categorías y subcategorías.");
      });

    return () => {
      activo = false;
    };
  }, []);

  const seleccionados = useMemo(
    () => movimientos.filter((movimiento) => movimiento.seleccionado),
    [movimientos],
  );

  const movimientosFiltrados = useMemo(() => movimientos.filter((movimiento) => {
    const detalle = normalizarTexto(movimiento.detalle);
    const detalleBuscado = normalizarTexto(filtros.detalle);
    const fecha = fechaInput(movimiento.fecha);
    const montoAbsoluto = Math.abs(Number(movimiento.montoBancario || 0));

    if (detalleBuscado && !detalle.includes(detalleBuscado)) return false;
    if (filtros.tipo && movimiento.tipo !== filtros.tipo) return false;
    if (filtros.moneda && movimiento.moneda !== filtros.moneda) return false;
    if (filtros.fechaDesde && fecha < filtros.fechaDesde) return false;
    if (filtros.fechaHasta && fecha > filtros.fechaHasta) return false;
    if (filtros.montoDesde !== "" && montoAbsoluto < Number(filtros.montoDesde)) return false;
    if (filtros.montoHasta !== "" && montoAbsoluto > Number(filtros.montoHasta)) return false;
    if (filtros.categoriaId && movimiento.categoriaId !== filtros.categoriaId) return false;
    if (filtros.subcategoriaId && movimiento.subcategoriaId !== filtros.subcategoriaId) return false;
    if (filtros.seleccion === "seleccionados" && !movimiento.seleccionado) return false;
    if (filtros.seleccion === "no_seleccionados" && movimiento.seleccionado) return false;

    return true;
  }), [filtros, movimientos]);
  const ordenTabla = useSortableRows(
    movimientosFiltrados,
    columnasOrdenablesTarjeta,
  );

  const todosVisiblesSeleccionados = movimientosFiltrados.length > 0
    && movimientosFiltrados.every((movimiento) => movimiento.seleccionado);
  const subcategoriasFiltro = filtros.categoriaId
    ? subcategorias.filter(
        (subcategoria) =>
          obtenerId(subcategoria.categoria) === filtros.categoriaId,
      )
    : subcategorias;
  const subcategoriasBulk = bulk.categoriaId
    ? subcategorias.filter(
        (subcategoria) =>
          obtenerId(subcategoria.categoria) === bulk.categoriaId,
      )
    : subcategorias;

  const previsualizar = async (event) => {
    event.preventDefault();
    if (!archivo) {
      setError("Seleccioná el Excel bancario de la tarjeta.");
      return;
    }

    const formData = new FormData();
    formData.append("excel", archivo);
    setLoading(true);
    setError("");
    try {
      const response = await api.post(
        `/importaciones/cuentas/${cuentaId}/tarjeta-excel`,
        formData,
      );
      setPreview(response.data);
      setFiltros(filtrosIniciales);
      setBulk(bulkInicial);
      setMensajeBulk("");
      setMovimientos(
        (response.data.movimientos || []).map((movimiento) => ({
          ...movimiento,
          montoReal: 0,
          porcentaje: 0,
          incluirMontoReal: false,
          categoriaId: obtenerId(movimiento.categoriaId),
          subcategoriaId: obtenerId(movimiento.subcategoriaId),
          fecha: fechaInput(movimiento.fecha),
          seleccionado: true,
        })),
      );
    } catch (apiError) {
      console.error("Error al leer el Excel de tarjeta:", apiError);
      setError(mensajeError(apiError));
    } finally {
      setLoading(false);
    }
  };

  const cambiarMovimiento = (sourceHash, campo, valor) => {
    setMensajeBulk("");
    setMovimientos((actuales) =>
      actuales.map((movimiento) => {
        if (movimiento.sourceHash !== sourceHash) return movimiento;

        if (campo === "categoriaId") {
          const subcategoriaActual = subcategorias.find(
            (subcategoria) => subcategoria._id === movimiento.subcategoriaId,
          );
          const categoriaSubcategoria = obtenerId(subcategoriaActual?.categoria);

          return {
            ...movimiento,
            categoriaId: valor,
            subcategoriaId:
              categoriaSubcategoria && categoriaSubcategoria !== valor
                ? ""
                : movimiento.subcategoriaId,
          };
        }

        if (campo === "subcategoriaId") {
          const subcategoria = subcategorias.find(
            (item) => item._id === valor,
          );

          return {
            ...movimiento,
            subcategoriaId: valor,
            categoriaId:
              obtenerId(subcategoria?.categoria) || movimiento.categoriaId,
          };
        }

        return { ...movimiento, [campo]: valor };
      }),
    );
  };

  const cambiarFiltro = (campo, valor) => {
    setFiltros((actuales) => ({ ...actuales, [campo]: valor }));
  };

  const cambiarBulk = (campo, valor) => {
    setBulk((actual) => ({ ...actual, [campo]: valor }));
    setMensajeBulk("");
  };

  const cambiarSeleccionVisibles = (seleccionado) => {
    const hashesVisibles = new Set(
      movimientosFiltrados.map((movimiento) => movimiento.sourceHash),
    );

    setMovimientos((actuales) => actuales.map((movimiento) => (
      hashesVisibles.has(movimiento.sourceHash)
        ? { ...movimiento, seleccionado }
        : movimiento
    )));
    setMensajeBulk(
      seleccionado
        ? `${hashesVisibles.size} movimientos visibles seleccionados.`
        : `${hashesVisibles.size} movimientos visibles quitados de la selección.`,
    );
  };

  const aplicarBulk = () => {
    if (seleccionados.length === 0) {
      setMensajeBulk("Seleccioná al menos un movimiento para aplicar cambios.");
      return;
    }

    const cambios = {};
    if (bulk.tipo) cambios.tipo = bulk.tipo;
    if (bulk.montoBancario !== "") {
      cambios.montoBancario = Number(bulk.montoBancario);
    }
    if (bulk.categoriaId) cambios.categoriaId = bulk.categoriaId;
    if (bulk.subcategoriaId) cambios.subcategoriaId = bulk.subcategoriaId;
    if (Object.keys(cambios).length === 0) {
      setMensajeBulk("Elegí al menos un cambio masivo para aplicar.");
      return;
    }

    const hashesSeleccionados = new Set(
      seleccionados.map((movimiento) => movimiento.sourceHash),
    );
    setMovimientos((actuales) => actuales.map((movimiento) => {
      if (!hashesSeleccionados.has(movimiento.sourceHash)) {
        return movimiento;
      }

      const subcategoria = cambios.subcategoriaId
        ? subcategorias.find((item) => item._id === cambios.subcategoriaId)
        : null;
      const categoriaFinal = obtenerId(subcategoria?.categoria)
        || cambios.categoriaId
        || movimiento.categoriaId;
      const subcategoriaActual = subcategorias.find(
        (item) => item._id === movimiento.subcategoriaId,
      );
      const categoriaSubcategoriaActual = obtenerId(
        subcategoriaActual?.categoria,
      );
      const subcategoriaFinal = cambios.subcategoriaId
        || (
          cambios.categoriaId
          && categoriaSubcategoriaActual
          && categoriaSubcategoriaActual !== categoriaFinal
            ? ""
            : movimiento.subcategoriaId
        );

      return {
        ...movimiento,
        ...cambios,
        categoriaId: categoriaFinal,
        subcategoriaId: subcategoriaFinal,
        montoReal: 0,
        porcentaje: 0,
        incluirMontoReal: false,
      };
    }));
    setMensajeBulk(
      `Cambios aplicados a ${seleccionados.length} movimiento${seleccionados.length === 1 ? "" : "s"} seleccionado${seleccionados.length === 1 ? "" : "s"}.`,
    );
  };

  const eliminarSeleccionados = () => {
    if (seleccionados.length === 0) {
      setMensajeBulk("Seleccioná al menos un movimiento para eliminar.");
      return;
    }

    const cantidadEliminada = seleccionados.length;
    const hashesSeleccionados = new Set(
      seleccionados.map((movimiento) => movimiento.sourceHash),
    );

    setMovimientos((actuales) => actuales.filter(
      (movimiento) => !hashesSeleccionados.has(movimiento.sourceHash),
    ));
    setMensajeBulk(
      `${cantidadEliminada} movimiento${cantidadEliminada === 1 ? "" : "s"} eliminado${cantidadEliminada === 1 ? "" : "s"} de la previsualización.`,
    );
  };

  const abrirModalCatalogo = (tipo) => {
    setModalCatalogo(tipo);
    setErrorCatalogo("");
    setNombreCategoria("");
    setFormSubcategoria({ nombreSubcategoria: "", categoria: "" });
  };

  const cerrarModalCatalogo = () => {
    if (guardandoCatalogo) return;
    setModalCatalogo("");
    setErrorCatalogo("");
  };

  const guardarCategoria = async () => {
    const nombre = nombreCategoria.trim();
    if (!nombre) {
      setErrorCatalogo("El nombre de la categoría es obligatorio.");
      return;
    }

    setGuardandoCatalogo(true);
    setErrorCatalogo("");
    try {
      const { data } = await api.post("/categorias", {
        nombreCategoria: nombre,
      });
      setCategorias((actuales) => [
        ...actuales.filter((categoria) => categoria._id !== data.categoria._id),
        data.categoria,
      ]);
      setMensajeCatalogo(`Categoría "${data.categoria.nombreCategoria}" creada.`);
      setModalCatalogo("");
    } catch (apiError) {
      setErrorCatalogo(mensajeError(apiError));
    } finally {
      setGuardandoCatalogo(false);
    }
  };

  const guardarSubcategoria = async () => {
    const nombre = formSubcategoria.nombreSubcategoria.trim();
    if (!nombre) {
      setErrorCatalogo("El nombre de la subcategoría es obligatorio.");
      return;
    }

    setGuardandoCatalogo(true);
    setErrorCatalogo("");
    try {
      const payload = { nombreSubcategoria: nombre };
      if (formSubcategoria.categoria) {
        payload.categoria = formSubcategoria.categoria;
      }
      const { data } = await api.post("/subcategorias", payload);
      setSubcategorias((actuales) => [
        ...actuales.filter(
          (subcategoria) => subcategoria._id !== data.subcategoria._id,
        ),
        data.subcategoria,
      ]);
      setMensajeCatalogo(
        `Subcategoría "${data.subcategoria.nombreSubcategoria}" creada.`,
      );
      setModalCatalogo("");
    } catch (apiError) {
      setErrorCatalogo(mensajeError(apiError));
    } finally {
      setGuardandoCatalogo(false);
    }
  };

  const confirmarImportacion = async () => {
    if (!preview || seleccionados.length === 0) {
      setError("Seleccioná al menos un movimiento.");
      return;
    }

    const movimientosPayload = seleccionados.map((movimiento) => {
      const payload = { ...movimiento };
      delete payload.seleccionado;
      return {
        ...payload,
        montoEstadoCuenta: Number(payload.montoEstadoCuenta),
        montoBancario: Number(payload.montoBancario),
        montoReal: 0,
        porcentaje: 0,
        incluirMontoReal: false,
      };
    });

    setLoading(true);
    setError("");
    try {
      await api.post(`/importaciones/cuentas/${cuentaId}/tarjeta-resumen`, {
        resumen: preview.resumen,
        movimientos: movimientosPayload,
        archivoNombre: preview.archivoNombre || archivo?.name || "",
      });
      navigate(`/cuentas/${cuentaId}/gastos`);
    } catch (apiError) {
      console.error("Error al importar movimientos de tarjeta:", apiError);
      setError(mensajeError(apiError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-section import-page">
      <nav
        className="import-floating-actions secondary-sidebar-actions"
        aria-label="Acciones rápidas de importación"
        onMouseEnter={
          menuAbierto && mantenerMenuAbierto
            ? mantenerMenuAbierto
            : undefined
        }
        onMouseLeave={
          menuAbierto && permitirCerrarMenu
            ? permitirCerrarMenu
            : undefined
        }
      >
        <span>Acciones rápidas</span>
        <Link className="secondary-link" to={`/cuentas/${cuentaId}/gastos`}>
          Volver a resúmenes
        </Link>
        <button type="button" onClick={() => abrirModalCatalogo("categoria")}>
          Crear categoría
        </button>
        <button type="button" onClick={() => abrirModalCatalogo("subcategoria")}>
          Crear subcategoría
        </button>
        <NavegacionSecciones
          secciones={[
            { id: "importar-estado-tarjeta", etiqueta: "Importar archivo" },
            ...(preview
              ? [{
                  id: "movimientos-detectados-tarjeta",
                  etiqueta: "Movimientos detectados",
                }]
              : []),
          ]}
        />
      </nav>

      <header className="page-header">
        <div>
          <h1>Importar Excel</h1>
          <p>{cuenta.nombreCuenta}: este importador lee el formato bancario del estado de tarjeta.</p>
        </div>
      </header>

      <form
        id="importar-estado-tarjeta"
        className="upload-panel import-upload-panel credit-account-import page-scroll-section"
        onSubmit={previsualizar}
      >
        <div>
          <h2>Importar Excel bancario</h2>
          <p>
            Formato oficial de movimientos de tarjeta. Detecta compras, cuotas,
            reintegros y pagos. En crédito se conserva únicamente el monto
            bancario.
          </p>
        </div>
        <label>
          Archivo Excel bancario
          <input
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setArchivo(event.target.files?.[0] || null)}
          />
        </label>
        <button type="submit" disabled={loading}>{loading ? "Leyendo..." : "Importar Excel"}</button>
      </form>

      {error && <p className="inline-error">{error}</p>}
      {mensajeCatalogo && (
        <p className="detail-feedback">{mensajeCatalogo}</p>
      )}

      {preview && (
        <section
          id="movimientos-detectados-tarjeta"
          className="credit-card-panel page-scroll-section"
        >
          <div className="import-section-header">
            <div>
              <h2>Movimientos detectados</h2>
              <p>
                Período {preview.resumen.periodo || "sin período"} · cierre {fechaInput(preview.resumen.cierre)} · {seleccionados.length} seleccionados
              </p>
            </div>
          </div>

          <section className="credit-import-filters" aria-labelledby="credit-import-filters-title">
            <div className="credit-import-tools-header">
              <div>
                <h3 id="credit-import-filters-title">Filtros</h3>
                <p>{movimientosFiltrados.length} visibles de {movimientos.length}</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setFiltros(filtrosIniciales)}
              >
                Limpiar filtros
              </button>
            </div>

            <div className="credit-import-filter-grid">
              <label>
                Detalle
                <input
                  type="search"
                  placeholder="Buscar detalle"
                  value={filtros.detalle}
                  onChange={(event) => cambiarFiltro("detalle", event.target.value)}
                />
              </label>
              <label>
                Tipo
                <select value={filtros.tipo} onChange={(event) => cambiarFiltro("tipo", event.target.value)}>
                  <option value="">Todos</option>
                  <option value="compra">Compra</option>
                  <option value="cuota">Cuota</option>
                  <option value="pago">Pago</option>
                  <option value="reintegro">Reintegro</option>
                </select>
              </label>
              <label>
                Moneda
                <select value={filtros.moneda} onChange={(event) => cambiarFiltro("moneda", event.target.value)}>
                  <option value="">Todas</option>
                  {monedasHabilitadas.map((moneda) => (
                    <option key={moneda} value={moneda}>
                      {moneda}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha desde
                <input type="date" value={filtros.fechaDesde} onChange={(event) => cambiarFiltro("fechaDesde", event.target.value)} />
              </label>
              <label>
                Fecha hasta
                <input type="date" value={filtros.fechaHasta} onChange={(event) => cambiarFiltro("fechaHasta", event.target.value)} />
              </label>
              <label>
                Monto absoluto desde
                <input type="number" min="0" step="0.01" value={filtros.montoDesde} onChange={(event) => cambiarFiltro("montoDesde", event.target.value)} />
              </label>
              <label>
                Monto absoluto hasta
                <input type="number" min="0" step="0.01" value={filtros.montoHasta} onChange={(event) => cambiarFiltro("montoHasta", event.target.value)} />
              </label>
              <label>
                Categoría
                <SearchableCategorySelect
                  categorias={categorias}
                  value={filtros.categoriaId}
                  placeholder="Todas"
                  ariaLabel="Filtrar por categoría"
                  onChange={(categoriaId) =>
                    setFiltros((actuales) => ({
                      ...actuales,
                      categoriaId,
                      subcategoriaId: "",
                    }))
                  }
                />
              </label>
              <label>
                Subcategoría
                <SearchableSubcategorySelect
                  subcategorias={subcategoriasFiltro}
                  value={filtros.subcategoriaId}
                  placeholder="Todas"
                  ariaLabel="Filtrar por subcategoría"
                  onChange={(subcategoriaId) =>
                    cambiarFiltro("subcategoriaId", subcategoriaId)
                  }
                />
              </label>
              <label>
                Selección
                <select value={filtros.seleccion} onChange={(event) => cambiarFiltro("seleccion", event.target.value)}>
                  <option value="">Todos</option>
                  <option value="seleccionados">Seleccionados</option>
                  <option value="no_seleccionados">No seleccionados</option>
                </select>
              </label>
            </div>

            <div className="credit-import-visible-actions">
              <button type="button" className="selection-action" disabled={movimientosFiltrados.length === 0} onClick={() => cambiarSeleccionVisibles(true)}>
                Seleccionar visibles
              </button>
              <button type="button" className="selection-action" disabled={movimientosFiltrados.length === 0} onClick={() => cambiarSeleccionVisibles(false)}>
                Quitar visibles
              </button>
            </div>
          </section>

          <section className="selection-actions import-selection-actions credit-import-bulk" aria-labelledby="credit-import-bulk-title">
            <strong id="credit-import-bulk-title">
              {seleccionados.length} seleccionado{seleccionados.length === 1 ? "" : "s"}
            </strong>
            <label>
              Tipo
              <select className="table-select" value={bulk.tipo} onChange={(event) => cambiarBulk("tipo", event.target.value)}>
                <option value="">Sin cambios</option>
                <option value="compra">Compra</option>
                <option value="cuota">Cuota</option>
                <option value="pago">Pago</option>
                <option value="reintegro">Reintegro</option>
              </select>
            </label>
            <label>
              Monto bancario
              <input
                className="table-input"
                type="number"
                step="0.01"
                placeholder="Sin cambios"
                value={bulk.montoBancario}
                onChange={(event) =>
                  cambiarBulk("montoBancario", event.target.value)
                }
              />
            </label>
            <label>
              Categoría
              <SearchableCategorySelect
                categorias={categorias}
                value={bulk.categoriaId}
                placeholder="Sin cambios"
                ariaLabel="Categoría para movimientos seleccionados"
                onChange={(categoriaId) =>
                  setBulk((actual) => ({
                    ...actual,
                    categoriaId,
                    subcategoriaId: "",
                  }))
                }
              />
            </label>
            <label>
              Subcategoría
              <SearchableSubcategorySelect
                subcategorias={subcategoriasBulk}
                value={bulk.subcategoriaId}
                placeholder="Sin cambios"
                ariaLabel="Subcategoría para movimientos seleccionados"
                onChange={(subcategoriaId) =>
                  cambiarBulk("subcategoriaId", subcategoriaId)
                }
              />
            </label>
            <label>
              Impacto económico
              <span className="credit-import-operational-note">
                No aplica en cuentas de crédito
              </span>
            </label>
            <div className="credit-import-bulk-actions">
              <button
                type="button"
                className="selection-action"
                disabled={seleccionados.length === 0}
                onClick={aplicarBulk}
              >
                Aplicar a seleccionados
              </button>
              <button
                type="button"
                className="selection-action create-action"
                disabled={loading || seleccionados.length === 0}
                onClick={confirmarImportacion}
              >
                {loading ? "Creando..." : "Crear seleccionados"}
              </button>
              <button
                type="button"
                className="selection-action delete-action"
                disabled={loading || seleccionados.length === 0}
                onClick={eliminarSeleccionados}
              >
                Eliminar seleccionados
              </button>
            </div>
            {mensajeBulk && <p className="bulk-message">{mensajeBulk}</p>}
          </section>

          <div className="table-shell import-expenses-table">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Seleccionar movimientos visibles"
                      checked={todosVisiblesSeleccionados}
                      onChange={(event) => cambiarSeleccionVisibles(event.target.checked)}
                    />
                  </th>
                  <SortableTableHeader
                    label="Fecha"
                    sortKey="fecha"
                    sortConfig={ordenTabla.sortConfig}
                    onSort={ordenTabla.requestSort}
                  />
                  <SortableTableHeader
                    label="Detalle"
                    sortKey="detalle"
                    sortConfig={ordenTabla.sortConfig}
                    onSort={ordenTabla.requestSort}
                  />
                  <th>Tipo</th><th>Moneda</th>
                  <SortableTableHeader
                    label="Monto bancario"
                    sortKey="montoBancario"
                    sortConfig={ordenTabla.sortConfig}
                    onSort={ordenTabla.requestSort}
                  />
                  <th>Categoría</th>
                  <th>Subcategoría</th>
                </tr>
              </thead>
              <tbody>
                {ordenTabla.sortedRows.map((movimiento) => {
                  const subcategoriasDisponibles = movimiento.categoriaId
                    ? subcategorias.filter(
                        (subcategoria) =>
                          obtenerId(subcategoria.categoria)
                            === movimiento.categoriaId,
                      )
                    : subcategorias;

                  return (
                    <tr key={movimiento.sourceHash}>
                      <td><input type="checkbox" checked={movimiento.seleccionado} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "seleccionado", e.target.checked)} /></td>
                      <td><input className="table-input" type="date" value={movimiento.fecha} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "fecha", e.target.value)} /></td>
                      <td><textarea className="table-input table-input-wide table-detail-textarea" rows={1} value={movimiento.detalle} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "detalle", e.target.value)} /></td>
                      <td>
                        <select className="table-select" value={movimiento.tipo} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "tipo", e.target.value)}>
                          <option value="compra">Compra</option><option value="cuota">Cuota</option>
                          <option value="pago">Pago</option><option value="reintegro">Reintegro</option>
                        </select>
                      </td>
                      <td>{movimiento.moneda}</td>
                      <td><input className="table-input table-input-number" type="number" step="0.01" value={movimiento.montoBancario} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "montoBancario", e.target.value)} /></td>
                      <td>
                        <SearchableCategorySelect
                          categorias={categorias}
                          value={movimiento.categoriaId}
                          placeholder="Sin categoría"
                          ariaLabel={`Categoría para ${movimiento.detalle}`}
                          onChange={(categoriaId) =>
                            cambiarMovimiento(
                              movimiento.sourceHash,
                              "categoriaId",
                              categoriaId,
                            )
                          }
                        />
                      </td>
                      <td>
                        <SearchableSubcategorySelect
                          subcategorias={subcategoriasDisponibles}
                          value={movimiento.subcategoriaId}
                          placeholder="Sin subcategoría"
                          ariaLabel={`Subcategoría para ${movimiento.detalle}`}
                          onChange={(subcategoriaId) =>
                            cambiarMovimiento(
                              movimiento.sourceHash,
                              "subcategoriaId",
                              subcategoriaId,
                            )
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
                {movimientosFiltrados.length === 0 && (
                  <tr>
                    <td className="credit-import-empty-row" colSpan="8">
                      No hay movimientos que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modalCatalogo === "categoria" && (
        <div className="modal-backdrop">
          <section className="edit-modal import-catalog-modal">
            <div className="edit-modal-header">
              <div>
                <h2>Crear categoría</h2>
                <p>Aparecerá inmediatamente en todos los desplegables.</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={guardandoCatalogo}
                onClick={cerrarModalCatalogo}
              >
                Cerrar
              </button>
            </div>
            <label>
              Nombre
              <input
                autoFocus
                type="text"
                value={nombreCategoria}
                onChange={(event) => setNombreCategoria(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") guardarCategoria();
                }}
              />
            </label>
            {errorCatalogo && <p className="error-text">{errorCatalogo}</p>}
            <div className="edit-modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={guardandoCatalogo}
                onClick={cerrarModalCatalogo}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoCatalogo}
                onClick={guardarCategoria}
              >
                {guardandoCatalogo ? "Creando..." : "Crear categoría"}
              </button>
            </div>
          </section>
        </div>
      )}

      {modalCatalogo === "subcategoria" && (
        <div className="modal-backdrop">
          <section className="edit-modal import-catalog-modal">
            <div className="edit-modal-header">
              <div>
                <h2>Crear subcategoría</h2>
                <p>Podés asociarla a una categoría o dejarla sin categoría.</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={guardandoCatalogo}
                onClick={cerrarModalCatalogo}
              >
                Cerrar
              </button>
            </div>
            <label>
              Nombre
              <input
                autoFocus
                type="text"
                value={formSubcategoria.nombreSubcategoria}
                onChange={(event) =>
                  setFormSubcategoria((actual) => ({
                    ...actual,
                    nombreSubcategoria: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Categoría (opcional)
              <SearchableCategorySelect
                categorias={categorias}
                value={formSubcategoria.categoria}
                placeholder="Sin categoría"
                ariaLabel="Categoría de la nueva subcategoría"
                onChange={(categoria) =>
                  setFormSubcategoria((actual) => ({
                    ...actual,
                    categoria,
                  }))
                }
              />
            </label>
            {errorCatalogo && <p className="error-text">{errorCatalogo}</p>}
            <div className="edit-modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={guardandoCatalogo}
                onClick={cerrarModalCatalogo}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoCatalogo}
                onClick={guardarSubcategoria}
              >
                {guardandoCatalogo ? "Creando..." : "Crear subcategoría"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default ImportarExcelCuentaCreditoPage;
