import {
  MONEDAS_SOPORTADAS,
  normalizarMoneda,
  obtenerMonedaMovimiento,
} from "./monedas.js";

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const redondear = (valor) => Number(numeroFinito(valor).toFixed(2));

const obtenerId = (valor) => {
  if (!valor) return "";
  return typeof valor === "object" ? valor._id || valor.id || "" : valor;
};

const crearResumenMoneda = () => ({
  cantidad: 0,
  duplicadosIgnorados: 0,
  ingresosBancarios: 0,
  egresosBancarios: 0,
  resultadoBancario: 0,
  gastoReal: 0,
});

const esPagoTarjeta = (gasto) => (
  gasto?.origen?.tipo === "tarjeta"
  && gasto?.tipoMovimiento === "pago"
);

const normalizarTexto = (valor) => String(valor || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

export const esTransferenciaInternaPorSubcategoria = (gasto) => {
  const nombre = typeof gasto?.subcategoriaId === "object"
    ? gasto.subcategoriaId?.nombreSubcategoria
    : "";
  return /^transf(?:\.|\s|$)/.test(normalizarTexto(nombre));
};

const obtenerNombreSubcategoria = (gasto) => (
  typeof gasto?.subcategoriaId === "object"
    ? gasto.subcategoriaId?.nombreSubcategoria
    : ""
);

export const esMovimientoDeAhorro = (gasto) => (
  /^ahorro(?:s)?(?:\s|$)/.test(normalizarTexto(obtenerNombreSubcategoria(gasto)))
);

export const esSaldoInicial = (gasto) => (
  /^(?:monto|saldo)\s+(?:anterior|inicial)(?:\s|$)/.test(
    normalizarTexto(gasto?.detalle),
  )
);

export const esPagoDeTarjeta = (gasto) => {
  return esPagoTarjeta(gasto);
};

const idsTransferenciasInternas = (gastos) => {
  const gastosPorId = new Map(
    gastos.map((gasto) => [obtenerId(gasto?._id), gasto]),
  );
  const ids = new Set();

  gastos.forEach((gasto) => {
    const gastoId = obtenerId(gasto?._id);
    const referenciaPoblada = gasto?.origen?.referenciaId;
    if (!referenciaPoblada || typeof referenciaPoblada !== "object") return;

    const referenciaId = obtenerId(referenciaPoblada);
    if (!gastoId || !referenciaId) return;

    const referencia = gastosPorId.get(referenciaId) || referenciaPoblada;
    if (esPagoTarjeta(gasto) || esPagoTarjeta(referencia)) return;

    ids.add(gastoId);
    ids.add(referenciaId);
  });

  return ids;
};

const idsDuplicadosExactosEntreCuentas = ({
  gastos,
  cuentasPorId,
  periodo,
}) => {
  const grupos = new Map();
  const duplicados = new Set();

  gastos.forEach((gasto) => {
    if (gasto?.estado !== "creado") return;
    if (periodo && String(gasto?.fecha || "").slice(0, 7) !== periodo) return;

    const cuentaId = obtenerId(gasto?.cuentaId);
    const cuenta = cuentasPorId.get(cuentaId);
    const montoBancario = numeroFinito(gasto?.montoBancario);
    const detalle = normalizarTexto(gasto?.detalle);
    if (!cuenta || cuenta.tipoCuenta === "credito" || montoBancario === 0 || !detalle) {
      return;
    }

    const moneda = obtenerMonedaMovimiento(cuenta, gasto?.moneda);
    const firma = [
      String(gasto?.fecha || "").slice(0, 10),
      moneda,
      montoBancario,
      detalle,
    ].join("|");
    const grupo = grupos.get(firma) || [];
    grupo.push({ gastoId: obtenerId(gasto?._id), cuentaId });
    grupos.set(firma, grupo);
  });

  grupos.forEach((grupo) => {
    if (new Set(grupo.map((item) => item.cuentaId)).size < 2) return;
    grupo.slice(1).forEach((item) => duplicados.add(item.gastoId));
  });

  return duplicados;
};

export const resumirMovimientosMensuales = ({
  gastos = [],
  cuentas = [],
  periodo = "",
  cuentaId = "",
} = {}) => {
  const resumen = Object.fromEntries(
    MONEDAS_SOPORTADAS.map((moneda) => [moneda, crearResumenMoneda()]),
  );
  const cuentasPorId = new Map(
    cuentas.map((cuenta) => [obtenerId(cuenta?._id), cuenta]),
  );
  const cuentaFiltradaId = obtenerId(cuentaId);
  const gastosDelAlcance = cuentaFiltradaId
    ? gastos.filter((gasto) => obtenerId(gasto?.cuentaId) === cuentaFiltradaId)
    : gastos;
  const esResumenDeUnaCuenta = Boolean(cuentaFiltradaId);

  // Las vinculaciones se resuelven con todos los movimientos para que una
  // transferencia siga siendo interna aunque se esté consultando una sola cuenta.
  const movimientosInternos = idsTransferenciasInternas(gastos);
  const movimientosDuplicados = idsDuplicadosExactosEntreCuentas({
    gastos: gastosDelAlcance,
    cuentasPorId,
    periodo,
  });

  gastosDelAlcance.forEach((gasto) => {
    if (gasto?.estado !== "creado") return;
    if (periodo && String(gasto?.fecha || "").slice(0, 7) !== periodo) return;

    const cuenta = cuentasPorId.get(obtenerId(gasto?.cuentaId));
    if (!cuenta) return;

    const moneda = obtenerMonedaMovimiento(cuenta, gasto?.moneda);
    const acumulado = resumen[moneda];
    const esCuentaCredito = cuenta.tipoCuenta === "credito";
    const montoBancario = numeroFinito(gasto?.montoBancario);
    const montoReal = numeroFinito(gasto?.montoReal);
    const esInterno = movimientosInternos.has(obtenerId(gasto?._id))
      || esTransferenciaInternaPorSubcategoria(gasto);
    const esAhorro = esMovimientoDeAhorro(gasto);
    const esArrastre = esSaldoInicial(gasto);
    const esPagoTarjeta = esPagoDeTarjeta(gasto);

    if (movimientosDuplicados.has(obtenerId(gasto?._id))) {
      acumulado.duplicadosIgnorados += 1;
      return;
    }
    if (esArrastre) return;

    acumulado.cantidad += 1;

    // Una transferencia propia es neutral únicamente al consolidar todas las
    // cuentas. Dentro de una cuenta sí cambia su caja: resta en el origen y
    // suma en el destino. Los movimientos históricos marcados como "Ahorro"
    // siguen la misma regla cuando se consulta esa cuenta en particular.
    const esNeutralEnFlujoBancario = !esResumenDeUnaCuenta
      && (esInterno || esAhorro);
    if (!esCuentaCredito && !esNeutralEnFlujoBancario) {
      if (montoBancario > 0) acumulado.ingresosBancarios += montoBancario;
      if (montoBancario < 0) acumulado.egresosBancarios += Math.abs(montoBancario);
    }

    // Un pago creado dentro de la tarjeta es neutral. Si el pago bancario fue
    // importado como gasto real, se conserva porque esa es la decisión visible
    // del usuario y los consumos de tarjeta pueden no tener monto real.
    if (
      !esInterno
      && !esAhorro
      && !esArrastre
      && !esPagoTarjeta
      && gasto?.incluirMontoReal === true
      && montoReal < 0
    ) {
      acumulado.gastoReal += Math.abs(montoReal);
    }

  });

  MONEDAS_SOPORTADAS.forEach((moneda) => {
    const acumulado = resumen[moneda];
    acumulado.ingresosBancarios = redondear(acumulado.ingresosBancarios);
    acumulado.egresosBancarios = redondear(acumulado.egresosBancarios);
    acumulado.resultadoBancario = redondear(
      acumulado.ingresosBancarios - acumulado.egresosBancarios,
    );
    acumulado.gastoReal = redondear(acumulado.gastoReal);
  });

  return resumen;
};

export const resumirSaldosCuentas = (cuentas = []) => {
  const resumen = Object.fromEntries(
    MONEDAS_SOPORTADAS.map((moneda) => [moneda, { total: 0, cuentas: [] }]),
  );

  cuentas.forEach((cuenta) => {
    if (!cuenta || cuenta.tipoCuenta === "credito") return;

    const moneda = normalizarMoneda(cuenta.moneda);
    const informado = cuenta.saldoActual !== null
      && cuenta.saldoActual !== undefined
      && cuenta.saldoActual !== "";
    const saldo = informado ? numeroFinito(cuenta.saldoActual) : 0;

    resumen[moneda].cuentas.push({ cuenta, saldo, informado });
    if (informado) resumen[moneda].total += saldo;
  });

  MONEDAS_SOPORTADAS.forEach((moneda) => {
    resumen[moneda].total = redondear(resumen[moneda].total);
  });

  return resumen;
};

export const factorMonedaEnUyu = (moneda, cotizacion) => {
  const normalizada = normalizarMoneda(moneda);
  if (normalizada === "UYU") return 1;
  if (normalizada === "USD") {
    const factor = numeroFinito(cotizacion?.usd?.uyuPorDolar);
    return factor > 0 ? factor : null;
  }
  const factor = numeroFinito(cotizacion?.ui?.uyuPorUnidad);
  return factor > 0 ? factor : null;
};

export const totalizarCampoEnUyu = (resumenPorMoneda, campo, cotizacion) => {
  let total = 0;

  for (const moneda of MONEDAS_SOPORTADAS) {
    const monto = numeroFinito(resumenPorMoneda?.[moneda]?.[campo]);
    if (monto === 0) continue;

    const factor = factorMonedaEnUyu(moneda, cotizacion);
    if (!factor) return null;
    total += monto * factor;
  }

  return redondear(total);
};

export const totalizarSaldosEnUyu = (saldosPorMoneda, cotizacion) => {
  let total = 0;

  for (const moneda of MONEDAS_SOPORTADAS) {
    const monto = numeroFinito(saldosPorMoneda?.[moneda]?.total);
    if (monto === 0) continue;

    const factor = factorMonedaEnUyu(moneda, cotizacion);
    if (!factor) return null;
    total += monto * factor;
  }

  return redondear(total);
};
