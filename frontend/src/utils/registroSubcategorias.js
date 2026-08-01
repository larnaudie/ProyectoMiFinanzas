import { obtenerMonedaMovimiento } from "./monedas.js";
import { calcularResultadoCuentaGasto } from "./resultadoEconomico.js";

const obtenerId = (valor) => {
  if (!valor) return "";
  return typeof valor === "object" ? valor._id || valor.id || "" : valor;
};

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const redondear = (valor) => Math.round((numeroFinito(valor) + Number.EPSILON) * 100) / 100;

const obtenerNombre = (valor, campo, respaldo) => (
  typeof valor === "object" && valor?.[campo]
    ? valor[campo]
    : respaldo
);

const normalizarTexto = (valor) => String(valor || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

export const esSubcategoriaTransferencia = (nombre) => (
  /^transf(?:erencia)?(?:\.|\s|$)/.test(normalizarTexto(nombre))
);

export const construirRegistroGastosPorSubcategoria = ({
  gastos = [],
  cuentas = [],
  meses = [],
} = {}) => {
  const cuentasPorId = new Map(
    cuentas.map((cuenta) => [obtenerId(cuenta._id), cuenta]),
  );
  const mesesPermitidos = new Set(meses);
  const filtrarMeses = mesesPermitidos.size > 0;
  const agrupados = new Map();

  gastos.forEach((gasto) => {
    const claveMes = gasto.fecha ? String(gasto.fecha).slice(0, 7) : "";
    const cuenta = cuentasPorId.get(obtenerId(gasto.cuentaId));

    if (
      gasto.estado !== "creado"
      || !cuenta
      || cuenta.tipoCuenta === "credito"
      || (filtrarMeses && !mesesPermitidos.has(claveMes))
    ) {
      return;
    }

    const categoria = obtenerNombre(
      gasto.categoriaId,
      "nombreCategoria",
      "Sin categoría",
    );
    const subcategoria = obtenerNombre(
      gasto.subcategoriaId,
      "nombreSubcategoria",
      "Sin subcategoría",
    );

    if (esSubcategoriaTransferencia(subcategoria)) return;

    const resultado = calcularResultadoCuentaGasto(gasto);
    if (resultado >= 0) return;

    const moneda = obtenerMonedaMovimiento(cuenta, gasto.moneda);
    const clave = [moneda, categoria, subcategoria].join("|");
    const fila = agrupados.get(clave) || {
      moneda,
      categoria,
      subcategoria,
      cantidad: 0,
      total: 0,
      cuentas: new Set(),
    };

    fila.cantidad += 1;
    fila.total += Math.abs(resultado);
    fila.cuentas.add(cuenta.nombreCuenta || "Cuenta sin nombre");
    agrupados.set(clave, fila);
  });

  const registrosPorMoneda = new Map();

  agrupados.forEach((fila) => {
    const registro = registrosPorMoneda.get(fila.moneda) || {
      moneda: fila.moneda,
      cantidad: 0,
      total: 0,
      filas: [],
    };

    const filaPresentada = {
      ...fila,
      total: redondear(fila.total),
      cuentas: [...fila.cuentas].sort((a, b) => a.localeCompare(b, "es")),
    };

    registro.cantidad += fila.cantidad;
    registro.total += fila.total;
    registro.filas.push(filaPresentada);
    registrosPorMoneda.set(fila.moneda, registro);
  });

  return [...registrosPorMoneda.values()]
    .map((registro) => ({
      ...registro,
      total: redondear(registro.total),
      filas: registro.filas.sort((a, b) => (
        b.total - a.total
        || a.subcategoria.localeCompare(b.subcategoria, "es")
      )),
    }))
    .sort((a, b) => a.moneda.localeCompare(b.moneda));
};
