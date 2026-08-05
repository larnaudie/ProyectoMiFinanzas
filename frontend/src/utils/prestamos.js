const numero = (valor) => {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
};

export const calcularSimulacionPrestamo = ({ capital, tea, plazoCuotas }) => {
  const principal = Math.max(0, numero(capital));
  const cuotas = Math.max(0, Math.trunc(numero(plazoCuotas)));
  const tasaMensual = numero(tea) > 0
    ? (1 + numero(tea) / 100) ** (1 / 12) - 1
    : 0;
  const cuota = principal && cuotas
    ? (tasaMensual
      ? principal * tasaMensual / (1 - (1 + tasaMensual) ** -cuotas)
      : principal / cuotas)
    : 0;
  let saldo = principal;
  const cronograma = [];

  for (let indice = 1; indice <= cuotas; indice += 1) {
    const interes = saldo * tasaMensual;
    const pago = indice === cuotas ? saldo + interes : Math.min(cuota, saldo + interes);
    const amortizacion = Math.max(0, pago - interes);
    saldo = Math.max(0, saldo - amortizacion);
    cronograma.push({ numero: indice, cuota: pago, interes, amortizacion, saldo });
  }

  const total = cronograma.reduce((acumulado, fila) => acumulado + fila.cuota, 0);
  return {
    tasaMensual: tasaMensual * 100,
    cuota,
    total,
    interesTotal: total - principal,
    cronograma,
  };
};

const valorEnUyu = (moneda, cotizacion) => ({
  UYU: 1,
  USD: numero(cotizacion?.usd?.uyuPorDolar),
  UI: numero(cotizacion?.ui?.uyuPorUnidad),
}[moneda] || 0);

export const convertirMonedaPrestamo = (monto, monedaOrigen, monedaDestino, cotizacion) => {
  if (monedaOrigen === monedaDestino) return numero(monto);
  const origenEnUyu = valorEnUyu(monedaOrigen, cotizacion);
  const destinoEnUyu = valorEnUyu(monedaDestino, cotizacion);
  if (!origenEnUyu || !destinoEnUyu) return null;
  return (numero(monto) * origenEnUyu) / destinoEnUyu;
};

export const calcularTeaDesdeCuota = ({ capital, plazoCuotas, cuota }) => {
  const principal = Math.max(0, numero(capital));
  const cuotas = Math.max(0, Math.trunc(numero(plazoCuotas)));
  const pago = Math.max(0, numero(cuota));
  if (!principal || !cuotas || !pago || pago * cuotas < principal) return null;
  if (Math.abs(pago - principal / cuotas) < 0.000001) return 0;

  let minimo = 0;
  let maximo = 1;
  for (let intento = 0; intento < 160; intento += 1) {
    const tasaMensual = (minimo + maximo) / 2;
    const cuotaCalculada = principal * tasaMensual
      / (1 - (1 + tasaMensual) ** -cuotas);
    if (cuotaCalculada > pago) maximo = tasaMensual;
    else minimo = tasaMensual;
  }

  return ((1 + (minimo + maximo) / 2) ** 12 - 1) * 100;
};

export const simboloMonedaPrestamo = (moneda) => ({
  UYU: "$",
  USD: "US$",
  UI: "UI",
}[moneda] || moneda);

export const formatearPrestamo = (monto, moneda = "UYU") => {
  const valor = Number(monto) || 0;
  return `${simboloMonedaPrestamo(moneda)} ${valor.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
