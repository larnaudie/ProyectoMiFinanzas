import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";

const fechaInput = (fecha) => (fecha ? String(fecha).slice(0, 10) : "");
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
  seleccion: "",
};

const bulkInicial = {
  tipo: "",
  porcentaje: "",
  incluirMontoReal: "",
};

const normalizarTexto = (texto) => String(texto || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

function ImportarExcelCuentaCreditoPage({ cuenta }) {
  const { cuentaId } = useParams();
  const navigate = useNavigate();
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [bulk, setBulk] = useState(bulkInicial);
  const [mensajeBulk, setMensajeBulk] = useState("");

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
    if (filtros.seleccion === "seleccionados" && !movimiento.seleccionado) return false;
    if (filtros.seleccion === "no_seleccionados" && movimiento.seleccionado) return false;

    return true;
  }), [filtros, movimientos]);

  const todosVisiblesSeleccionados = movimientosFiltrados.length > 0
    && movimientosFiltrados.every((movimiento) => movimiento.seleccionado);
  const seleccionadosVisibles = movimientosFiltrados.filter(
    (movimiento) => movimiento.seleccionado,
  );

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
      actuales.map((movimiento) =>
        movimiento.sourceHash === sourceHash
          ? { ...movimiento, [campo]: valor }
          : movimiento,
      ),
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
    if (seleccionadosVisibles.length === 0) {
      setMensajeBulk("Seleccioná al menos un movimiento visible para aplicar cambios.");
      return;
    }

    const cambios = {};
    if (bulk.tipo) cambios.tipo = bulk.tipo;
    if (bulk.porcentaje !== "") {
      const porcentaje = Number(bulk.porcentaje);
      if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
        setMensajeBulk("El porcentaje debe estar entre 0 y 100.");
        return;
      }
      cambios.porcentaje = porcentaje;
    }
    if (bulk.incluirMontoReal !== "") {
      cambios.incluirMontoReal = bulk.incluirMontoReal === "true";
    }

    if (Object.keys(cambios).length === 0) {
      setMensajeBulk("Elegí al menos un cambio masivo para aplicar.");
      return;
    }

    const hashesSeleccionadosVisibles = new Set(
      seleccionadosVisibles.map((movimiento) => movimiento.sourceHash),
    );
    setMovimientos((actuales) => actuales.map((movimiento) => (
      hashesSeleccionadosVisibles.has(movimiento.sourceHash)
        ? { ...movimiento, ...cambios }
        : movimiento
    )));
    setMensajeBulk(
      `Cambios aplicados a ${seleccionadosVisibles.length} movimiento${seleccionadosVisibles.length === 1 ? "" : "s"} visible${seleccionadosVisibles.length === 1 ? "" : "s"}.`,
    );
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
        porcentaje: Number(payload.porcentaje),
        incluirMontoReal: Boolean(payload.incluirMontoReal),
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
      <header className="page-header">
        <div>
          <h1>Importar Excel</h1>
          <p>{cuenta.nombreCuenta}: este importador lee el formato bancario del estado de tarjeta.</p>
        </div>
        <Link className="secondary-link compact-link" to={`/cuentas/${cuentaId}/gastos`}>
          Volver a resúmenes
        </Link>
      </header>

      <form className="upload-panel import-upload-panel credit-account-import" onSubmit={previsualizar}>
        <div>
          <h2>Importar Excel bancario</h2>
          <p>Formato oficial de movimientos de tarjeta. Detecta compras, cuotas, reintegros y pagos.</p>
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

      {preview && (
        <section className="credit-card-panel">
          <div className="import-section-header">
            <div>
              <h2>Movimientos detectados</h2>
              <p>
                Período {preview.resumen.periodo || "sin período"} · cierre {fechaInput(preview.resumen.cierre)} · {seleccionados.length} seleccionados
              </p>
            </div>
            <button type="button" disabled={loading || seleccionados.length === 0} onClick={confirmarImportacion}>
              {loading ? "Guardando..." : "Crear resumen"}
            </button>
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
                  <option value="UYU">UYU</option>
                  <option value="USD">USD</option>
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
              {seleccionadosVisibles.length} seleccionado{seleccionadosVisibles.length === 1 ? "" : "s"} visible{seleccionadosVisibles.length === 1 ? "" : "s"}
              {seleccionados.length !== seleccionadosVisibles.length
                ? ` · ${seleccionados.length} en total`
                : ""}
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
              Porcentaje real
              <input className="table-input" type="number" min="0" max="100" placeholder="Sin cambios" value={bulk.porcentaje} onChange={(event) => cambiarBulk("porcentaje", event.target.value)} />
            </label>
            <label>
              Incluir real
              <select className="table-select" value={bulk.incluirMontoReal} onChange={(event) => cambiarBulk("incluirMontoReal", event.target.value)}>
                <option value="">Sin cambios</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </label>
            <button type="button" className="selection-action" disabled={seleccionadosVisibles.length === 0} onClick={aplicarBulk}>
              Aplicar a visibles
            </button>
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
                  </th><th>Fecha</th><th>Detalle</th>
                  <th>Tipo</th><th>Moneda</th><th>Monto bancario</th><th>% real</th><th>Incluir real</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map((movimiento) => (
                  <tr key={movimiento.sourceHash}>
                    <td><input type="checkbox" checked={movimiento.seleccionado} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "seleccionado", e.target.checked)} /></td>
                    <td><input className="table-input" type="date" value={movimiento.fecha} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "fecha", e.target.value)} /></td>
                    <td><input className="table-input table-input-wide" value={movimiento.detalle} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "detalle", e.target.value)} /></td>
                    <td>
                      <select className="table-select" value={movimiento.tipo} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "tipo", e.target.value)}>
                        <option value="compra">Compra</option><option value="cuota">Cuota</option>
                        <option value="pago">Pago</option><option value="reintegro">Reintegro</option>
                      </select>
                    </td>
                    <td>{movimiento.moneda}</td>
                    <td><input className="table-input table-input-number" type="number" step="0.01" value={movimiento.montoBancario} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "montoBancario", e.target.value)} /></td>
                    <td><input className="table-input table-input-small" type="number" min="0" max="100" value={movimiento.porcentaje} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "porcentaje", e.target.value)} /></td>
                    <td><input type="checkbox" checked={Boolean(movimiento.incluirMontoReal)} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "incluirMontoReal", e.target.checked)} /></td>
                  </tr>
                ))}
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
    </section>
  );
}

export default ImportarExcelCuentaCreditoPage;
