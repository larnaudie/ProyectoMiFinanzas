import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../services/api.js";
import {
  convertirMonedaPrestamo,
  formatearPrestamo,
} from "../../../utils/prestamos.js";

const formularioInicial = {
  nombre: "",
  deudor: "",
  monedaCapital: "USD",
  capitalOriginal: "",
  fechaInicio: new Date().toISOString().slice(0, 10),
  notas: "",
};

const filtrosCobroInicial = {
  texto: "",
  cuentaId: "",
  subcategoriaId: "",
  moneda: "",
  fechaDesde: "",
  fechaHasta: "",
  montoMin: "",
  montoMax: "",
};

const mensajeError = (error) => error.response?.data?.message
  || error.response?.data?.error?.map?.((item) => item.message).join(". ")
  || "No se pudo completar la operación.";

const fechaCorta = (fecha) => fecha
  ? new Date(fecha).toLocaleDateString("es-UY")
  : "Sin fecha";

const cotizacionPayload = (cotizacion) => ({
  fuente: cotizacion?.fuente || "Banco Central del Uruguay",
  fecha: cotizacion?.usd?.fecha || cotizacion?.ui?.fecha || cotizacion?.consultadaEn || null,
  uyuPorDolar: cotizacion?.usd?.uyuPorDolar || null,
  uyuPorUi: cotizacion?.ui?.uyuPorUnidad || null,
});

function DeudaFormModal({ guardando, onClose, onCreate }) {
  const [form, setForm] = useState(formularioInicial);
  const cambiar = (campo, valor) => setForm((actual) => ({ ...actual, [campo]: valor }));

  const enviar = (event) => {
    event.preventDefault();
    onCreate({
      ...form,
      nombre: form.nombre.trim(),
      deudor: form.deudor.trim(),
      capitalOriginal: Number(form.capitalOriginal),
      fechaInicio: form.fechaInicio || null,
      notas: form.notas.trim(),
    });
  };

  return (
    <div className="modal-backdrop receivable-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="edit-modal loan-form-modal receivable-form-modal" onSubmit={enviar}>
        <div className="edit-modal-header">
          <div><span className="page-eyebrow">Nueva cuenta por cobrar</span><h2>Registrar deuda</h2></div>
          <button type="button" className="secondary-button" onClick={onClose}>Cerrar</button>
        </div>
        <p className="loan-form-note">Indicá cuánto te deben. Luego vinculá cada ingreso bancario recibido para actualizar el avance.</p>
        <div className="loan-form-grid loan-form-grid-two">
          <label>Nombre de la deuda
            <input value={form.nombre} onChange={(event) => cambiar("nombre", event.target.value)} placeholder="Ej: Parte del auto" required />
          </label>
          <label>Quién te debe
            <input value={form.deudor} onChange={(event) => cambiar("deudor", event.target.value)} placeholder="Nombre de la persona" required />
          </label>
          <label>Capital original
            <input type="number" step="0.01" min="0.01" value={form.capitalOriginal} onChange={(event) => cambiar("capitalOriginal", event.target.value)} required />
          </label>
          <label>Moneda de la deuda
            <select value={form.monedaCapital} onChange={(event) => cambiar("monedaCapital", event.target.value)}>
              <option value="UYU">UYU</option><option value="USD">USD</option><option value="UI">UI</option>
            </select>
          </label>
          <label>Fecha de inicio
            <input type="date" value={form.fechaInicio} onChange={(event) => cambiar("fechaInicio", event.target.value)} />
          </label>
          <label className="loan-field-wide">Notas
            <textarea rows="3" value={form.notas} onChange={(event) => cambiar("notas", event.target.value)} placeholder="Acuerdo de pago, motivo u otra referencia" />
          </label>
        </div>
        <div className="edit-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button disabled={guardando}>{guardando ? "Guardando..." : "Crear deuda activa"}</button>
        </div>
      </form>
    </div>
  );
}

