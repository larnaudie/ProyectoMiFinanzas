import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";
import SortableTableHeader from "../../../components/SortableTableHeader.jsx";
import { useSortableRows } from "../../../hooks/useSortableRows.js";
import {
  calcularMontoRealGasto,
  esMontoDistintoDeCero,
} from "../../../utils/montosGasto.js";

const fechaInput = (fecha) => (fecha ? String(fecha).slice(0, 10) : "");
const mensajeError = (error) =>
  error.response?.data?.message || error.response?.data?.mensaje || "No se pudo procesar el archivo.";

const prepararMovimiento = (movimiento) => {
  const preparado = {
    ...movimiento,
    montoReal: movimiento.montoReal ?? 0,
    fecha: fechaInput(movimiento.fecha),
    seleccionado: true,
  };

  return {
    ...preparado,
    montoReal: calcularMontoRealGasto(preparado),
  };
};

const columnasOrdenablesMovimientos = {
  fecha: { type: "date" },
  detalle: { type: "text" },
  montoBancario: { type: "number" },
};

function ImportarExcelTarjetaPage() {
  const { cuentaId, tarjetaId } = useParams();
  const navigate = useNavigate();
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [bulkMontos, setBulkMontos] = useState({
    montoBancario: "",
    montoReal: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const seleccionados = useMemo(
    () => movimientos.filter((movimiento) => movimiento.seleccionado),
    [movimientos],
  );
  const ordenTabla = useSortableRows(
    movimientos,
    columnasOrdenablesMovimientos,
  );

  const previsualizar = async (event) => {
    event.preventDefault();
    if (!archivo) {
      setError("Seleccioná un archivo .xls o .xlsx.");
      return;
    }

    const formData = new FormData();
    formData.append("excel", archivo);
    setLoading(true);
    setError("");
    try {
      const response = await api.post(`/tarjetas/${tarjetaId}/importar-preview`, formData);
      setPreview(response.data);
      setMovimientos((response.data.movimientos || []).map(prepararMovimiento));
      setBulkMontos({ montoBancario: "", montoReal: "" });
    } catch (apiError) {
      console.error("Error al leer el resumen:", apiError);
      setError(mensajeError(apiError));
    } finally {
      setLoading(false);
    }
  };

  const cambiarMovimiento = (sourceHash, campo, valor) => {
    setMovimientos((actuales) =>
      actuales.map((movimiento) => {
        if (movimiento.sourceHash !== sourceHash) return movimiento;

        const actualizado = { ...movimiento, [campo]: valor };
        return {
          ...actualizado,
          montoReal: calcularMontoRealGasto(actualizado),
        };
      }),
    );
  };

  const guardarResumen = async () => {
    if (!preview || seleccionados.length === 0) {
      setError("Seleccioná al menos un movimiento para guardar.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const movimientosPayload = seleccionados.map((movimiento) => {
        const payload = { ...movimiento };
        delete payload.seleccionado;
        return {
          ...payload,
          montoEstadoCuenta: Number(payload.montoEstadoCuenta),
          montoBancario: Number(payload.montoBancario),
          montoReal: Number(payload.montoReal),
          porcentaje: Number(payload.porcentaje),
          incluirMontoReal: Boolean(payload.incluirMontoReal),
        };
      });
      const response = await api.post(`/tarjetas/${tarjetaId}/resumenes`, {
        resumen: preview.resumen,
        archivoNombre: preview.archivoNombre || archivo?.name || "",
        movimientos: movimientosPayload,
      });
      navigate(`/cuentas/${cuentaId}/tarjetas/${tarjetaId}/resumenes/${response.data.resumen._id}`);
    } catch (apiError) {
      console.error("Error al guardar el resumen:", apiError);
      setError(mensajeError(apiError));
    } finally {
      setLoading(false);
    }
  };

  const aplicarMontosSeleccionados = () => {
    if (seleccionados.length === 0) {
      setError("Seleccioná al menos un movimiento.");
      return;
    }
    if (
      bulkMontos.montoBancario !== ""
      && bulkMontos.montoReal !== ""
    ) {
      setError("Aplicá monto bancario o monto real, no ambos al mismo tiempo.");
      return;
    }
    if (
      bulkMontos.montoBancario === ""
      && bulkMontos.montoReal === ""
    ) {
      setError("Ingresá un monto para aplicar.");
      return;
    }

    setMovimientos((actuales) => actuales.map((movimiento) => {
      if (!movimiento.seleccionado) return movimiento;

      const actualizado = bulkMontos.montoReal !== ""
        ? {
            ...movimiento,
            montoBancario: 0,
            montoReal: Number(bulkMontos.montoReal),
            porcentaje: 0,
            incluirMontoReal: true,
          }
        : {
            ...movimiento,
            montoBancario: Number(bulkMontos.montoBancario),
          };

      return {
        ...actualizado,
        montoReal: calcularMontoRealGasto(actualizado),
      };
    }));
    setBulkMontos({ montoBancario: "", montoReal: "" });
    setError("");
  };

  return (
    <section className="page-section import-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tarjeta de crédito</p>
          <h1>Importar resumen</h1>
          <p>Primero revisá la lectura. Nada se guarda hasta que confirmes el resumen.</p>
        </div>
        <Link className="secondary-link" to={`/cuentas/${cuentaId}/tarjetas/${tarjetaId}`}>Volver</Link>
      </header>

      <form className="upload-panel import-upload-panel" onSubmit={previsualizar}>
        <label>
          Archivo de la tarjeta
          <input
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setArchivo(event.target.files?.[0] || null)}
          />
        </label>
        <button type="submit" disabled={loading}>{loading ? "Leyendo..." : "Previsualizar"}</button>
      </form>

      {error && <p className="inline-error">{error}</p>}

      {preview && (
        <>
          <section className="summary-grid">
            <article><span>Período</span><strong>{preview.resumen.periodo || "Sin período"}</strong></article>
            <article><span>Cierre</span><strong>{fechaInput(preview.resumen.cierre)}</strong></article>
            <article><span>Vencimiento</span><strong>{fechaInput(preview.resumen.vencimiento) || "—"}</strong></article>
            <article><span>Movimientos</span><strong>{seleccionados.length} / {movimientos.length}</strong></article>
          </section>

          <section className="credit-card-panel">
            <div className="import-section-header">
              <div>
                <h2>Revisar movimientos</h2>
                <p>Las compras se normalizan como egresos; los pagos quedan fuera del monto real.</p>
              </div>
              <button type="button" onClick={guardarResumen} disabled={loading || seleccionados.length === 0}>
                {loading ? "Guardando..." : "Guardar resumen"}
              </button>
            </div>

            <div className="selection-actions import-selection-actions import-bulk-panel">
              <strong>{seleccionados.length} seleccionados</strong>
              <label>
                Monto bancario
                <input
                  className="table-input table-input-number"
                  type="number"
                  step="0.01"
                  placeholder="Sin cambios"
                  value={bulkMontos.montoBancario}
                  onChange={(event) =>
                    setBulkMontos((actual) => ({
                      ...actual,
                      montoBancario: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Monto real
                <input
                  className="table-input table-input-number"
                  type="number"
                  step="0.01"
                  placeholder="Sin cambios"
                  value={bulkMontos.montoReal}
                  onChange={(event) =>
                    setBulkMontos((actual) => ({
                      ...actual,
                      montoReal: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                className="selection-action"
                onClick={aplicarMontosSeleccionados}
              >
                Aplicar a seleccionados
              </button>
            </div>

            <div className="table-shell import-expenses-table">
              <table>
                <thead>
                  <tr>
                    <th><span className="sr-only">Seleccionar</span></th>
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
                      label="Monto"
                      sortKey="montoBancario"
                      sortConfig={ordenTabla.sortConfig}
                      onSort={ordenTabla.requestSort}
                    />
                    <th>% real</th><th>Real</th><th>Incluir real</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenTabla.sortedRows.map((movimiento) => (
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
                      <td><input className="table-input table-input-small" type="number" min="0" max="100" value={movimiento.porcentaje} disabled={!esMontoDistintoDeCero(movimiento.montoBancario)} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "porcentaje", e.target.value)} /></td>
                      <td><input className="table-input table-input-number" type="number" step="0.01" value={movimiento.montoReal} disabled={esMontoDistintoDeCero(movimiento.montoBancario)} title={esMontoDistintoDeCero(movimiento.montoBancario) ? "Se calcula con el monto bancario y el porcentaje" : "Monto real directo"} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "montoReal", e.target.value)} /></td>
                      <td><input type="checkbox" checked={Boolean(movimiento.incluirMontoReal)} onChange={(e) => cambiarMovimiento(movimiento.sourceHash, "incluirMontoReal", e.target.checked)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

export default ImportarExcelTarjetaPage;
