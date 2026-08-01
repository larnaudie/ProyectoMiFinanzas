const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const redondearMonto = (valor) => (
  Math.sign(valor)
  * Math.round((Math.abs(valor) + Number.EPSILON) * 100)
  / 100
);

const factorConversion = (origen, destino, cotizacion) => {
  if (origen === destino) return 1;
  const uyuPorDolar = numeroFinito(cotizacion?.usd?.uyuPorDolar);
  if (uyuPorDolar <= 0) return null;
  if (origen === "USD" && destino === "UYU") return uyuPorDolar;
  if (origen === "UYU" && destino === "USD") return 1 / uyuPorDolar;
  return null;
};

export const calcularDisponibleOperativoTarjeta = (resumen, cotizacion) => {
  const totales = resumen?.totales || {};
  const monedasConLimite = Object.entries(totales).filter(
    ([, total]) => numeroFinito(total?.limite) > 0,
  );
  if (monedasConLimite.length !== 1) return null;

  const [monedaBase, totalBase] = monedasConLimite[0];
  const limite = numeroFinito(totalBase.limite);
  const saldoFinal = numeroFinito(totalBase.saldoFinal);
  const cuotasFuturas = numeroFinito(totalBase.cuotasFuturas);
  let disponible = limite - saldoFinal - cuotasFuturas;
  const ajustesMoneda = [];

  for (const [moneda, total] of Object.entries(totales)) {
    if (moneda === monedaBase || numeroFinito(total?.limite) > 0) continue;
    const exposicion = numeroFinito(total?.saldoFinal)
      + numeroFinito(total?.cuotasFuturas);
    if (exposicion === 0) continue;

    const factor = factorConversion(moneda, monedaBase, cotizacion);
    if (factor === null) {
      return {
        moneda: monedaBase,
        limite,
        saldoFinal,
        cuotasFuturas,
        disponible: null,
        requiereCotizacion: true,
        ajustesMoneda,
      };
    }

    const ajuste = redondearMonto(-exposicion * factor);
    disponible += ajuste;
    ajustesMoneda.push({
      moneda,
      saldoFinal: numeroFinito(total?.saldoFinal),
      cuotasFuturas: numeroFinito(total?.cuotasFuturas),
      factor,
      ajuste,
    });
  }

  return {
    moneda: monedaBase,
    limite,
    saldoFinal,
    saldoAFavor: Math.max(0, -saldoFinal),
    deuda: Math.max(0, saldoFinal),
    cuotasFuturas,
    disponible: redondearMonto(disponible),
    requiereCotizacion: false,
    ajustesMoneda,
  };
};