function CobroModal({
  deuda,
  movimientos,
  cuentas,
  subcategorias,
  paginacion,
  cotizacion,
  cargando,
  vinculando,
  onClose,
  onLink,
  onSearch,
}) {
  const [seleccionadoId, setSeleccionadoId] = useState("");
  const [filtros, setFiltros] = useState(filtrosCobroInicial);
  const seleccionado = movimientos.find((movimiento) => movimiento._id === seleccionadoId);
  const cambiarFiltro = (campo, valor) => setFiltros((actual) => ({ ...actual, [campo]: valor }));
  const buscar = (event) => {
    event.preventDefault();
    setSeleccionadoId("");
    onSearch(filtros, 1);
  };
  const limpiar = () => {
    setFiltros(filtrosCobroInicial);
    setSeleccionadoId("");
    onSearch(filtrosCobroInicial, 1);
  };
  const cambiarPagina = (pagina) => {
    setSeleccionadoId("");
    onSearch(filtros, pagina);
  };
  const montoConvertido = seleccionado
    ? convertirMonedaPrestamo(
      seleccionado.montoBancario,
      seleccionado.moneda,
      deuda.monedaCapital,
      cotizacion,
    )
    : null;

  return (
    <div className="modal-backdrop receivable-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="edit-modal loan-form-modal receivable-payment-modal">
        <div className="edit-modal-header">
          <div><span className="page-eyebrow">Aplicar un ingreso</span><h2>Vincular cobro</h2></div>
          <button type="button" className="secondary-button" onClick={onClose}>Cerrar</button>
        </div>
        <p className="loan-form-note">Elegí un ingreso bancario real. Si usa otra moneda, guardaremos la equivalencia BCU de este momento.</p>
        <form className="receivable-search" onSubmit={buscar}>
          <div className="receivable-search-grid">
            <label className="receivable-search-text">Detalle
              <input value={filtros.texto} onChange={(event) => cambiarFiltro("texto", event.target.value)} placeholder="Nombre, referencia o texto del movimiento" />
            </label>
            <label>Cuenta
              <select value={filtros.cuentaId} onChange={(event) => cambiarFiltro("cuentaId", event.target.value)}>
                <option value="">Todas las cuentas</option>
                {cuentas.filter((cuenta) => cuenta.tipoCuenta !== "credito").map((cuenta) => <option key={cuenta._id} value={cuenta._id}>{cuenta.nombreCuenta}</option>)}
              </select>
            </label>
            <label>Subcategoría
              <select value={filtros.subcategoriaId} onChange={(event) => cambiarFiltro("subcategoriaId", event.target.value)}>
                <option value="">Todas las subcategorías</option>
                {subcategorias.map((subcategoria) => <option key={subcategoria._id} value={subcategoria._id}>{subcategoria.nombreSubcategoria}</option>)}
              </select>
            </label>
            <label>Moneda
              <select value={filtros.moneda} onChange={(event) => cambiarFiltro("moneda", event.target.value)}>
                <option value="">Todas</option><option value="UYU">UYU</option><option value="USD">USD</option><option value="UI">UI</option>
              </select>
            </label>
            <label>Desde
              <input type="date" value={filtros.fechaDesde} onChange={(event) => cambiarFiltro("fechaDesde", event.target.value)} />
            </label>
            <label>Hasta
              <input type="date" value={filtros.fechaHasta} onChange={(event) => cambiarFiltro("fechaHasta", event.target.value)} />
            </label>
            <label>Monto mínimo
              <input type="number" min="0" step="0.01" value={filtros.montoMin} onChange={(event) => cambiarFiltro("montoMin", event.target.value)} placeholder="Sin mínimo" />
            </label>
            <label>Monto máximo
              <input type="number" min="0" step="0.01" value={filtros.montoMax} onChange={(event) => cambiarFiltro("montoMax", event.target.value)} placeholder="Sin máximo" />
            </label>
          </div>
          <div className="receivable-search-actions">
            <button type="button" className="secondary-button" onClick={limpiar}>Limpiar filtros</button>
            <button type="submit" disabled={cargando}>{cargando ? "Buscando..." : "Buscar movimientos"}</button>
          </div>
        </form>
        <div className="receivable-results-heading">
          <strong>{paginacion.total.toLocaleString("es-UY")} movimiento(s) encontrado(s)</strong>
          <span>Página {paginacion.pagina} de {paginacion.totalPaginas}</span>
        </div>
        {cargando ? <p className="empty-state">Buscando ingresos disponibles...</p> : movimientos.length ? (
          <div className="receivable-candidate-list" role="radiogroup" aria-label="Ingresos disponibles">
            {movimientos.map((movimiento) => (
              <button
                type="button"
                role="radio"
                aria-checked={movimiento._id === seleccionadoId}
                className={`receivable-candidate${movimiento._id === seleccionadoId ? " is-selected" : ""}`}
                key={movimiento._id}
                onClick={() => setSeleccionadoId(movimiento._id)}
              >
                <span><strong>{movimiento.detalle}</strong><small>{fechaCorta(movimiento.fecha)} · {movimiento.cuentaId?.nombreCuenta || "Cuenta"}{movimiento.subcategoriaId?.nombreSubcategoria ? ` · ${movimiento.subcategoriaId.nombreSubcategoria}` : ""}</small></span>
                <strong>{formatearPrestamo(movimiento.montoBancario, movimiento.moneda)}</strong>
              </button>
            ))}
          </div>
        ) : <div className="loan-empty-state"><strong>No encontramos ingresos con esos filtros.</strong><span>Probá limpiar algún filtro o verificá que el cobro esté creado como ingreso bancario.</span></div>}

        {paginacion.totalPaginas > 1 && (
          <div className="receivable-pagination">
            <button type="button" className="secondary-button" disabled={cargando || paginacion.pagina <= 1} onClick={() => cambiarPagina(paginacion.pagina - 1)}>Anterior</button>
            <span>{((paginacion.pagina - 1) * paginacion.limite) + 1}–{Math.min(paginacion.pagina * paginacion.limite, paginacion.total)} de {paginacion.total}</span>
            <button type="button" className="secondary-button" disabled={cargando || paginacion.pagina >= paginacion.totalPaginas} onClick={() => cambiarPagina(paginacion.pagina + 1)}>Siguiente</button>
          </div>
        )}

        {seleccionado && (
          <div className="receivable-conversion-preview">
            <span>Este cobro sumará</span>
            <strong>{montoConvertido === null ? "El servidor consultará al BCU" : formatearPrestamo(montoConvertido, deuda.monedaCapital)}</strong>
            {seleccionado.moneda !== deuda.monedaCapital && (
              <small>{formatearPrestamo(seleccionado.montoBancario, seleccionado.moneda)} convertido a {deuda.monedaCapital} con la referencia BCU.</small>
            )}
          </div>
        )}

        <div className="edit-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button type="button" disabled={!seleccionadoId || vinculando} onClick={() => onLink(seleccionadoId)}>{vinculando ? "Vinculando..." : "Vincular cobro"}</button>
        </div>
      </section>
    </div>
  );
}

