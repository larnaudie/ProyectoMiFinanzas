export const MONEDAS_SOPORTADAS = Object.freeze(["UYU", "USD", "UI"]);

export const OPCIONES_MONEDA = Object.freeze([
  { _id: "UYU", nombreCategoria: "UYU — Pesos uruguayos" },
  { _id: "USD", nombreCategoria: "USD — Dólares estadounidenses" },
  { _id: "UI", nombreCategoria: "UI — Unidades Indexadas" },
]);

export const normalizarMoneda = (valor) => {
  const moneda = String(valor ?? "").trim().toUpperCase();
  if (
    moneda === "UYI"
    || moneda === "UNIDAD INDEXADA"
    || moneda === "UNIDADES INDEXADAS"
  ) {
    return "UI";
  }
  return MONEDAS_SOPORTADAS.includes(moneda) ? moneda : "UYU";
};

export const normalizarListaMonedas = (valores, predeterminadas = []) => {
  const lista = Array.isArray(valores) ? valores : [];
  const normalizadas = lista
    .map((valor) => String(valor ?? "").trim().toUpperCase())
    .map((moneda) => (moneda === "UYI" ? "UI" : moneda))
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

export const simboloMoneda = (moneda) => {
  const monedaNormalizada = normalizarMoneda(moneda);
  if (monedaNormalizada === "USD") return "US$";
  if (monedaNormalizada === "UI") return "UI";
  return "$";
};

export const formatearMontoMoneda = (monto, moneda) => {
  const numero = Number(monto);
  const montoNormalizado = Number.isFinite(numero) ? numero : 0;
  const monedaNormalizada = normalizarMoneda(moneda);

  if (monedaNormalizada === "UI") {
    return `UI ${montoNormalizado.toLocaleString("es-UY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: monedaNormalizada,
    minimumFractionDigits: 2,
  }).format(montoNormalizado);
};
