const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

export const convertirMontoUi = (montoUi, cotizacion) => {
  const monto = numeroFinito(montoUi);
  const uyuPorUnidad = numeroFinito(cotizacion?.ui?.uyuPorUnidad);
  const uyuPorDolar = numeroFinito(cotizacion?.usd?.uyuPorDolar);
  const montoUyu = monto * uyuPorUnidad;

  return {
    montoUyu,
    montoUsd: uyuPorDolar > 0 ? montoUyu / uyuPorDolar : 0,
  };
};
