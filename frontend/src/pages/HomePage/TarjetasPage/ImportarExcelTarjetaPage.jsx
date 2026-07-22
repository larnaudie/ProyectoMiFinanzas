import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";

const fechaInput = (fecha) => (fecha ? String(fecha).slice(0, 10) : "");
const mensajeError = (error) =>
  error.response?.data?.message || error.response?.data?.mensaje || "No se pudo procesar el archivo.";

const prepararMovimiento = (movimiento) => ({
  ...movimiento,
  fecha: fechaInput(movimiento.fecha),
  seleccionado: true,
});

function ImportarExcelTarjetaPage() {
  const { cuentaId, tarjetaId } = useParams();
  const navigate = useNavigate();
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const seleccionados = useMemo(
    () => movimientos.filter((movimiento) => movimiento.seleccionado),
    [movimientos],
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
    } catch (apiError) {
      console.error("Error al leer el resumen:", apiError);
      setError(mensajeError(apiError));
    } finally {
      setLoading(false);
    }
  };

  const cambiarMovimiento = (sourceHash, campo, valor) => {
    setMovimientos((actuales) =>
      actuales.map((movimiento) =>
        movimiento.sourceHash === sourceHash ? { ...movimiento, [campo]: valor } : movimiento,
      ),
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

            <div className="table-shell import-expenses-table">
              <table>
                <thead>
                  <tr>
                    <th><span className="sr-only">Seleccionar</span></th>
                    <th>Fecha</th><th>Detalle</th><th>Tipo</th><th>Moneda</th>
                    <th>Monto</th><th>% real</th><th>Incluir real</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((movimiento) => (
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
