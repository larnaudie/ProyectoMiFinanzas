const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const redondearMoneda = (valor) => Number(numeroFinito(valor).toFixed(2));

export const calcularResultadoEconomicoGasto = (gasto) => (
  gasto?.incluirMontoReal === true
    ? numeroFinito(gasto.montoReal)
    : 0
);

export const resumirGastoReal = (gastos = []) => {
  const resumen = gastos.reduce((acumulado, gasto) => {
    const montoReal = numeroFinito(gasto?.montoReal);
    if (gasto?.incluirMontoReal === true && montoReal < 0) {
      acumulado.gastoReal += Math.abs(montoReal);
    }

    return acumulado;
  }, { gastoReal: 0 });

  return { gastoReal: redondearMoneda(resumen.gastoReal) };
};

export const esPagoTarjeta = (gasto) => (
  gasto?.origen?.tipo === "tarjeta"
  && gasto?.tipoMovimiento === "pago"
);

export const calcularResultadoTarjetaGasto = () => 0;
