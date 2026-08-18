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

const crearCoincidencia = (gasto) => ({
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
});

export const evaluarControlesMensuales = ({ controles = [], gastos = [] }) => {
  const gastosPorSubcategoria = new Map();

  gastos.forEach((gasto) => {
    const subcategoriaId = idDe(gasto.subcategoriaId);
    if (!subcategoriaId) return;
    if (!gastosPorSubcategoria.has(subcategoriaId)) {
      gastosPorSubcategoria.set(subcategoriaId, []);
    }
    gastosPorSubcategoria.get(subcategoriaId).push(gasto);
  });

  const resultados = controles.map((control) => {
    const subcategoriaId = idDe(control.subcategoriaId);
    const coincidencias = (gastosPorSubcategoria.get(subcategoriaId) || [])
      .map(crearCoincidencia)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const creados = coincidencias.filter((item) => item.estado === "creado");
    const pendientes = coincidencias.filter((item) => item.estado === "pendiente");
    const estado = creados.length
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
      coincidencias,
      cantidadCreados: creados.length,
      cantidadPendientes: pendientes.length,
    };
  });

  return {
    controles: resultados,
    resumen: {
      total: resultados.length,
      pagados: resultados.filter((item) => item.estado === "pagado").length,
      pendientes: resultados.filter((item) => item.estado === "pendiente").length,
      noEncontrados: resultados.filter(
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
