import crypto from "node:crypto";
import { normalizarMoneda } from "./monedas.js";
import { redondearMonto } from "./montosGasto.js";

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const normalizarDetallePlan = (detalle) => String(detalle || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9 ]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const fechaIso = (fecha) => {
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  return Number.isNaN(valor.getTime()) ? "" : valor.toISOString().slice(0, 10);
};

const COINCIDENCIA_CUOTA = /\bcuota\s+0*(\d{1,3})\s*(?:\/|de|-)?\s*0*(\d{1,3})\b/i;

export const extraerPlanCuotasTarjeta = ({
  detalle,
  fecha,
  moneda,
  monto,
} = {}) => {
  const texto = String(detalle || "").trim();
  const coincidencia = texto.match(COINCIDENCIA_CUOTA);
  if (!coincidencia) return null;

  const cuotaActual = Number(coincidencia[1]);
  const cuotasTotales = Number(coincidencia[2]);
  if (
    !Number.isInteger(cuotaActual)
    || !Number.isInteger(cuotasTotales)
    || cuotaActual < 1
    || cuotasTotales < 2
    || cuotaActual > cuotasTotales
  ) {
    return null;
  }

  const montoCuota = redondearMonto(Math.abs(numeroFinito(monto)));
  if (montoCuota <= 0) return null;

  const detalleBase = texto
    .replace(COINCIDENCIA_CUOTA, " ")
    .replace(/\s+/g, " ")
    .trim();
  const monedaNormalizada = normalizarMoneda(moneda);
  const cuotasRestantes = Math.max(0, cuotasTotales - cuotaActual);
  const montoFuturo = redondearMonto(montoCuota * cuotasRestantes);
  const identidad = [
    monedaNormalizada,
    fechaIso(fecha),
    normalizarDetallePlan(detalleBase),
    cuotasTotales,
    montoCuota,
  ].join("|");
  const planKey = crypto
    .createHash("sha256")
    .update(identidad)
    .digest("hex");

  return {
    planKey,
    detalleBase: detalleBase || texto,
    cuotaActual,
    cuotasTotales,
    cuotasRestantes,
    montoCuota,
    montoFuturo,
    moneda: monedaNormalizada,
    estimado: true,
    estado: cuotasRestantes > 0 ? "activo" : "finalizado",
  };
};

const obtenerPlanDesdeGasto = (gasto) => {
  const guardado = gasto?.financiamientoTarjeta;
  if (guardado?.planKey && Number(guardado.cuotasTotales) > 1) {
    const cuotaActual = Number(guardado.cuotaActual);
    const cuotasTotales = Number(guardado.cuotasTotales);
    const montoCuota = redondearMonto(Math.abs(numeroFinito(guardado.montoCuota)));
    const cuotasRestantes = Math.max(0, cuotasTotales - cuotaActual);
    return {
      planKey: guardado.planKey,
      detalleBase: guardado.detalleBase || gasto.detalle,
      cuotaActual,
      cuotasTotales,
      cuotasRestantes,
      montoCuota,
      montoFuturo: redondearMonto(montoCuota * cuotasRestantes),
      moneda: normalizarMoneda(gasto.moneda),
      estimado: guardado.estimado !== false,
      estado: cuotasRestantes > 0 ? "activo" : "finalizado",
    };
  }

  return extraerPlanCuotasTarjeta({
    detalle: gasto?.detalle,
    fecha: gasto?.fecha,
    moneda: gasto?.moneda,
    monto: gasto?.montoOriginalTarjeta ?? gasto?.montoBancario,
  });
};

export const construirPlanesCuotasResumen = (gastos = []) => {
  const planes = new Map();

  gastos.forEach((gasto) => {
    if (gasto?.tipoMovimiento !== "cuota") return;
    const plan = obtenerPlanDesdeGasto(gasto);
    if (!plan) return;

    const existente = planes.get(plan.planKey);
    if (!existente || plan.cuotaActual >= existente.cuotaActual) {
      planes.set(plan.planKey, {
        ...plan,
        fechaCompra: gasto.fecha || null,
        movimientoId: gasto._id || null,
      });
    }
  });

  return [...planes.values()].sort((a, b) => (
    a.moneda.localeCompare(b.moneda)
    || a.detalleBase.localeCompare(b.detalleBase, "es")
  ));
};

export const sumarCuotasFuturasPorMoneda = (planes = []) => (
  planes.reduce((totales, plan) => {
    const moneda = normalizarMoneda(plan.moneda);
    totales[moneda] = redondearMonto(
      numeroFinito(totales[moneda]) + numeroFinito(plan.montoFuturo),
    );
    return totales;
  }, {})
);