function DeudaCard({ deuda, abierto, procesando, onToggle, onOpenLink, onUnlink, onState, onDelete }) {
  const { resumen } = deuda;
  return (
    <article className={`loan-card receivable-card${deuda.estado === "saldada" ? " is-settled" : ""}`}>
      <header className="loan-card-header">
        <div><span>Cuenta por cobrar · {deuda.monedaCapital}</span><h3>{deuda.nombre}</h3><small>{deuda.deudor} · desde {fechaCorta(deuda.fechaInicio)}</small></div>
        <div className="loan-card-header-actions"><span className={`loan-status is-${deuda.estado}`}>{deuda.estado}</span><button type="button" className="secondary-button" onClick={onToggle}>{abierto ? "Cerrar detalle" : "Ver detalle"}</button></div>
      </header>
      <div className="loan-card-kpis">
        <div><span>Capital original</span><strong>{formatearPrestamo(resumen.capital, deuda.monedaCapital)}</strong></div>
        <div><span>Cobrado</span><strong>{formatearPrestamo(resumen.cobrado, deuda.monedaCapital)}</strong></div>
        <div><span>Falta cobrar</span><strong>{formatearPrestamo(resumen.pendiente, deuda.monedaCapital)}</strong></div>
        <div><span>Cobros vinculados</span><strong>{deuda.cobros.length}</strong></div>
      </div>
      <div
        className="loan-progress receivable-progress"
        role="progressbar"
        aria-label={`Avance de ${deuda.nombre}`}
        aria-valuenow={resumen.porcentaje}
        aria-valuemin="0"
        aria-valuemax="100"
      ><span style={{ width: `${resumen.porcentaje}%` }} /><small>{resumen.porcentaje.toLocaleString("es-UY", { maximumFractionDigits: 2 })}% cobrado</small></div>

      {abierto && (
        <div className="loan-card-detail">
          {deuda.notas && <p className="receivable-notes">{deuda.notas}</p>}
          {resumen.excedente > 0 && <p className="receivable-overpayment">Hay un excedente vinculado de {formatearPrestamo(resumen.excedente, deuda.monedaCapital)}.</p>}
          <div className="loan-detail-actions">
            {deuda.estado === "activa" ? (
              <>
                <button type="button" disabled={procesando} onClick={onOpenLink}>Vincular cobro</button>
                <button type="button" className="secondary-button" disabled={!resumen.completa || procesando} title={!resumen.completa ? "Disponible cuando el cobro llegue al 100%" : ""} onClick={() => onState("saldada")}>Marcar como saldada</button>
              </>
            ) : <button type="button" className="secondary-button" disabled={procesando} onClick={() => onState("activa")}>Reabrir deuda</button>}
            <button type="button" className="danger-button" disabled={procesando} onClick={onDelete}>Eliminar deuda</button>
          </div>
          <div className="table-shell"><table className="receivable-payments-table"><thead><tr><th>Fecha</th><th>Movimiento vinculado</th><th>Ingreso original</th><th>Aplicado a la deuda</th><th>Cotización guardada</th><th /></tr></thead>
            <tbody>{deuda.cobros.length ? deuda.cobros.map((cobro) => {
              const gasto = cobro.gastoId;
              const cuentaId = gasto?.cuentaId?._id || gasto?.cuentaId;
              const conversion = cobro.monedaOriginal !== deuda.monedaCapital;
              return <tr key={cobro._id || gasto?._id}><td>{fechaCorta(cobro.fecha)}</td><td title={gasto?.detalle}>{gasto?.detalle || "Movimiento no disponible"}</td><td>{formatearPrestamo(cobro.montoOriginal, cobro.monedaOriginal)}</td><td><strong>{formatearPrestamo(cobro.montoAplicado, deuda.monedaCapital)}</strong></td><td>{conversion ? <span className="receivable-rate">{cobro.cotizacion?.uyuPorDolar ? `US$ 1 = $ ${Number(cobro.cotizacion.uyuPorDolar).toLocaleString("es-UY")}` : "Referencia BCU"}<small>{fechaCorta(cobro.cotizacion?.fecha)}</small></span> : "Misma moneda"}</td><td><div className="loan-payment-actions">{gasto?._id && cuentaId && <Link className="secondary-link compact-link" to={`/cuentas/${cuentaId}/gastos/gasto/${gasto._id}`}>Ver movimiento</Link>}<button type="button" className="secondary-button" disabled={procesando} onClick={() => onUnlink(gasto?._id)}>Quitar</button></div></td></tr>;
            }) : <tr><td colSpan="6" className="loan-empty-payment">Todavía no vinculaste ningún cobro.</td></tr>}</tbody>
          </table></div>
        </div>
      )}
    </article>
  );
}

