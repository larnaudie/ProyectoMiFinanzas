const numeroFinito = (valor, fallback = 0) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
};

export const redondearPrestamo = (valor, decimales = 6) => {
  const factor = 10 ** decimales;
  return Math.round((numeroFinito(valor) + Number.EPSILON) * factor) / factor;
};

export const tasaMensualDesdeTea = (tea) => {
  const tasaAnual = numeroFinito(tea) / 100;
  if (tasaAnual <= 0) return 0;
  return (1 + tasaAnual) ** (1 / 12) - 1;
};

export const calcularCuotaFrancesa = ({ capital, tea, plazoCuotas }) => {
  const principal = Math.max(0, numeroFinito(capital));
  const cuotas = Math.max(0, Math.trunc(numeroFinito(plazoCuotas)));
  if (!principal || !cuotas) return 0;

  const tasaMensual = tasaMensualDesdeTea(tea);
  if (!tasaMensual) return redondearPrestamo(principal / cuotas);

  return redondearPrestamo(
    principal * tasaMensual / (1 - (1 + tasaMensual) ** -cuotas),
  );
};

export const construirCronogramaFrances = ({
  capital,
  tea,
  plazoCuotas,
  cuotaPersonalizada = null,
}) => {
  const principal = Math.max(0, numeroFinito(capital));
  const cuotas = Math.max(0, Math.trunc(numeroFinito(plazoCuotas)));
  const tasaMensual = tasaMensualDesdeTea(tea);
  const cuotaCalculada = cuotaPersonalizada === null
    ? calcularCuotaFrancesa({ capital: principal, tea, plazoCuotas: cuotas })
    : Math.max(0, numeroFinito(cuotaPersonalizada));
  const cronograma = [];
  let saldo = principal;

  for (let numero = 1; numero <= cuotas; numero += 1) {
    const interes = saldo * tasaMensual;
    const cuota = numero === cuotas
      ? saldo + interes
      : Math.min(cuotaCalculada, saldo + interes);
    const amortizacion = Math.max(0, cuota - interes);
    saldo = Math.max(0, saldo - amortizacion);

    cronograma.push({
      numero,
      cuota: redondearPrestamo(cuota),
      interes: redondearPrestamo(interes),
      amortizacion: redondearPrestamo(amortizacion),
      saldo: redondearPrestamo(saldo),
    });
  }

  return cronograma;
};

export const calcularResumenPrestamo = (prestamo) => {
  const cronograma = construirCronogramaFrances({
    capital: prestamo.capitalFinanciado,
    tea: prestamo.tea,
    plazoCuotas: prestamo.plazoCuotas,
    cuotaPersonalizada: prestamo.cuotaTeorica || null,
  });
  const cuotasPagadas = Math.min(
    cronograma.length,
    Array.isArray(prestamo.pagos) ? prestamo.pagos.length : 0,
  );
  const cuotaTeorica = cronograma[0]?.cuota || 0;
  const capitalPendiente = cuotasPagadas
    ? cronograma[cuotasPagadas - 1]?.saldo || 0
    : numeroFinito(prestamo.capitalFinanciado);
  const totalFinanciado = cronograma.reduce((total, fila) => total + fila.cuota, 0);

  return {
    cuotaTeorica: redondearPrestamo(cuotaTeorica),
    cuotasPagadas,
    cuotasRestantes: Math.max(0, cronograma.length - cuotasPagadas),
    capitalPendiente: redondearPrestamo(capitalPendiente),
    totalFinanciado: redondearPrestamo(totalFinanciado),
    interesTotal: redondearPrestamo(
      totalFinanciado - numeroFinito(prestamo.capitalFinanciado),
    ),
    tasaMensual: redondearPrestamo(tasaMensualDesdeTea(prestamo.tea) * 100),
    proximaCuota: cronograma[cuotasPagadas] || null,
    cronograma,
  };
};

export const normalizarTextoPrestamo = (valor) => String(valor || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/\s+/g, " ")
  .trim();

const obtenerId = (valor) => String(valor?._id || valor || "");

export const gastoCoincideConPrestamo = (gasto, prestamo) => {
  if (!gasto || !prestamo || gasto.estado !== "creado") return false;

  const regla = prestamo.reglaDeteccion || {};
  if (regla.cuentaId && obtenerId(gasto.cuentaId) !== obtenerId(regla.cuentaId)) {
    return false;
  }
  if (
    regla.subcategoriaId
    && obtenerId(gasto.subcategoriaId) !== obtenerId(regla.subcategoriaId)
  ) {
    return false;
  }
  if (regla.desde && new Date(gasto.fecha) < new Date(regla.desde)) return false;

  const detalle = normalizarTextoPrestamo(gasto.detalle);
  const referencia = normalizarTextoPrestamo(regla.referencia);
  const textos = (regla.textos || [])
    .map(normalizarTextoPrestamo)
    .filter(Boolean);

  if (referencia && !detalle.includes(referencia)) return false;
  if (textos.length && !textos.some((texto) => detalle.includes(texto))) {
    return false;
  }

  return Boolean(regla.cuentaId || regla.subcategoriaId || referencia || textos.length);
};

