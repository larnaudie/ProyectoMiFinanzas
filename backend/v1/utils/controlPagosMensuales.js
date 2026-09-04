const idDe = (valor) => String(valor?._id || valor || "");

const textoDe = (valor, campo, respaldo = "") => {
  if (!valor) return respaldo;
  if (typeof valor === "string") return valor;
  return valor[campo] || respaldo;
};

const numero = (valor) => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
};

const redondear = (valor) =>
  Math.round((numero(valor) + Number.EPSILON) * 100) / 100;

const TODOS_LOS_MESES = Array.from({ length: 12 }, (_, indice) => indice + 1);

export const normalizarMesesActivos = (valor) => {
  if (!Array.isArray(valor) || valor.length === 0) return [...TODOS_LOS_MESES];
  const meses = [...new Set(valor.map(Number))]
    .filter((mes) => Number.isInteger(mes) && mes >= 1 && mes <= 12)
    .sort((a, b) => a - b);
  return meses.length ? meses : [...TODOS_LOS_MESES];
};

export const normalizarTextoControl = (valor = "") =>
  String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const limitesPeriodoControl = ({ anio, mes }, fechaActual = new Date()) => {
  const anioNumero = Number(anio) || fechaActual.getFullYear();
  const mesNumero = Number(mes) || fechaActual.getMonth() + 1;

  if (
    !Number.isInteger(anioNumero)
    || !Number.isInteger(mesNumero)
    || anioNumero < 2000
    || anioNumero > 2200
    || mesNumero < 1
    || mesNumero > 12
  ) {
    const error = new Error("Período inválido");
    error.status = 400;
    throw error;
  }

  return {
    anio: anioNumero,
    mes: mesNumero,
    inicio: new Date(Date.UTC(anioNumero, mesNumero - 1, 1)),
    fin: new Date(Date.UTC(anioNumero, mesNumero, 1)),
  };
};

const montoCoincidencia = (gasto) => {
  if (gasto.incluirMontoReal === true && numero(gasto.montoReal) !== 0) {
    return redondear(gasto.montoReal);
  }
  return redondear(gasto.montoBancario);
};

export const crearCoincidencia = (gasto, opciones = {}) => ({
  gastoId: idDe(gasto),
  cuentaId: idDe(gasto.cuentaId),
  cuenta: textoDe(gasto.cuentaId, "nombreCuenta", "Cuenta"),
  detalle: gasto.detalle || "Sin detalle",
  fecha: gasto.fecha,
  estado: gasto.estado,
  moneda: String(
    gasto.moneda || textoDe(gasto.cuentaId, "moneda", "UYU"),
  ).toUpperCase(),
  monto: montoCoincidencia(gasto),
  montoBancario: redondear(gasto.montoBancario),
  montoReal: redondear(gasto.montoReal),
  incluirMontoReal: gasto.incluirMontoReal === true,
  asignadoAlPeriodo: opciones.asignadoAlPeriodo === true,
});

const estaDentroDelPeriodo = (gasto, periodo = {}) => {
  if (!periodo.inicio || !periodo.fin) return true;
  const fecha = new Date(gasto.fecha);
  return !Number.isNaN(fecha.getTime())
    && fecha >= periodo.inicio
    && fecha < periodo.fin;
};

const coincidePeriodo = (item, periodo = {}) => (
  Number(item?.anio) === Number(periodo.anio)
  && Number(item?.mes) === Number(periodo.mes)
);

