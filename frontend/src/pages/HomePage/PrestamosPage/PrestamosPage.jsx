import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../services/api.js";
import { useCotizacionUi } from "../../../hooks/useCotizacionUi.js";
import { convertirMontoUi } from "../../../utils/cotizaciones.js";
import {
  calcularTeaDesdeCuota,
  calcularSimulacionPrestamo,
  convertirMonedaPrestamo,
  formatearPrestamo,
} from "../../../utils/prestamos.js";
import PrestamoSimulatorModal from "./PrestamoSimulatorModal.jsx";
import DeudasCobrarPanel from "./DeudasCobrarPanel.jsx";

const simuladorInicial = {
  tipo: "auto",
  monedaCapital: "UI",
  capitalFinanciado: "93091.43",
  tea: "6.30",
  plazoCuotas: "72",
  plazoAnios: "6",
  entregaInicial: "10000",
  monedaEntrega: "USD",
  valorTotal: "",
  porcentajeFinanciado: "",
  cuotaInformada: "",
};

const formularioInicial = {
  nombre: "",
  tipo: "financiacion",
  entidad: "",
  monedaCapital: "UYU",
  capitalFinanciado: "",
  cotizacionUsdUyu: "",
  cotizacionUiUyu: "",
  montoConocido: "",
  monedaConocida: "USD",
  valorTotal: "",
  porcentajeFinanciado: "",
  cuotaInformada: "",
  tea: "",
  plazoCuotas: "",
  plazoAnios: "",
  entregaInicial: "",
  monedaEntrega: "USD",
  fechaInicio: new Date().toISOString().slice(0, 10),
  diaVencimiento: "",
  cuentaId: "",
  subcategoriaId: "",
  textos: "",
  referencia: "",
  notas: "",
};

const etiquetaTipo = (tipo) => ({
  auto: "Automotor",
  personal: "Personal",
  hipotecario: "Hipotecario",
  financiacion: "Financiación",
  otro: "Otro",
}[tipo] || tipo);

const obtenerMensajeError = (error) => error.response?.data?.message
  || error.response?.data?.mensaje
  || error.response?.data?.error?.map?.((item) => item.message).join(". ")
  || "No se pudo completar la operación.";

