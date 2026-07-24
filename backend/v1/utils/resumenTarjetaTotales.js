const MONEDAS = ["UYU", "USD"];

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

export const normalizarMontoBancarioTarjeta = (monto, tipoMovimiento) => {
  const montoAbsoluto = Math.abs(numeroFinito(monto));
  return tipoMovimiento === "pago" ? montoAbsoluto : -montoAbsoluto;
};

export const calcularImpactoDeuda = (gasto) => {
  if (gasto.montoOriginalTarjeta !== null && gasto.montoOriginalTarjeta !== undefined) {
    return numeroFinito(gasto.montoOriginalTarjeta);
  }

  const monto = Math.abs(numeroFinito(gasto.montoBancario));
  return ["pago", "reintegro"].includes(gasto.tipoMovimiento) ? -monto : monto;
};

export const calcularTotalesResumen = (resumen, gastos = []) => {
  const totales = {};

  MONEDAS.forEach((moneda) => {
    const movimientos = gastos.filter(
      (gasto) => (gasto.moneda === "USD" ? "USD" : "UYU") === moneda,
    );
    const limiteInformado = resumen?.limiteCredito?.[moneda];
    const limite = limiteInformado === null || limiteInformado === undefined
      ? null
      : numeroFinito(limiteInformado);

    const saldoMovimientos = movimientos.reduce(
      (total, gasto) => total + calcularImpactoDeuda(gasto),
      0,
    );
    const saldoAnterior = numeroFinito(resumen?.saldoAnterior?.[moneda]);
    const saldoFinalInformado = resumen?.saldoFinal?.[moneda];
    const saldoFinal = saldoFinalInformado === null || saldoFinalInformado === undefined
      ? saldoAnterior + saldoMovimientos
      : numeroFinito(saldoFinalInformado);
    const deuda = Math.max(0, saldoFinal);
    const saldoAFavor = Math.max(0, -saldoFinal);
    const consumos = movimientos.reduce((total, gasto) => {
      const impacto = calcularImpactoDeuda(gasto);
      return total + Math.max(0, impacto);
    }, 0);
    const pagosYReintegros = movimientos.reduce((total, gasto) => {
      const impacto = calcularImpactoDeuda(gasto);
      return total + Math.max(0, -impacto);
    }, 0);
    const montoBancarioTotal = movimientos.reduce(
      (total, gasto) => total + numeroFinito(gasto.montoBancario),
      0,
    );
    const montoBancarioCreado = movimientos
      .filter((gasto) => gasto.estado === "creado")
      .reduce(
        (total, gasto) => total + numeroFinito(gasto.montoBancario),
        0,
      );
    const montoBancarioPendiente = movimientos
      .filter((gasto) => gasto.estado === "pendiente")
      .reduce(
        (total, gasto) => total + numeroFinito(gasto.montoBancario),
        0,
      );

    totales[moneda] = {
      limite,
      saldoAnterior,
      saldoMovimientos,
      saldoFinal,
      consumos,
      pagosYReintegros,
      montoBancarioTotal,
      montoBancarioCreado,
      montoBancarioPendiente,
      deuda,
      saldoAFavor,
      disponible: limite === null ? null : Math.max(0, limite - saldoFinal),
      porcentajeUsado: limite && limite > 0
        ? Math.min(100, Number(((deuda / limite) * 100).toFixed(2)))
        : 0,
      cantidad: movimientos.length,
      pendientes: movimientos.filter((gasto) => gasto.estado === "pendiente").length,
      creados: movimientos.filter((gasto) => gasto.estado === "creado").length,
    };
  });

  return totales;
};