export const evaluarControlesMensuales = ({
  controles = [],
  gastos = [],
  periodo = {},
}) => {
  const gastosPorId = new Map(gastos.map((gasto) => [idDe(gasto), gasto]));
  const gastosPorSubcategoria = new Map();

  gastos.filter((gasto) => estaDentroDelPeriodo(gasto, periodo)).forEach((gasto) => {
    const subcategoriaId = idDe(gasto.subcategoriaId);
    if (!subcategoriaId) return;
    if (!gastosPorSubcategoria.has(subcategoriaId)) {
      gastosPorSubcategoria.set(subcategoriaId, []);
    }
    gastosPorSubcategoria.get(subcategoriaId).push(gasto);
  });

  const resultados = controles.map((control) => {
    const subcategoriaId = idDe(control.subcategoriaId);
    const mesesActivos = normalizarMesesActivos(control.mesesActivos);
    const fueraDeCalendario = Number.isInteger(Number(periodo.mes))
      && !mesesActivos.includes(Number(periodo.mes));
    const excepcion = (control.excepciones || []).some((item) => (
      coincidePeriodo(item, periodo)
    ));
    const omitido = fueraDeCalendario || excepcion;
    const asignacion = (control.pagosAsignados || []).find((item) => (
      coincidePeriodo(item, periodo)
    ));
    const gastosAsignadosAOtrosPeriodos = new Set(
      (control.pagosAsignados || [])
        .filter((item) => !coincidePeriodo(item, periodo))
        .map((item) => idDe(item.gastoId)),
    );
    const gastoAsignado = asignacion
      ? gastosPorId.get(idDe(asignacion.gastoId))
      : null;
    const coincidenciasNaturales = (gastosPorSubcategoria.get(subcategoriaId) || [])
      .filter((gasto) => !gastosAsignadosAOtrosPeriodos.has(idDe(gasto)));
    const coincidencias = coincidenciasNaturales
      .map((gasto) => crearCoincidencia(gasto, {
        asignadoAlPeriodo: Boolean(gastoAsignado && idDe(gasto) === idDe(gastoAsignado)),
      }));
    if (
      gastoAsignado
      && !coincidencias.some((item) => item.gastoId === idDe(gastoAsignado))
    ) {
      coincidencias.push(crearCoincidencia(gastoAsignado, {
        asignadoAlPeriodo: true,
      }));
    }
    coincidencias
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const creados = coincidencias.filter((item) => item.estado === "creado");
    const pendientes = coincidencias.filter((item) => item.estado === "pendiente");
    const estado = omitido
      ? "omitido"
      : creados.length
        ? "pagado"
        : pendientes.length
          ? "pendiente"
          : "no_encontrado";

    return {
      _id: idDe(control),
      nombre: control.nombre,
      subcategoria: {
        _id: subcategoriaId,
        nombre: textoDe(
          control.subcategoriaId,
          "nombreSubcategoria",
          "Subcategoría eliminada",
        ),
      },
      estado,
      coincidencias: omitido ? [] : coincidencias,
      cantidadCreados: creados.length,
      cantidadPendientes: pendientes.length,
      mesesActivos,
      motivoOmision: fueraDeCalendario
        ? "fuera_calendario"
        : excepcion
          ? "excepcion_periodo"
          : null,
      pagoAsignado: gastoAsignado
        ? crearCoincidencia(gastoAsignado, { asignadoAlPeriodo: true })
        : null,
    };
  });

  const aplicables = resultados.filter((item) => item.estado !== "omitido");

  return {
    controles: resultados,
    resumen: {
      total: aplicables.length,
      totalConfigurados: resultados.length,
      omitidos: resultados.length - aplicables.length,
      pagados: aplicables.filter((item) => item.estado === "pagado").length,
      pendientes: aplicables.filter((item) => item.estado === "pendiente").length,
      noEncontrados: aplicables.filter(
        (item) => item.estado === "no_encontrado",
      ).length,
    },
  };
};

const PAGOS_HABITUALES = [
  ["alquiler"],
  ["ute"],
  ["ose"],
  ["wifi", "wi fi"],
  ["auto cuotas", "cuota auto"],
  ["bps fonasa", "fonasa"],
  ["mutualista"],
  ["contador"],
  ["facturacion electronica"],
  ["patente"],
  ["antel movil"],
  ["ort"],
];

export const sugerirSubcategoriasHabituales = ({
  subcategorias = [],
  controles = [],
}) => {
  const configuradas = new Set(
    controles.map((control) => idDe(control.subcategoriaId)),
  );

  return subcategorias
    .filter((subcategoria) => {
      if (configuradas.has(idDe(subcategoria))) return false;
      const nombre = normalizarTextoControl(subcategoria.nombreSubcategoria);
      return PAGOS_HABITUALES.some((alias) =>
        alias.some((texto) => nombre.includes(texto)),
      );
    })
    .map((subcategoria) => ({
      _id: idDe(subcategoria),
      nombreSubcategoria: subcategoria.nombreSubcategoria,
    }))
    .sort((a, b) =>
      a.nombreSubcategoria.localeCompare(b.nombreSubcategoria, "es", {
        sensitivity: "base",
      }),
    );
};
