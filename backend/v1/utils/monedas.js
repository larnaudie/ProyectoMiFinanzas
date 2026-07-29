export const MONEDAS_SOPORTADAS = Object.freeze(["UYU", "USD", "UI"]);

export const normalizarMoneda = (valor, predeterminada = "UYU") => {
  const moneda = String(valor ?? "").trim().toUpperCase();

  if (
    moneda === "UI"
    || moneda === "UYI"
    || moneda === "UNIDAD INDEXADA"
    || moneda === "UNIDADES INDEXADAS"
  ) {
    return "UI";
  }

  return MONEDAS_SOPORTADAS.includes(moneda) ? moneda : predeterminada;
};

export const normalizarListaMonedas = (
  valores,
  predeterminadas = [],
) => {
  const lista = Array.isArray(valores) ? valores : [];
  const normalizadas = lista
    .map((valor) => normalizarMoneda(valor, null))
    .filter((moneda) => MONEDAS_SOPORTADAS.includes(moneda));
  const unicas = [...new Set(normalizadas)];

  return unicas.length > 0
    ? MONEDAS_SOPORTADAS.filter((moneda) => unicas.includes(moneda))
    : [...predeterminadas];
};

export const obtenerMonedasCuenta = (cuenta) => {
  if (cuenta?.tipoCuenta === "credito") {
    return normalizarListaMonedas(cuenta.monedas, ["UYU", "USD"]);
  }

  return [normalizarMoneda(cuenta?.moneda)];
};

export const obtenerMonedaMovimiento = (cuenta, monedaMovimiento) => {
  if (cuenta?.tipoCuenta && cuenta.tipoCuenta !== "credito") {
    return normalizarMoneda(cuenta.moneda);
  }

  return normalizarMoneda(monedaMovimiento ?? cuenta?.moneda);
};
