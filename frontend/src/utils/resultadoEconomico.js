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

export const obtenerMontoQuePuedeSumarAlPresupuesto = (gasto) => {
  const montoBancario = numeroFinito(gasto?.montoBancario);
  const montoReal = numeroFinito(gasto?.montoReal);

  if (montoBancario > 0) return montoBancario;
  if (montoReal > 0) return montoReal;
  return 0;
};

export const puedeSumarAlPresupuesto = (gasto) => (
  obtenerMontoQuePuedeSumarAlPresupuesto(gasto) > 0
);

export const calcularResultadoCuentaGasto = (gasto) => {
  const presupuesto = gasto?.sumaAlPresupuesto === true
    ? obtenerMontoQuePuedeSumarAlPresupuesto(gasto)
    : 0;
  const montoReal = numeroFinito(gasto?.montoReal);
  const egresoReal = gasto?.incluirMontoReal === true && montoReal < 0
    ? montoReal
    : 0;

  return presupuesto + egresoReal;
};

export const resumirPresupuestoYGastoReal = (gastos = []) => {
  const resumen = gastos.reduce((acumulado, gasto) => {
    if (gasto?.sumaAlPresupuesto === true) {
      acumulado.presupuesto += obtenerMontoQuePuedeSumarAlPresupuesto(gasto);
    }

    const montoReal = numeroFinito(gasto?.montoReal);
    if (gasto?.incluirMontoReal === true && montoReal < 0) {
      acumulado.gastoReal += Math.abs(montoReal);
    }

    return acumulado;
  }, { presupuesto: 0, gastoReal: 0 });

  const presupuesto = redondearMoneda(resumen.presupuesto);
  const gastoReal = redondearMoneda(resumen.gastoReal);

  return {
    presupuesto,
    gastoReal,
    resultado: redondearMoneda(presupuesto - gastoReal),
  };
};

export const esPagoTarjeta = (gasto) => (
  gasto?.origen?.tipo === "tarjeta"
  && gasto?.tipoMovimiento === "pago"
);

export const calcularResultadoTarjetaGasto = () => 0;
