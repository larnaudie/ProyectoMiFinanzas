export const normalizarMontoContraparte = (montoOrigen, montoPropuesto) => {
  const origen = Number(montoOrigen);
  const propuesto = Number(montoPropuesto);

  if (!Number.isFinite(propuesto) || propuesto === 0) return Number.NaN;

  return origen >= 0
    ? -Math.abs(propuesto)
    : Math.abs(propuesto);
};
