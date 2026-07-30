const esNumeroValido = (valor) => {
  if (valor === "" || valor === null || valor === undefined) {
    return false;
  }

  return Number.isFinite(Number(valor));
};

export const esMontoDistintoDeCero = (valor) => {
  return esNumeroValido(valor) && Number(valor) !== 0;
};

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
  if (!esNumeroValido(valor)) {
    return false;
  }

  const numero = Number(valor);
  return numero >= 0 && numero <= 100;
};

export const gastoTieneMontosCompletos = (gasto) => {
  if (esMontoDistintoDeCero(gasto?.montoBancario)) {
    return esPorcentajeGastoValido(gasto?.porcentaje);
  }

  return esMontoDistintoDeCero(gasto?.montoReal);
};

export const calcularMontoRealGasto = (gasto) => {
  if (!esMontoDistintoDeCero(gasto?.montoBancario)) {
    return esMontoDistintoDeCero(gasto?.montoReal)
      ? redondearMonto(gasto.montoReal)
      : 0;
  }

  if (
    gasto?.incluirMontoReal !== true
    || !esPorcentajeGastoValido(gasto?.porcentaje)
  ) {
    return 0;
  }

  return redondearMonto(
    Number(gasto.montoBancario) * (Number(gasto.porcentaje) / 100),
  );
};
