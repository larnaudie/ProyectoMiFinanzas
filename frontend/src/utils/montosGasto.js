export const esNumeroValido = (valor) => {
  if (valor === "" || valor === null || valor === undefined) {
    return false;
  }

  return Number.isFinite(Number(valor));
};

export const esMontoDistintoDeCero = (valor) =>
  esNumeroValido(valor) && Number(valor) !== 0;

export const redondearMonto = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;

  return (
    Math.sign(numero)
    * Math.round((Math.abs(numero) + Number.EPSILON) * 100)
    / 100
  );
};

export const esPorcentajeGastoValido = (valor) => {
  if (!esNumeroValido(valor)) return false;

  const numero = Number(valor);
  return numero >= 0 && numero <= 100;
};

export const calcularMontoRealGasto = ({
  montoBancario,
  montoReal,
  porcentaje,
  incluirMontoReal,
}) => {
  if (!esMontoDistintoDeCero(montoBancario)) {
    return esMontoDistintoDeCero(montoReal) ? redondearMonto(montoReal) : 0;
  }

  if (
    incluirMontoReal !== true
    || !esPorcentajeGastoValido(porcentaje)
  ) {
    return 0;
  }

  return redondearMonto(
    (Number(montoBancario) * Number(porcentaje)) / 100,
  );
};

export const obtenerMontoRealIncluido = (gasto) =>
  gasto?.incluirMontoReal === true
    ? redondearMonto(gasto?.montoReal)
    : 0;

export const resumirValoresMonetarios = (valores = []) => {
  const resumen = valores.reduce(
    (acumulado, valor) => {
      const numero = Number(valor);
      if (!Number.isFinite(numero)) return acumulado;

      acumulado.neto += numero;
      if (numero > 0) acumulado.ingresos += numero;
      if (numero < 0) acumulado.egresos += Math.abs(numero);

      return acumulado;
    },
    { ingresos: 0, egresos: 0, neto: 0 },
  );

  return {
    ingresos: redondearMonto(resumen.ingresos),
    egresos: redondearMonto(resumen.egresos),
    neto: redondearMonto(resumen.neto),
  };
};

export const gastoTieneMontosCompletos = (gasto) => {
  if (esMontoDistintoDeCero(gasto?.montoBancario)) {
    return esPorcentajeGastoValido(gasto?.porcentaje);
  }

  return esMontoDistintoDeCero(gasto?.montoReal);
};
