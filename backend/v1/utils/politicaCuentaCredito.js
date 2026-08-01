export const esCuentaCredito = (cuenta) => (
  cuenta?.tipoCuenta === "credito"
);

export const aplicarPoliticaCuentaCredito = (gasto, cuenta) => {
  if (!esCuentaCredito(cuenta)) {
    return { ...gasto };
  }

  return {
    ...gasto,
    montoReal: 0,
    porcentaje: 0,
    incluirMontoReal: false,
  };
};
