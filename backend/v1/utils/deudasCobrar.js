import { MONEDAS_SOPORTADAS } from "./monedas.js";

const redondear = (valor, decimales = 6) => {
  const factor = 10 ** decimales;
  return Math.round((Number(valor) + Number.EPSILON) * factor) / factor;
};

const factorEnUyu = (moneda, cotizacion = {}) => {
  if (moneda === "UYU") return 1;
  if (moneda === "USD") return Number(cotizacion.uyuPorDolar);
  if (moneda === "UI") return Number(cotizacion.uyuPorUi);
  return Number.NaN;
};

export const convertirCobroDeuda = ({
  monto,
  monedaOrigen,
  monedaDestino,
  cotizacion = {},
}) => {
  const original = Math.abs(Number(monto));
  if (!Number.isFinite(original) || original <= 0) {
    throw new Error("El monto del cobro debe ser mayor que cero");
  }
  if (!MONEDAS_SOPORTADAS.includes(monedaOrigen)
    || !MONEDAS_SOPORTADAS.includes(monedaDestino)) {
    throw new Error("La moneda del cobro no es válida");
  }
  if (monedaOrigen === monedaDestino) return redondear(original);

  const origenEnUyu = factorEnUyu(monedaOrigen, cotizacion);
  const destinoEnUyu = factorEnUyu(monedaDestino, cotizacion);
  if (!Number.isFinite(origenEnUyu) || origenEnUyu <= 0
    || !Number.isFinite(destinoEnUyu) || destinoEnUyu <= 0) {
    throw new Error("No hay una cotización BCU válida para convertir este cobro");
  }
  return redondear((original * origenEnUyu) / destinoEnUyu);
};

export const calcularResumenDeuda = (deuda = {}) => {
  const capital = Math.max(0, Number(deuda.capitalOriginal) || 0);
  const cobrado = redondear((deuda.cobros || []).reduce(
    (total, cobro) => total + (Number(cobro.montoAplicado) || 0),
    0,
  ));
  const pendiente = redondear(Math.max(0, capital - cobrado));
  const excedente = redondear(Math.max(0, cobrado - capital));
  const porcentaje = capital > 0
    ? redondear(Math.min(100, (cobrado / capital) * 100), 2)
    : 0;

  return {
    capital,
    cobrado,
    pendiente,
    excedente,
    porcentaje,
    completa: capital > 0 && cobrado >= capital,
  };
};