export default function DeudasCobrarPanel({ cotizacion, cuentas = [], subcategorias = [] }) {
  const [deudas, setDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [formAbierto, setFormAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [abiertas, setAbiertas] = useState({});
  const [procesandoId, setProcesandoId] = useState("");
  const [deudaCobro, setDeudaCobro] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [paginacion, setPaginacion] = useState({
    pagina: 1,
    limite: 25,
    total: 0,
    totalPaginas: 1,
  });

  const resumen = useMemo(() => deudas.reduce((total, deuda) => ({
    activas: total.activas + (deuda.estado === "activa" ? 1 : 0),
    saldadas: total.saldadas + (deuda.estado === "saldada" ? 1 : 0),
  }), { activas: 0, saldadas: 0 }), [deudas]);

  const cargar = async () => {
    setCargando(true); setError("");
    try {
      const response = await api.get("/deudas");
      setDeudas(response.data.deudas || []);
    } catch (apiError) { setError(mensajeError(apiError)); } finally { setCargando(false); }
  };

  useEffect(() => { cargar(); }, []);

  const reemplazar = (deuda) => setDeudas((actual) => actual.map((item) => item._id === deuda._id ? deuda : item));
  const crear = async (payload) => {
    setGuardando(true); setError(""); setMensaje("");
    try {
      const response = await api.post("/deudas", payload);
      setDeudas((actual) => [response.data.deuda, ...actual]);
      setAbiertas((actual) => ({ ...actual, [response.data.deuda._id]: true }));
      setFormAbierto(false);
      setMensaje("Deuda creada. Ya podés vincular los cobros que vayas recibiendo.");
    } catch (apiError) { setError(mensajeError(apiError)); } finally { setGuardando(false); }
  };
  const buscarMovimientos = async (filtros = filtrosCobroInicial, pagina = 1) => {
    setCargandoMovimientos(true); setError("");
    try {
      const response = await api.get("/deudas/candidatos", {
        params: { ...filtros, pagina, limite: 25 },
      });
      setMovimientos(response.data.movimientos || []);
      setPaginacion(response.data.paginacion || {
        pagina: 1, limite: 25, total: 0, totalPaginas: 1,
      });
    } catch (apiError) { setError(mensajeError(apiError)); } finally { setCargandoMovimientos(false); }
  };
  const abrirCobros = (deuda) => {
    setDeudaCobro(deuda);
    setMovimientos([]);
    setPaginacion({ pagina: 1, limite: 25, total: 0, totalPaginas: 1 });
    buscarMovimientos(filtrosCobroInicial, 1);
  };
  const vincular = async (gastoId) => {
    if (!deudaCobro) return;
    setProcesandoId(deudaCobro._id); setError("");
    try {
      const response = await api.post(`/deudas/${deudaCobro._id}/cobros`, { gastoId, cotizacion: cotizacionPayload(cotizacion) });
      reemplazar(response.data.deuda);
      setDeudaCobro(null);
      setMensaje("Cobro vinculado y progreso actualizado.");
    } catch (apiError) { setError(mensajeError(apiError)); } finally { setProcesandoId(""); }
  };
  const desvincular = async (deudaId, gastoId) => {
    if (!gastoId || !window.confirm("¿Quitar este cobro de la deuda? El movimiento bancario se conserva.")) return;
    setProcesandoId(deudaId); setError("");
    try {
      const response = await api.delete(`/deudas/${deudaId}/cobros/${gastoId}`);
      reemplazar(response.data.deuda); setMensaje("Cobro desvinculado; el movimiento bancario se conservó.");
    } catch (apiError) { setError(mensajeError(apiError)); } finally { setProcesandoId(""); }
  };
  const cambiarEstado = async (deudaId, estado) => {
    setProcesandoId(deudaId); setError("");
    try {
      const response = await api.patch(`/deudas/${deudaId}/estado`, { estado });
      reemplazar(response.data.deuda); setMensaje(estado === "saldada" ? "Deuda marcada como saldada." : "Deuda reabierta.");
    } catch (apiError) { setError(mensajeError(apiError)); } finally { setProcesandoId(""); }
  };
  const eliminar = async (deudaId) => {
    if (!window.confirm("¿Eliminar esta deuda? Los movimientos vinculados se conservarán.")) return;
    setProcesandoId(deudaId); setError("");
    try {
      await api.delete(`/deudas/${deudaId}`);
      setDeudas((actual) => actual.filter((deuda) => deuda._id !== deudaId)); setMensaje("Deuda eliminada; ningún movimiento fue borrado.");
    } catch (apiError) { setError(mensajeError(apiError)); } finally { setProcesandoId(""); }
  };

  return (
    <section className="loan-panel receivables-panel" id="deudas-cobrar">
      <header className="loan-panel-header receivables-header">
        <div><span className="page-eyebrow">Dinero que te deben</span><h2>Deudas a cobrar</h2><p>Vinculá los ingresos recibidos y seguí el capital pendiente, incluso cuando el cobro llega en otra moneda.</p></div>
        <div className="receivables-header-actions"><span>{resumen.activas} activas · {resumen.saldadas} saldadas</span><button type="button" onClick={() => setFormAbierto(true)}>Registrar deuda</button></div>
      </header>
      {error && <p className="inline-error receivable-feedback">{error}</p>}
      {mensaje && <p className="loans-success receivable-feedback">{mensaje}</p>}
      <div className="receivable-bcu-note"><strong>Conversión BCU congelada por cobro</strong><span>{cotizacion?.usd?.uyuPorDolar ? `Referencia actual: US$ 1 = $ ${Number(cotizacion.usd.uyuPorDolar).toLocaleString("es-UY")}` : "La API consultará la referencia del BCU al vincular monedas diferentes."}</span></div>
      <div className="loan-list">{cargando && !deudas.length ? <p className="empty-state">Cargando deudas...</p> : deudas.length ? deudas.map((deuda) => <DeudaCard key={deuda._id} deuda={deuda} abierto={Boolean(abiertas[deuda._id])} procesando={procesandoId === deuda._id} onToggle={() => setAbiertas((actual) => ({ ...actual, [deuda._id]: !actual[deuda._id] }))} onOpenLink={() => abrirCobros(deuda)} onUnlink={(gastoId) => desvincular(deuda._id, gastoId)} onState={(estado) => cambiarEstado(deuda._id, estado)} onDelete={() => eliminar(deuda._id)} />) : <div className="loan-empty-state"><strong>No tenés deudas a cobrar registradas.</strong><span>Creá una con el capital acordado y vinculá cada transferencia que recibas.</span></div>}</div>
      {formAbierto && <DeudaFormModal guardando={guardando} onClose={() => setFormAbierto(false)} onCreate={crear} />}
      {deudaCobro && <CobroModal deuda={deudaCobro} movimientos={movimientos} cuentas={cuentas} subcategorias={subcategorias} paginacion={paginacion} cotizacion={cotizacion} cargando={cargandoMovimientos} vinculando={procesandoId === deudaCobro._id} onClose={() => setDeudaCobro(null)} onLink={vincular} onSearch={buscarMovimientos} />}
    </section>
  );
}
