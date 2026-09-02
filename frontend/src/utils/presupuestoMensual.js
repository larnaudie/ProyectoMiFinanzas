import { normalizarMoneda } from "./monedas.js";

export const PRESUPUESTO_MENSUAL_USD = 4000;

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const redondear = (valor) => Number(numeroFinito(valor).toFixed(2));

const obtenerId = (valor) => {
  if (!valor) return "";
  if (typeof valor !== "object") return String(valor);
  if (valor._id && valor._id !== valor) return obtenerId(valor._id);
  if (typeof valor.id === "string") return valor.id;

  const texto = String(valor);
  return texto === "[object Object]" ? "" : texto;
};

const obtenerPeriodo = (fecha) => {
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    return fecha.toISOString().slice(0, 7);
  }
  return String(fecha || "").slice(0, 7);
};

const normalizarTexto = (valor) => String(valor || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

const nombreSubcategoria = (gasto) => (
  typeof gasto?.subcategoriaId === "object"
    ? gasto.subcategoriaId?.nombreSubcategoria
    : ""
);

export const esSubcategoriaTransferencia = (gasto) => (
  /^transf(?:\.|\s|$)/.test(normalizarTexto(nombreSubcategoria(gasto)))
);

export const esCuentaFuentePresupuesto = (cuenta) => {
  if (!cuenta || cuenta.tipoCuenta === "credito") return false;
  if (normalizarMoneda(cuenta.moneda) !== "USD") return false;

  return /\bcaja\s+(?:de\s+)?ahorro\b/.test(
    normalizarTexto(cuenta.nombreCuenta),
  );
};

export const resumirPresupuestoMensualPorTransferencias = ({
  gastos = [],
  cuentas = [],
  periodo = "",
  presupuestoUsd = PRESUPUESTO_MENSUAL_USD,
} = {}) => {
  const cuentasFuente = cuentas.filter(esCuentaFuentePresupuesto);
  const idsCuentasFuente = new Set(
    cuentasFuente.map((cuenta) => obtenerId(cuenta._id)),
  );
  const hayMovimientosPeriodo = gastos.some((gasto) => (
    gasto?.estado === "creado"
    && (!periodo || obtenerPeriodo(gasto?.fecha) === periodo)
  ));

  let cantidadTransferencias = 0;
  let transferidoUsd = 0;

  gastos.forEach((gasto) => {
    if (gasto?.estado !== "creado") return;
    if (periodo && obtenerPeriodo(gasto?.fecha) !== periodo) return;
    if (!idsCuentasFuente.has(obtenerId(gasto?.cuentaId))) return;
    if (!esSubcategoriaTransferencia(gasto)) return;

    const montoBancario = numeroFinito(gasto?.montoBancario);
    if (montoBancario >= 0) return;

    cantidadTransferencias += 1;
    transferidoUsd += Math.abs(montoBancario);
  });

  const presupuesto = redondear(Math.max(0, presupuestoUsd));
  const transferido = redondear(transferidoUsd);
  const resultado = redondear(presupuesto - transferido);

  return {
    disponible: cuentasFuente.length > 0 && hayMovimientosPeriodo,
    cuentaFuenteEncontrada: cuentasFuente.length > 0,
    hayMovimientosPeriodo,
    cuentasFuente,
    presupuestoUsd: presupuesto,
    transferidoUsd: transferido,
    resultadoUsd: resultado,
    cantidadTransferencias,
    estado: resultado < 0
      ? "deficit"
      : resultado > 0
        ? "ahorro"
        : "equilibrio",
  };
};
