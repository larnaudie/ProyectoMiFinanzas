const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

export const calcularResultadoEconomicoGasto = (gasto) => (
  gasto?.incluirMontoReal === true
    ? numeroFinito(gasto.montoReal)
    : 0
);

export const calcularResultadoCuentaGasto = (gasto) => (
  gasto?.incluirMontoReal === true
    ? numeroFinito(gasto.montoReal)
    : numeroFinito(gasto?.montoBancario)
);