export function SimuladorPrestamos({ cotizacion, onRegistrar }) {
  const [datos, setDatos] = useState(simuladorInicial);
  const [mostrarTabla, setMostrarTabla] = useState(false);
  const resultado = useMemo(() => calcularSimulacionPrestamo({
    capital: datos.capitalFinanciado,
    tea: datos.tea,
    plazoCuotas: datos.plazoCuotas,
  }), [datos.capitalFinanciado, datos.plazoCuotas, datos.tea]);
  const equivalenciaUi = datos.monedaCapital === "UI" && cotizacion
    ? convertirMontoUi(resultado.cuota, cotizacion)
    : null;
  const entregaEnMonedaCapital = useMemo(() => convertirMonedaPrestamo(
    datos.entregaInicial,
    datos.monedaEntrega,
    datos.monedaCapital,
    cotizacion,
  ), [cotizacion, datos.entregaInicial, datos.monedaCapital, datos.monedaEntrega]);
  const capitalSugerido = useMemo(() => {
    const total = Number(datos.valorTotal) || 0;
    const porcentaje = Number(datos.porcentajeFinanciado) || 0;
    if (!total) return null;
    if (porcentaje > 0) return total * porcentaje / 100;
    return Math.max(0, total - (entregaEnMonedaCapital || 0));
  }, [datos.porcentajeFinanciado, datos.valorTotal, entregaEnMonedaCapital]);
  const teaImplicita = useMemo(() => calcularTeaDesdeCuota({
    capital: datos.capitalFinanciado,
    plazoCuotas: datos.plazoCuotas,
    cuota: datos.cuotaInformada,
  }), [datos.capitalFinanciado, datos.cuotaInformada, datos.plazoCuotas]);
  const equivalencias = useMemo(() => ["UYU", "USD", "UI"]
    .filter((moneda) => moneda !== datos.monedaCapital)
    .map((moneda) => ({
      moneda,
      total: convertirMonedaPrestamo(resultado.total, datos.monedaCapital, moneda, cotizacion),
    }))
    .filter((item) => item.total !== null), [cotizacion, datos.monedaCapital, resultado.total]);
  const cambiar = (campo, valor) => setDatos((actual) => {
    if (campo === "plazoCuotas") {
      return { ...actual, plazoCuotas: valor, plazoAnios: valor ? String(Number(valor) / 12) : "" };
    }
    if (campo === "plazoAnios") {
      return { ...actual, plazoAnios: valor, plazoCuotas: valor ? String(Math.round(Number(valor) * 12)) : "" };
    }
    return { ...actual, [campo]: valor };
  });

  return (
    <section className="loan-panel loan-simulator" id="simulador-prestamos">
      <header className="loan-panel-header">
        <div>
          <span className="page-eyebrow">Proyección</span>
          <h2>Simulador de préstamos</h2>
          <p>Compará préstamos personales, automotores, hipotecarios o financiaciones con cuota francesa.</p>
        </div>
      </header>

      <div className="loan-simulator-fields">
        <label>Tipo
          <select value={datos.tipo} onChange={(e) => cambiar("tipo", e.target.value)}>
            <option value="personal">Personal</option>
            <option value="auto">Automotor</option>
            <option value="hipotecario">Hipotecario</option>
            <option value="financiacion">Financiación</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label>Moneda
          <select value={datos.monedaCapital} onChange={(e) => cambiar("monedaCapital", e.target.value)}>
            <option value="UYU">UYU</option><option value="USD">USD</option><option value="UI">UI</option>
          </select>
        </label>
        <label>Capital financiado
          <input type="number" step="0.01" min="0" value={datos.capitalFinanciado} onChange={(e) => cambiar("capitalFinanciado", e.target.value)} />
        </label>
        <label>TEA (%)
          <input type="number" step="0.01" min="0" value={datos.tea} onChange={(e) => cambiar("tea", e.target.value)} />
        </label>
        <label>Plazo (cuotas)
          <input type="number" min="1" value={datos.plazoCuotas} onChange={(e) => cambiar("plazoCuotas", e.target.value)} />
        </label>
        <label>Plazo ({"a\u00f1os"})
          <input type="number" step="0.5" min="0" value={datos.plazoAnios} onChange={(e) => cambiar("plazoAnios", e.target.value)} />
        </label>
        <label>Entrega inicial
          <div className="loan-inline-input">
            <select value={datos.monedaEntrega} onChange={(e) => cambiar("monedaEntrega", e.target.value)}>
              <option value="UYU">UYU</option><option value="USD">USD</option><option value="UI">UI</option>
            </select>
            <input type="number" step="0.01" min="0" value={datos.entregaInicial} onChange={(e) => cambiar("entregaInicial", e.target.value)} />
          </div>
        </label>
      </div>

      <details className="loan-simulator-helper" open>
        <summary>{"Herramientas de c\u00e1lculo de Econom\u00edaWeb"}</summary>
        <p>{"Pod\u00e9s partir del capital financiado, o calcularlo desde el valor total y la entrega inicial."}</p>
        <div className="loan-helper-grid">
          <label>Valor total ({datos.monedaCapital})
            <input type="number" step="0.01" min="0" value={datos.valorTotal} onChange={(e) => cambiar("valorTotal", e.target.value)} placeholder="Opcional" />
          </label>
          <label>Porcentaje financiado (%)
            <input type="number" step="0.01" min="0" max="100" value={datos.porcentajeFinanciado} onChange={(e) => cambiar("porcentajeFinanciado", e.target.value)} placeholder={"Vac\u00edo: resta la entrega"} />
          </label>
          <div className="loan-helper-result">
            <span>Capital calculado</span>
            <strong>{capitalSugerido === null ? "Complet\u00e1 el valor total" : formatearPrestamo(capitalSugerido, datos.monedaCapital)}</strong>
            <button type="button" className="secondary-button" disabled={capitalSugerido === null} onClick={() => cambiar("capitalFinanciado", String(capitalSugerido))}>Usar este capital</button>
          </div>
          <label>Cuota conocida ({datos.monedaCapital})
            <input type="number" step="0.01" min="0" value={datos.cuotaInformada} onChange={(e) => cambiar("cuotaInformada", e.target.value)} placeholder="Opcional" />
          </label>
          <div className="loan-helper-result">
            <span>{"TEA impl\u00edcita"}</span>
            <strong>{teaImplicita === null ? "No calculable" : `${teaImplicita.toLocaleString("es-UY", { maximumFractionDigits: 4 })}%`}</strong>
            <button type="button" className="secondary-button" disabled={teaImplicita === null} onClick={() => cambiar("tea", String(teaImplicita))}>Usar esta TEA</button>
          </div>
        </div>
      </details>

      <div className="loan-simulator-results">
        <article><span>Cuota teórica</span><strong>{formatearPrestamo(resultado.cuota, datos.monedaCapital)}</strong>{equivalenciaUi && <small>≈ {formatearPrestamo(equivalenciaUi.montoUyu, "UYU")} · {formatearPrestamo(equivalenciaUi.montoUsd, "USD")}</small>}</article>
        <article><span>Total financiado</span><strong>{formatearPrestamo(resultado.total, datos.monedaCapital)}</strong>{equivalencias.length > 0 && <small>{equivalencias.map((item) => formatearPrestamo(item.total, item.moneda)).join(" \u00b7 ")}</small>}</article>
        <article><span>Intereses totales</span><strong>{formatearPrestamo(resultado.interesTotal, datos.monedaCapital)}</strong></article>
        <article><span>Tasa efectiva mensual</span><strong>{resultado.tasaMensual.toLocaleString("es-UY", { maximumFractionDigits: 4 })}%</strong></article>
      </div>

      <div className="loan-simulator-actions">
        <button type="button" className="secondary-button" onClick={() => setMostrarTabla((valor) => !valor)}>{mostrarTabla ? "Ocultar cronograma" : "Ver cronograma"}</button>
        <button type="button" onClick={() => onRegistrar(datos, resultado)}>Registrar como préstamo activo</button>
      </div>

      {mostrarTabla && (
        <div className="table-shell loan-schedule-preview">
          <table><thead><tr><th>Cuota</th><th>Pago</th><th>Interés</th><th>Capital</th><th>Saldo</th></tr></thead>
            <tbody>{resultado.cronograma.map((fila) => <tr key={fila.numero}><td>{fila.numero}</td><td>{formatearPrestamo(fila.cuota, datos.monedaCapital)}</td><td>{formatearPrestamo(fila.interes, datos.monedaCapital)}</td><td>{formatearPrestamo(fila.amortizacion, datos.monedaCapital)}</td><td>{formatearPrestamo(fila.saldo, datos.monedaCapital)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function PrestamoForm({ form, cuentas, subcategorias, guardando, esEdicion, onChange, onClose, onSubmit }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="edit-modal loan-form-modal" onSubmit={onSubmit}>
        {esEdicion && <p className="loan-editing-notice">{"Este pr\u00e9stamo ya existe: se actualizar\u00e1 el registro actual y no se crear\u00e1 un duplicado."}</p>}
        <div className="edit-modal-header"><div><span className="page-eyebrow">Nuevo compromiso</span><h2>Registrar préstamo</h2></div><button type="button" className="secondary-button" onClick={onClose}>Cerrar</button></div>
        <p className="loan-form-note">La cuota real no se crea aquí: se detecta y vincula desde tus gastos bancarios.</p>
        <div className="loan-form-grid">
          <label>Nombre<input value={form.nombre} onChange={(e) => onChange("nombre", e.target.value)} required /></label>
          <label>Tipo<select value={form.tipo} onChange={(e) => onChange("tipo", e.target.value)}><option value="personal">Personal</option><option value="auto">Automotor</option><option value="hipotecario">Hipotecario</option><option value="financiacion">Financiación</option><option value="otro">Otro</option></select></label>
          <label>Entidad<input value={form.entidad} onChange={(e) => onChange("entidad", e.target.value)} placeholder="Banco o financiera" /></label>
          <label>Moneda del capital<select value={form.monedaCapital} onChange={(e) => onChange("monedaCapital", e.target.value)}><option value="UYU">UYU</option><option value="USD">USD</option><option value="UI">UI</option></select></label>
          <label>Capital financiado<input type="number" step="0.01" min="0" value={form.capitalFinanciado} onChange={(e) => onChange("capitalFinanciado", e.target.value)} required /></label>
          <label>TEA (%)<input type="number" step="0.01" min="0" value={form.tea} onChange={(e) => onChange("tea", e.target.value)} required /></label>
          <label>Cuotas totales<input type="number" min="1" value={form.plazoCuotas} onChange={(e) => onChange("plazoCuotas", e.target.value)} required /></label>
          <label>Fecha de inicio<input type="date" value={form.fechaInicio} onChange={(e) => onChange("fechaInicio", e.target.value)} /></label>
          <label>Día habitual (opcional)<input type="number" min="1" max="31" value={form.diaVencimiento} onChange={(e) => onChange("diaVencimiento", e.target.value)} placeholder="Sin definir" /></label>
          <label>Entrega inicial<div className="loan-inline-input"><select value={form.monedaEntrega} onChange={(e) => onChange("monedaEntrega", e.target.value)}><option value="UYU">UYU</option><option value="USD">USD</option><option value="UI">UI</option></select><input type="number" step="0.01" min="0" value={form.entregaInicial} onChange={(e) => onChange("entregaInicial", e.target.value)} /></div></label>
        </div>
        <fieldset className="loan-detection-fields"><legend>Detección automática de cuotas</legend>
          <label>Cuenta debitada<select value={form.cuentaId} onChange={(e) => onChange("cuentaId", e.target.value)}><option value="">Sin detección por cuenta</option>{cuentas.filter((c) => c.tipoCuenta !== "credito").map((c) => <option key={c._id} value={c._id}>{c.nombreCuenta}</option>)}</select></label>
          <label>Subcategoría<select value={form.subcategoriaId} onChange={(e) => onChange("subcategoriaId", e.target.value)}><option value="">Sin detección por subcategoría</option>{subcategorias.map((s) => <option key={s._id} value={s._id}>{s.nombreSubcategoria}</option>)}</select></label>
          <label>Texto del detalle<input value={form.textos} onChange={(e) => onChange("textos", e.target.value)} placeholder="Ej: PAGO MI AUTO" /></label>
          <label>Referencia exacta<input value={form.referencia} onChange={(e) => onChange("referencia", e.target.value)} placeholder="Ej: 52681977" /></label>
        </fieldset>
        <label>Notas<textarea rows="3" value={form.notas} onChange={(e) => onChange("notas", e.target.value)} /></label>
        <div className="edit-modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button disabled={guardando}>{guardando ? "Guardando..." : esEdicion ? "Actualizar y detectar cuotas" : "Guardar y detectar cuotas"}</button></div>
      </form>
    </div>
  );
}

function PrestamoCard({ prestamo, abierto, procesando, onToggle, onReconcile, onUnlink, onDelete }) {
  const { resumen } = prestamo;
  const progreso = prestamo.plazoCuotas ? (resumen.cuotasPagadas / prestamo.plazoCuotas) * 100 : 0;
  return (
    <article className="loan-card">
      <header className="loan-card-header"><div><span>{etiquetaTipo(prestamo.tipo)} · {prestamo.monedaCapital}</span><h3>{prestamo.nombre}</h3><small>{prestamo.entidad || "Entidad no informada"}</small></div><div className="loan-card-header-actions"><span className={`loan-status is-${prestamo.estado}`}>{prestamo.estado}</span><button type="button" className="secondary-button" onClick={onToggle}>{abierto ? "Cerrar detalle" : "Ver detalle"}</button></div></header>
      <div className="loan-card-kpis"><div><span>Capital pendiente</span><strong>{formatearPrestamo(resumen.capitalPendiente, prestamo.monedaCapital)}</strong></div><div><span>Cuota teórica</span><strong>{formatearPrestamo(resumen.cuotaTeorica, prestamo.monedaCapital)}</strong></div><div><span>Cuotas pagadas</span><strong>{resumen.cuotasPagadas} / {prestamo.plazoCuotas}</strong></div><div><span>Próximo vencimiento</span><strong>{prestamo.diaVencimiento ? `Día ${prestamo.diaVencimiento}` : "Sin definir"}</strong></div></div>
      <div className="loan-progress"><span style={{ width: `${Math.min(100, progreso)}%` }} /><small>{progreso.toLocaleString("es-UY", { maximumFractionDigits: 1 })}% conciliado</small></div>
      {abierto && <div className="loan-card-detail">
        <div className="loan-detection-summary"><div><span>Cuenta</span><strong>{prestamo.reglaDeteccion?.cuentaId?.nombreCuenta || "No configurada"}</strong></div><div><span>Subcategoría</span><strong>{prestamo.reglaDeteccion?.subcategoriaId?.nombreSubcategoria || "No configurada"}</strong></div><div><span>Texto / referencia</span><strong>{[...(prestamo.reglaDeteccion?.textos || []), prestamo.reglaDeteccion?.referencia].filter(Boolean).join(" · ") || "No configurado"}</strong></div></div>
        <div className="loan-detail-actions"><button type="button" disabled={procesando} onClick={onReconcile}>{procesando ? "Conciliando..." : "Buscar cuotas ahora"}</button><button type="button" className="danger-button" onClick={onDelete}>Eliminar préstamo</button></div>
        <div className="table-shell"><table><thead><tr><th>Cuota</th><th>Fecha</th><th>Gasto detectado</th><th>Débito real</th><th>Origen</th><th /></tr></thead><tbody>{prestamo.pagos.length ? prestamo.pagos.map((pago) => { const gasto = pago.gastoId; const cuentaId = gasto?.cuentaId?._id || gasto?.cuentaId; return <tr key={`${pago.cuotaNumero}-${gasto?._id || pago.fecha}`}><td>{pago.cuotaNumero} / {prestamo.plazoCuotas}</td><td>{new Date(pago.fecha).toLocaleDateString("es-UY")}</td><td title={gasto?.detalle}>{gasto?.detalle || "Gasto no disponible"}</td><td>{formatearPrestamo(Math.abs(pago.montoDebitado), pago.monedaDebito)}</td><td><span className="loan-auto-badge">Automático</span></td><td><div className="loan-payment-actions">{gasto?._id && cuentaId && <Link className="secondary-link compact-link" to={`/cuentas/${cuentaId}/gastos/gasto/${gasto._id}`}>Ver gasto</Link>}<button type="button" className="secondary-button" onClick={() => onUnlink(gasto?._id)}>Quitar</button></div></td></tr>; }) : <tr><td colSpan="6" className="loan-empty-payment">Todavía no se detectaron cuotas.</td></tr>}</tbody></table></div>
      </div>}
    </article>
  );
}

function PrestamosPage() {
  const [prestamos, setPrestamos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [prestamoEditandoId, setPrestamoEditandoId] = useState("");
  const [form, setForm] = useState(formularioInicial);
  const [guardando, setGuardando] = useState(false);
  const [abiertos, setAbiertos] = useState({});
  const [procesandoId, setProcesandoId] = useState("");
  const cotizacionUi = useCotizacionUi(true);

  const cargar = async () => {
    setCargando(true); setError("");
    try {
      const [prestamosResponse, cuentasResponse, subcategoriasResponse] = await Promise.all([api.get("/prestamos"), api.get("/cuentas"), api.get("/subcategorias")]);
      const prestamosRecibidos = prestamosResponse.data.prestamos || [];
      const cuentasRecibidas = cuentasResponse.data.cuentas || [];
      const subcategoriasRecibidas = [...(subcategoriasResponse.data.subcategorias || [])].sort((a, b) => a.nombreSubcategoria.localeCompare(b.nombreSubcategoria, "es"));
      setPrestamos(prestamosRecibidos); setCuentas(cuentasRecibidas); setSubcategorias(subcategoriasRecibidas);
      setForm((actual) => ({ ...actual, cuentaId: actual.cuentaId || cuentasRecibidas.find((c) => c.nombreCuenta === "Caja Ahorro en UYU")?._id || "", subcategoriaId: actual.subcategoriaId || subcategoriasRecibidas.find((s) => s.nombreSubcategoria === "Auto Cuotas")?._id || "" }));
    } catch (apiError) { setError(obtenerMensajeError(apiError)); } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    if (!cotizacionUi.cotizacion) return;
    setForm((actual) => ({
      ...actual,
      cotizacionUsdUyu: actual.cotizacionUsdUyu
        || String(cotizacionUi.cotizacion?.usd?.uyuPorDolar || ""),
      cotizacionUiUyu: actual.cotizacionUiUyu
        || String(cotizacionUi.cotizacion?.ui?.uyuPorUnidad || ""),
    }));
  }, [cotizacionUi.cotizacion]);

  const resumenGlobal = useMemo(() => prestamos.reduce((total, p) => ({ activos: total.activos + (p.estado === "activo" ? 1 : 0), cuotasPagadas: total.cuotasPagadas + p.resumen.cuotasPagadas, cuotasRestantes: total.cuotasRestantes + p.resumen.cuotasRestantes }), { activos: 0, cuotasPagadas: 0, cuotasRestantes: 0 }), [prestamos]);
  const registrarSimulacion = () => {
    setPrestamoEditandoId("");
    setForm(() => ({
      ...formularioInicial,
      cuentaId: "",
      subcategoriaId: "",
      cotizacionUsdUyu: String(cotizacionUi.cotizacion?.usd?.uyuPorDolar || ""),
      cotizacionUiUyu: String(cotizacionUi.cotizacion?.ui?.uyuPorUnidad || ""),
    }));
    setModalAbierto(true);
  };
  const cambiarForm = (campo, valor) => setForm((actual) => ({ ...actual, [campo]: valor }));
  const guardarPrestamo = async (event, capitalCalculado) => {
    event.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const textos = form.textos.split(",").map((texto) => texto.trim()).filter(Boolean);
      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        entidad: form.entidad?.trim() || "",
        monedaCapital: form.monedaCapital,
        capitalFinanciado: Number(capitalCalculado),
        entregaInicial: { monto: Number(form.entregaInicial) || 0, moneda: form.monedaEntrega },
        tea: Number(form.tea) || 0,
        plazoCuotas: Number(form.plazoCuotas),
        sistemaAmortizacion: "frances",
        fechaInicio: form.fechaInicio || null,
        diaVencimiento: form.diaVencimiento ? Number(form.diaVencimiento) : null,
        notas: form.notas || "",
        reglaDeteccion: {
          activa: Boolean(form.cuentaId || form.subcategoriaId || textos.length || form.referencia),
          cuentaId: form.cuentaId || null,
          subcategoriaId: form.subcategoriaId || null,
          textos,
          referencia: form.referencia?.trim() || "",
          desde: form.fechaInicio || null,
        },
      };
      const response = await api.post("/prestamos", payload);
      setPrestamos((actual) => [response.data.prestamo, ...actual]);
      setAbiertos((actual) => ({ ...actual, [response.data.prestamo._id]: true }));
      setModalAbierto(false);
      setMensaje(`Préstamo creado. Se detectaron ${response.data.prestamo.resumen.cuotasPagadas} cuota(s).`);
    } catch (apiError) {
      setError(obtenerMensajeError(apiError));
    } finally {
      setGuardando(false);
    }
  };
  const reconciliar = async (id) => { setProcesandoId(id); setError(""); try { const response = await api.post(`/prestamos/${id}/reconciliar`); setPrestamos((actual) => actual.map((p) => p._id === id ? response.data.prestamo : p)); setMensaje(`Conciliación actualizada: ${response.data.prestamo.resumen.cuotasPagadas} cuota(s) detectada(s).`); } catch (apiError) { setError(obtenerMensajeError(apiError)); } finally { setProcesandoId(""); } };
  const desvincular = async (id, gastoId) => { if (!gastoId) return; try { const response = await api.delete(`/prestamos/${id}/pagos/${gastoId}`); setPrestamos((actual) => actual.map((p) => p._id === id ? response.data.prestamo : p)); setMensaje("Pago desvinculado. La detección automática quedó pausada para que puedas corregir la regla."); } catch (apiError) { setError(obtenerMensajeError(apiError)); } };
  const eliminar = async (id) => { if (!window.confirm("¿Eliminar este préstamo? Los gastos vinculados se conservan.")) return; try { await api.delete(`/prestamos/${id}`); setPrestamos((actual) => actual.filter((p) => p._id !== id)); setMensaje("Préstamo eliminado; ningún gasto fue borrado."); } catch (apiError) { setError(obtenerMensajeError(apiError)); } };

  const guardarOActualizarPrestamo = async (event, capitalCalculado) => {
    if (!prestamoEditandoId) return guardarPrestamo(event, capitalCalculado);
    event.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        entidad: form.entidad?.trim() || "",
        monedaCapital: form.monedaCapital,
        capitalFinanciado: Number(capitalCalculado),
        entregaInicial: { monto: Number(form.entregaInicial) || 0, moneda: form.monedaEntrega },
        tea: Number(form.tea),
        plazoCuotas: Number(form.plazoCuotas),
        sistemaAmortizacion: "frances",
        fechaInicio: form.fechaInicio || null,
        diaVencimiento: form.diaVencimiento ? Number(form.diaVencimiento) : null,
        notas: form.notas || "",
        reglaDeteccion: {
          activa: true,
          cuentaId: form.cuentaId || null,
          subcategoriaId: form.subcategoriaId || null,
          textos: form.textos.split(",").map((texto) => texto.trim()).filter(Boolean),
          referencia: form.referencia?.trim() || "",
          desde: form.fechaInicio || null,
        },
      };
      const response = await api.patch(`/prestamos/${prestamoEditandoId}`, payload);
      setPrestamos((actual) => actual.map((prestamo) => (
        prestamo._id === prestamoEditandoId ? response.data.prestamo : prestamo
      )));
      setAbiertos((actual) => ({ ...actual, [prestamoEditandoId]: true }));
      setModalAbierto(false);
      setPrestamoEditandoId("");
      setMensaje(`Pr\u00e9stamo actualizado. Se detectaron ${response.data.prestamo.resumen.cuotasPagadas} cuota(s).`);
    } catch (apiError) {
      setError(obtenerMensajeError(apiError));
    } finally {
      setGuardando(false);
    }
    return undefined;
  };

  return <section className="page-section loans-page">
    <header className="page-header loans-header"><div><span className="page-eyebrow">Compromisos y cobros</span><h1>Deudas y préstamos</h1><p>Controlá tanto el dinero que te deben como los préstamos y financiaciones que vos pagás.</p></div><button type="button" onClick={registrarSimulacion}>Registrar préstamo</button></header>
    {error && <p className="inline-error loans-feedback">{error}</p>}{mensaje && <p className="loans-success loans-feedback">{mensaje}</p>}
    <DeudasCobrarPanel cotizacion={cotizacionUi.cotizacion} />
    <div className="loan-summary-grid"><article><span>Préstamos activos</span><strong>{resumenGlobal.activos}</strong></article><article><span>Cuotas conciliadas</span><strong>{resumenGlobal.cuotasPagadas}</strong></article><article><span>Cuotas restantes</span><strong>{resumenGlobal.cuotasRestantes}</strong></article><article><span>Actualización</span><strong>Automática</strong><small>Por cuenta, subcategoría y referencia</small></article></div>
    <section className="loan-panel" id="prestamos-activos"><header className="loan-panel-header"><div><span className="page-eyebrow">Dinero que pagás</span><h2>Préstamos registrados</h2><p>Los débitos bancarios continúan siendo gastos; aquí sólo se concilian y explican.</p></div><button type="button" className="secondary-button" onClick={cargar} disabled={cargando}>{cargando ? "Actualizando..." : "Actualizar"}</button></header><div className="loan-list">{cargando && !prestamos.length ? <p className="empty-state">Cargando préstamos...</p> : prestamos.length ? prestamos.map((prestamo) => <PrestamoCard key={prestamo._id} prestamo={prestamo} abierto={Boolean(abiertos[prestamo._id])} procesando={procesandoId === prestamo._id} onToggle={() => setAbiertos((actual) => ({ ...actual, [prestamo._id]: !actual[prestamo._id] }))} onReconcile={() => reconciliar(prestamo._id)} onUnlink={(gastoId) => desvincular(prestamo._id, gastoId)} onDelete={() => eliminar(prestamo._id)} />) : <div className="loan-empty-state"><strong>No hay préstamos registrados.</strong><span>Abrí el simulador, compará las condiciones y creá el préstamo cuando estés conforme.</span></div>}</div></section>
    <PrestamoSimulatorModal
      abierto={modalAbierto}
      form={form}
      cuentas={cuentas}
      subcategorias={subcategorias}
      cotizacion={cotizacionUi.cotizacion}
      guardando={guardando}
      onChange={cambiarForm}
      onClose={() => { setModalAbierto(false); setPrestamoEditandoId(""); }}
      onSubmit={guardarOActualizarPrestamo}
    />
  </section>;
}

export default PrestamosPage;
