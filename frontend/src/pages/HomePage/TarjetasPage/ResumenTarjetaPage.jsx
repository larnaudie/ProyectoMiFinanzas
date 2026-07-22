import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";

const obtenerId = (valor) => (typeof valor === "object" ? valor?._id || "" : valor || "");
const fechaInput = (fecha) => (fecha ? String(fecha).slice(0, 10) : "");
const formatearMonto = (monto, moneda) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency: moneda }).format(Number(monto || 0));
const mensajeError = (error) =>
  error.response?.data?.message || error.response?.data?.mensaje || "No se pudo completar la acción.";

function ResumenTarjetaPage() {
  const { cuentaId, tarjetaId, resumenId } = useParams();
  const [resumen, setResumen] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [pagoVinculando, setPagoVinculando] = useState(null);
  const [referenciaId, setReferenciaId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [resumenResponse, categoriasResponse, subcategoriasResponse, gastosResponse] = await Promise.all([
        api.get(`/tarjetas/${tarjetaId}/resumenes/${resumenId}`),
        api.get("/categorias"),
        api.get("/subcategorias"),
        api.get("/gastos?estado=creado"),
      ]);
      setResumen(resumenResponse.data.resumen);
      setGastos(resumenResponse.data.gastos || []);
      setCategorias(categoriasResponse.data.categorias || []);
      setSubcategorias(subcategoriasResponse.data.subcategorias || []);
      setCandidatos(
        (gastosResponse.data.gastos || []).filter(
          (gasto) => obtenerId(gasto.cuentaId) !== cuentaId,
        ),
      );
    } catch (apiError) {
      console.error("Error al cargar el resumen:", apiError);
      setError(mensajeError(apiError));
    } finally {
      setLoading(false);
    }
  }, [cuentaId, tarjetaId, resumenId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const totales = useMemo(
    () => gastos.reduce(
      (resultado, gasto) => {
        const moneda = gasto.moneda === "USD" ? "USD" : "UYU";
        resultado[moneda] += Number(gasto.montoBancario || 0);
        resultado.montoReal[moneda] += Number(gasto.montoReal || 0);
        return resultado;
      },
      { UYU: 0, USD: 0, montoReal: { UYU: 0, USD: 0 } },
    ),
    [gastos],
  );

  const candidatosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return candidatos.filter((gasto) =>
      !termino ||
      String(gasto.detalle || "").toLowerCase().includes(termino) ||
      String(gasto.cuentaId?.nombreCuenta || "").toLowerCase().includes(termino),
    );
  }, [candidatos, busqueda]);

  const reemplazarGasto = (actualizado) => {
    setGastos((actuales) =>
      actuales.map((gasto) => (gasto._id === actualizado._id ? { ...gasto, ...actualizado } : gasto)),
    );
  };

  const guardarCampo = async (gasto, campo, valor) => {
    setError("");
    setMensaje("Guardando...");
    try {
      const response = await api.patch(`/gastos/${gasto._id}`, { [campo]: valor });
      reemplazarGasto(response.data.gasto);
      setMensaje("Cambio guardado.");
    } catch (apiError) {
      setError(mensajeError(apiError));
      setMensaje("");
    }
  };

  const confirmarSeleccionados = async () => {
    if (seleccionados.length === 0) return;
    setProcesando(true);
    setError("");
    const resultados = await Promise.allSettled(
      seleccionados.map((id) => api.patch(`/gastos/${id}`, { cambiarEstado: true })),
    );
    const exitosos = resultados.filter((resultado) => resultado.status === "fulfilled");
    exitosos.forEach((resultado) => reemplazarGasto(resultado.value.data.gasto));
    const fallidos = resultados.length - exitosos.length;
    setSeleccionados([]);
    setMensaje(`${exitosos.length} movimiento(s) confirmado(s).`);
    if (fallidos) setError(`${fallidos} movimiento(s) siguen pendientes porque les faltan datos, normalmente la subcategoría.`);
    setProcesando(false);
  };

  const vincularPago = async () => {
    if (!pagoVinculando || !referenciaId) return;
    setProcesando(true);
    setError("");
    try {
      await api.patch(`/gastos/${pagoVinculando._id}`, {
        origen: { tipo: "tarjeta", referenciaId },
      });
      setPagoVinculando(null);
      setReferenciaId("");
      setBusqueda("");
      setMensaje("Pago vinculado correctamente.");
      await cargarDatos();
    } catch (apiError) {
      setError(mensajeError(apiError));
    } finally {
      setProcesando(false);
    }
  };

  if (loading) return <section className="page-section"><p>Cargando resumen...</p></section>;

  return (
    <section className="page-section credit-card-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Resumen de tarjeta</p>
          <h1>{resumen?.periodo || fechaInput(resumen?.cierre)}</h1>
          <p>Cierre {fechaInput(resumen?.cierre)} · Vencimiento {fechaInput(resumen?.vencimiento) || "sin fecha"}</p>
        </div>
        <Link className="secondary-link" to={`/cuentas/${cuentaId}/tarjetas/${tarjetaId}`}>Volver a resúmenes</Link>
      </header>

      {error && <p className="inline-error">{error}</p>}
      {mensaje && <p className="import-message">{mensaje}</p>}

      <section className="summary-grid">
        <article><span>Total UYU</span><strong>{formatearMonto(totales.UYU, "UYU")}</strong></article>
        <article><span>Total USD</span><strong>{formatearMonto(totales.USD, "USD")}</strong></article>
        <article><span>Monto real UYU</span><strong>{formatearMonto(totales.montoReal.UYU, "UYU")}</strong></article>
        <article><span>Pendientes</span><strong>{gastos.filter((gasto) => gasto.estado === "pendiente").length}</strong></article>
      </section>

      <section className="credit-card-panel">
        <div className="import-section-header">
          <div>
            <h2>Movimientos</h2>
            <p>Completá la subcategoría y confirmá cuando el movimiento esté listo.</p>
          </div>
          <button type="button" disabled={procesando || seleccionados.length === 0} onClick={confirmarSeleccionados}>
            Confirmar seleccionados ({seleccionados.length})
          </button>
        </div>

        <div className="table-shell import-expenses-table">
          <table>
            <thead>
              <tr>
                <th><span className="sr-only">Seleccionar</span></th><th>Estado</th><th>Fecha</th>
                <th>Detalle</th><th>Tipo</th><th>Monto</th><th>% real</th><th>Incluir</th>
                <th>Categoría</th><th>Subcategoría</th><th>Pago vinculado</th><th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((gasto) => {
                const categoriaId = obtenerId(gasto.categoriaId);
                const subcategoriasDisponibles = subcategorias.filter(
                  (subcategoria) => !categoriaId || obtenerId(subcategoria.categoria) === categoriaId,
                );
                const referencia = gasto.origen?.referenciaId;
                return (
                  <tr key={gasto._id}>
                    <td><input type="checkbox" disabled={gasto.estado === "creado"} checked={seleccionados.includes(gasto._id)} onChange={(e) => setSeleccionados((actuales) => e.target.checked ? [...actuales, gasto._id] : actuales.filter((id) => id !== gasto._id))} /></td>
                    <td><span className={`status-badge ${gasto.estado === "creado" ? "status-created" : "status-pending"}`}>{gasto.estado}</span></td>
                    <td><input className="table-input" type="date" value={fechaInput(gasto.fecha)} onChange={(e) => guardarCampo(gasto, "fecha", e.target.value)} /></td>
                    <td><input className="table-input table-input-wide" value={gasto.detalle || ""} onChange={(e) => reemplazarGasto({ ...gasto, detalle: e.target.value })} onBlur={(e) => guardarCampo(gasto, "detalle", e.target.value)} /></td>
                    <td>
                      <select className="table-select" value={gasto.tipoMovimiento} onChange={(e) => guardarCampo(gasto, "tipoMovimiento", e.target.value)}>
                        <option value="compra">Compra</option><option value="cuota">Cuota</option>
                        <option value="pago">Pago</option><option value="reintegro">Reintegro</option>
                      </select>
                    </td>
                    <td>{formatearMonto(gasto.montoBancario, gasto.moneda || "UYU")}</td>
                    <td><input className="table-input table-input-small" type="number" min="0" max="100" value={gasto.porcentaje ?? ""} onChange={(e) => guardarCampo(gasto, "porcentaje", Number(e.target.value))} /></td>
                    <td><input type="checkbox" checked={Boolean(gasto.incluirMontoReal)} onChange={(e) => guardarCampo(gasto, "incluirMontoReal", e.target.checked)} /></td>
                    <td>
                      <select className="table-select" value={categoriaId} onChange={(e) => guardarCampo(gasto, "categoriaId", e.target.value)}>
                        <option value="">Sin categoría</option>
                        {categorias.map((categoria) => <option key={categoria._id} value={categoria._id}>{categoria.nombreCategoria}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="table-select" value={obtenerId(gasto.subcategoriaId)} onChange={(e) => guardarCampo(gasto, "subcategoriaId", e.target.value)}>
                        <option value="">Sin subcategoría</option>
                        {subcategoriasDisponibles.map((subcategoria) => <option key={subcategoria._id} value={subcategoria._id}>{subcategoria.nombreSubcategoria}</option>)}
                      </select>
                    </td>
                    <td>
                      {gasto.tipoMovimiento === "pago" && (
                        referencia ? (
                          <Link className="reference-link" to={`/cuentas/${obtenerId(referencia.cuentaId)}/gastos/gasto/${obtenerId(referencia)}`}>{referencia.detalle || "Ver vínculo"}</Link>
                        ) : (
                          <button type="button" className="secondary-button" onClick={() => { setPagoVinculando(gasto); setReferenciaId(""); }}>Vincular</button>
                        )
                      )}
                    </td>
                    <td><Link className="compact-link" to={`/cuentas/${cuentaId}/tarjetas/${tarjetaId}/resumenes/${resumenId}/gastos/${gasto._id}`}>Abrir</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {pagoVinculando && (
        <div className="modal-backdrop">
          <section className="modal-card link-payment-modal">
            <header className="modal-header">
              <div><h2>Vincular pago</h2><p>Elegí el movimiento bancario de otra cuenta que representa este pago.</p></div>
            </header>
            <label>
              Buscar por cuenta o detalle
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej: cuenta sueldo" />
            </label>
            <div className="table-shell link-payment-table">
              <table>
                <thead><tr><th></th><th>Cuenta</th><th>Fecha</th><th>Detalle</th><th>Monto</th></tr></thead>
                <tbody>
                  {candidatosFiltrados.map((gasto) => (
                    <tr key={gasto._id} className={referenciaId === gasto._id ? "selected-row" : ""} onClick={() => setReferenciaId(gasto._id)}>
                      <td><input type="radio" checked={referenciaId === gasto._id} onChange={() => setReferenciaId(gasto._id)} /></td>
                      <td>{gasto.cuentaId?.nombreCuenta || "Cuenta"}</td><td>{fechaInput(gasto.fecha)}</td>
                      <td>{gasto.detalle}</td><td>{formatearMonto(gasto.montoBancario, gasto.moneda || "UYU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setPagoVinculando(null)}>Cancelar</button>
              <button type="button" disabled={!referenciaId || procesando} onClick={vincularPago}>Confirmar vínculo</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

export default ResumenTarjetaPage;
