import { useMemo, useState } from "react";
import {
  calcularSimulacionPrestamo,
  calcularTeaDesdeCuota,
  convertirMonedaPrestamo,
  formatearPrestamo,
} from "../../../utils/prestamos.js";

const monedas = ["UYU", "USD", "UI"];

const numero = (valor) => {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
};

function PrestamoSimulatorModal({
  abierto,
  form,
  cuentas,
  subcategorias,
  cotizacion,
  guardando,
  onChange,
  onClose,
  onSubmit,
}) {
  const [mostrarCronograma, setMostrarCronograma] = useState(false);

  const cotizacionSimulador = useMemo(() => ({
    usd: {
      uyuPorDolar: numero(form.cotizacionUsdUyu)
        || numero(cotizacion?.usd?.uyuPorDolar),
    },
    ui: {
      uyuPorUnidad: numero(form.cotizacionUiUyu)
        || numero(cotizacion?.ui?.uyuPorUnidad),
    },
  }), [cotizacion, form.cotizacionUiUyu, form.cotizacionUsdUyu]);

  const montoConocidoConvertido = useMemo(() => {
    if (!numero(form.montoConocido)) return null;
    return convertirMonedaPrestamo(
      form.montoConocido,
      form.monedaConocida,
      form.monedaCapital,
      cotizacionSimulador,
    );
  }, [
    cotizacionSimulador,
    form.monedaCapital,
    form.monedaConocida,
    form.montoConocido,
  ]);

  const entregaConvertida = useMemo(() => convertirMonedaPrestamo(
    form.entregaInicial,
    form.monedaEntrega,
    form.monedaCapital,
    cotizacionSimulador,
  ) || 0, [
    cotizacionSimulador,
    form.entregaInicial,
    form.monedaCapital,
    form.monedaEntrega,
  ]);

  const capitalFinanciado = useMemo(() => {
    const total = Math.max(0, numero(form.valorTotal));
    const porcentaje = numero(form.porcentajeFinanciado);
    if (!total) return 0;
    if (porcentaje > 0) return total * Math.min(100, porcentaje) / 100;
    return Math.max(0, total - entregaConvertida);
  }, [entregaConvertida, form.porcentajeFinanciado, form.valorTotal]);

  const resultado = useMemo(() => calcularSimulacionPrestamo({
    capital: capitalFinanciado,
    tea: form.tea,
    plazoCuotas: form.plazoCuotas,
  }), [capitalFinanciado, form.plazoCuotas, form.tea]);

  const teaImplicita = useMemo(() => calcularTeaDesdeCuota({
    capital: capitalFinanciado,
    plazoCuotas: form.plazoCuotas,
    cuota: form.cuotaInformada,
  }), [capitalFinanciado, form.cuotaInformada, form.plazoCuotas]);

  const equivalenciasCapital = useMemo(() => monedas
    .filter((moneda) => moneda !== form.monedaCapital)
    .map((moneda) => ({
      moneda,
      monto: convertirMonedaPrestamo(
        capitalFinanciado,
        form.monedaCapital,
        moneda,
        cotizacionSimulador,
      ),
    }))
    .filter((item) => item.monto !== null), [
    capitalFinanciado,
    cotizacionSimulador,
    form.monedaCapital,
  ]);

  if (!abierto) return null;

  const cambiarPlazoCuotas = (valor) => {
    onChange("plazoCuotas", valor);
    onChange("plazoAnios", valor ? String(numero(valor) / 12) : "");
  };

  const cambiarPlazoAnios = (valor) => {
    onChange("plazoAnios", valor);
    onChange("plazoCuotas", valor ? String(Math.round(numero(valor) * 12)) : "");
  };

  const usarMontoConocido = () => {
    if (montoConocidoConvertido === null) return;
    onChange("valorTotal", String(montoConocidoConvertido));
  };

  const enviar = (event) => {
    event.preventDefault();
    onSubmit(event, capitalFinanciado);
  };

  const puedeCrear = form.nombre.trim()
    && capitalFinanciado > 0
    && numero(form.plazoCuotas) > 0;

  return (
    <div
      className="modal-backdrop loan-simulator-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="edit-modal loan-form-modal loan-simulator-modal" onSubmit={enviar}>
        <header className="edit-modal-header loan-modal-header">
          <div>
            <span className="page-eyebrow">Proyección y alta</span>
            <h2>Simular préstamo</h2>
            <p>Calculá el compromiso y, si te sirve, crealo sin salir del simulador.</p>
          </div>
          <button type="button" className="secondary-button loan-modal-close" onClick={onClose} aria-label="Cerrar simulador">×</button>
        </header>

        <section className="loan-modal-section">
          <h3>Datos generales</h3>
          <div className="loan-form-grid loan-form-grid-two">
            <label className="loan-field-wide">Descripción
              <input value={form.nombre} onChange={(event) => onChange("nombre", event.target.value)} placeholder="Ej: Mi auto" required />
            </label>
            <label>Tipo
              <select value={form.tipo} onChange={(event) => onChange("tipo", event.target.value)}>
                <option value="financiacion">Financiación</option>
                <option value="personal">Personal</option>
                <option value="auto">Automotor</option>
                <option value="hipotecario">Hipotecario</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label>Moneda
              <select value={form.monedaCapital} onChange={(event) => onChange("monedaCapital", event.target.value)}>
                {monedas.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
              </select>
            </label>
            <label className="loan-field-wide">Entidad
              <input value={form.entidad} onChange={(event) => onChange("entidad", event.target.value)} placeholder="Ej: BHU, automotora, banco" />
            </label>
            <label>Cotización USD a UYU
              <input type="number" min="0" step="0.0001" value={form.cotizacionUsdUyu} onChange={(event) => onChange("cotizacionUsdUyu", event.target.value)} placeholder="Ej: 40" />
            </label>
            <label>Valor UI en UYU
              <input type="number" min="0" step="0.0001" value={form.cotizacionUiUyu} onChange={(event) => onChange("cotizacionUiUyu", event.target.value)} placeholder="Ej: 6,5" />
            </label>
          </div>
        </section>

        <section className="loan-modal-section loan-modal-soft-section">
          <h3>Convertir monto conocido</h3>
          <div className="loan-form-grid loan-form-grid-two">
            <label>Monto conocido
              <input type="number" min="0" step="0.01" value={form.montoConocido} onChange={(event) => onChange("montoConocido", event.target.value)} placeholder="Ej: 25000" />
            </label>
            <label>Moneda conocida
              <select value={form.monedaConocida} onChange={(event) => onChange("monedaConocida", event.target.value)}>
                {monedas.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
              </select>
            </label>
          </div>
          <div className="loan-conversion-row">
            <p>{montoConocidoConvertido === null
              ? "Ingresá el monto y las cotizaciones necesarias para convertir."
              : `Equivale a ${formatearPrestamo(montoConocidoConvertido, form.monedaCapital)}.`}</p>
            <button type="button" className="secondary-button" disabled={montoConocidoConvertido === null} onClick={usarMontoConocido}>Usar como monto total</button>
          </div>
        </section>

        <section className="loan-modal-section">
          <h3>Financiación</h3>
          <div className="loan-form-grid loan-form-grid-two">
            <label>Monto total antes de entrega
              <input type="number" min="0" step="0.01" value={form.valorTotal} onChange={(event) => onChange("valorTotal", event.target.value)} required />
            </label>
            <label>Porcentaje de financiación
              <input type="number" min="0" max="100" step="0.01" value={form.porcentajeFinanciado} onChange={(event) => onChange("porcentajeFinanciado", event.target.value)} placeholder="Opcional, ej: 80" />
              <small>Si lo completás, el capital se calcula sobre ese porcentaje del total.</small>
            </label>
          </div>
        </section>

        <section className="loan-modal-section loan-modal-soft-section">
          <h3>Entrega inicial</h3>
          <div className="loan-form-grid loan-form-grid-two">
            <label>Monto de entrega
              <input type="number" min="0" step="0.01" value={form.entregaInicial} onChange={(event) => onChange("entregaInicial", event.target.value)} placeholder="Opcional" />
            </label>
            <label>Moneda de entrega
              <select value={form.monedaEntrega} onChange={(event) => onChange("monedaEntrega", event.target.value)}>
                {monedas.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
              </select>
            </label>
          </div>
          <div className="loan-financing-summary">
            <span>Entrega convertida: <strong>{formatearPrestamo(entregaConvertida, form.monedaCapital)}</strong></span>
            <span>Monto a financiar: <strong>{formatearPrestamo(capitalFinanciado, form.monedaCapital)}</strong></span>
            {equivalenciasCapital.length > 0 && <small>{equivalenciasCapital.map((item) => formatearPrestamo(item.monto, item.moneda)).join(" · ")}</small>}
          </div>
        </section>

        <section className="loan-modal-section">
          <h3>Plazo e interés</h3>
          <div className="loan-form-grid loan-form-grid-two">
            <label>Cuotas totales
              <input type="number" min="1" value={form.plazoCuotas} onChange={(event) => cambiarPlazoCuotas(event.target.value)} placeholder="Ej: 72" required />
            </label>
            <label>Plazo en años
              <input type="number" min="0" step="0.5" value={form.plazoAnios} onChange={(event) => cambiarPlazoAnios(event.target.value)} placeholder="Opcional" />
            </label>
            <label>Cuota conocida ({form.monedaCapital})
              <input type="number" min="0" step="0.01" value={form.cuotaInformada} onChange={(event) => onChange("cuotaInformada", event.target.value)} placeholder="Opcional, si el banco ya te dio la cuota" />
            </label>
            <label>Tasa de interés efectiva anual (%)
              <input type="number" min="0" step="0.01" value={form.tea} onChange={(event) => onChange("tea", event.target.value)} placeholder="Anual, opcional" />
            </label>
          </div>
          {teaImplicita !== null && (
            <div className="loan-implied-rate">
              <span>La cuota informada equivale a una TEA aproximada de <strong>{teaImplicita.toLocaleString("es-UY", { maximumFractionDigits: 4 })}%</strong>.</span>
              <button type="button" className="secondary-button" onClick={() => onChange("tea", String(teaImplicita))}>Usar esta TEA</button>
            </div>
          )}
          <article className="loan-estimated-payment">
            <span>{numero(form.tea) > 0 ? "Cuota teórica estimada" : "Cuota estimada sin intereses"}</span>
            <strong>{formatearPrestamo(resultado.cuota, form.monedaCapital)}</strong>
          </article>
        </section>

        <section className="loan-modal-section">
          <h3>Fechas</h3>
          <div className="loan-form-grid loan-form-grid-two">
            <label>Fecha de inicio
              <input type="date" value={form.fechaInicio} onChange={(event) => onChange("fechaInicio", event.target.value)} />
            </label>
            <label>Día habitual de vencimiento
              <input type="number" min="1" max="31" value={form.diaVencimiento} onChange={(event) => onChange("diaVencimiento", event.target.value)} placeholder="Opcional" />
            </label>
          </div>
        </section>

        <section className="loan-modal-section">
          <div className="loan-modal-section-heading">
            <div>
              <h3>Resultado de la simulación</h3>
              <p>Estos números no crean movimientos bancarios ni gastos.</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => setMostrarCronograma((actual) => !actual)}>{mostrarCronograma ? "Ocultar cronograma" : "Ver cronograma"}</button>
          </div>
          <div className="loan-simulator-results loan-modal-results">
            <article><span>Capital financiado</span><strong>{formatearPrestamo(capitalFinanciado, form.monedaCapital)}</strong></article>
            <article><span>Total a pagar</span><strong>{formatearPrestamo(resultado.total, form.monedaCapital)}</strong></article>
            <article><span>Intereses totales</span><strong>{formatearPrestamo(resultado.interesTotal, form.monedaCapital)}</strong></article>
            <article><span>Tasa efectiva mensual</span><strong>{resultado.tasaMensual.toLocaleString("es-UY", { maximumFractionDigits: 4 })}%</strong></article>
          </div>
          {mostrarCronograma && (
            <div className="table-shell loan-schedule-preview loan-modal-schedule">
              <table>
                <thead><tr><th>Cuota</th><th>Pago</th><th>Interés</th><th>Capital</th><th>Saldo</th></tr></thead>
                <tbody>{resultado.cronograma.map((fila) => (
                  <tr key={fila.numero}>
                    <td>{fila.numero}</td>
                    <td>{formatearPrestamo(fila.cuota, form.monedaCapital)}</td>
                    <td>{formatearPrestamo(fila.interes, form.monedaCapital)}</td>
                    <td>{formatearPrestamo(fila.amortizacion, form.monedaCapital)}</td>
                    <td>{formatearPrestamo(fila.saldo, form.monedaCapital)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <fieldset className="loan-detection-fields loan-modal-detection">
          <legend>Detección automática de cuotas</legend>
          <p className="loan-fieldset-copy">La cuota real no se crea aquí: la aplicación la busca y la vincula desde tus gastos bancarios.</p>
          <label>Cuenta debitada
            <select value={form.cuentaId} onChange={(event) => onChange("cuentaId", event.target.value)}>
              <option value="">Sin detección por cuenta</option>
              {cuentas.filter((cuenta) => cuenta.tipoCuenta !== "credito").map((cuenta) => <option key={cuenta._id} value={cuenta._id}>{cuenta.nombreCuenta}</option>)}
            </select>
          </label>
          <label>Subcategoría
            <select value={form.subcategoriaId} onChange={(event) => onChange("subcategoriaId", event.target.value)}>
              <option value="">Sin detección por subcategoría</option>
              {subcategorias.map((subcategoria) => <option key={subcategoria._id} value={subcategoria._id}>{subcategoria.nombreSubcategoria}</option>)}
            </select>
          </label>
          <label>Texto del detalle
            <input value={form.textos} onChange={(event) => onChange("textos", event.target.value)} placeholder="Ej: PAGO MI AUTO" />
          </label>
          <label>Referencia exacta
            <input value={form.referencia} onChange={(event) => onChange("referencia", event.target.value)} placeholder="Ej: 52681977" />
          </label>
        </fieldset>

        <label>Notas
          <textarea rows="3" value={form.notas} onChange={(event) => onChange("notas", event.target.value)} placeholder="Información adicional del préstamo" />
        </label>

        <footer className="edit-modal-actions loan-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button type="submit" disabled={guardando || !puedeCrear}>{guardando ? "Creando..." : "Crear préstamo"}</button>
        </footer>
      </form>
    </div>
  );
}

export default PrestamoSimulatorModal;
