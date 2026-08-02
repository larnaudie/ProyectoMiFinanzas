import { obtenerMonedaMovimiento } from "./monedas.js";

export const MESES_DEL_ANIO = Object.freeze([
  { valor: "01", nombre: "Enero" },
  { valor: "02", nombre: "Febrero" },
  { valor: "03", nombre: "Marzo" },
  { valor: "04", nombre: "Abril" },
  { valor: "05", nombre: "Mayo" },
  { valor: "06", nombre: "Junio" },
  { valor: "07", nombre: "Julio" },
  { valor: "08", nombre: "Agosto" },
  { valor: "09", nombre: "Setiembre" },
  { valor: "10", nombre: "Octubre" },
  { valor: "11", nombre: "Noviembre" },
  { valor: "12", nombre: "Diciembre" },
]);

export const obtenerId = (valor) => {
  if (!valor) return "";
  if (typeof valor === "object") return valor._id || valor.id || "";
  return valor;
};

export const fechaParaInput = (fecha) => {
  if (!fecha) return "";
  return String(fecha).slice(0, 10);
};

export const obtenerFechaActualParaFiltro = () => {
  const hoy = new Date();

  return {
    mes: String(hoy.getMonth() + 1).padStart(2, "0"),
    anio: String(hoy.getFullYear()),
  };
};

export const crearFiltrosGastosIniciales = ({
  sinFechaPredeterminada = false,
  incluirFiltrosGlobales = false,
} = {}) => ({
  detalle: "",
  categoriaId: "",
  subcategoriaId: "",
  fechaModo: sinFechaPredeterminada ? "" : "mes",
  fechaMes: "",
  fechaAnio: sinFechaPredeterminada
    ? ""
    : obtenerFechaActualParaFiltro().anio,
  fechaDesde: "",
  fechaHasta: "",
  montoBancarioModo: "",
  montoBancario: "",
  montoBancarioDesde: "",
  montoBancarioHasta: "",
  montoRealModo: "",
  montoReal: "",
  montoRealDesde: "",
  montoRealHasta: "",
  ...(incluirFiltrosGlobales ? {
    cuentaId: "",
    estado: "",
    moneda: "",
    incluirMontoReal: "",
  } : {}),
});

export const cumpleFiltroMonto = (valor, modo, monto, desde, hasta) => {
  if (!modo) return true;

  const numero = Number(valor ?? 0);

  if (modo === "monto") {
    if (monto === "") return true;
    return numero === Number(monto);
  }

  if (modo === "rango") {
    if (desde !== "" && numero < Number(desde)) return false;
    if (hasta !== "" && numero > Number(hasta)) return false;
  }

  return true;
};

export const filtrarGastos = (
  gastos,
  filtros,
  { obtenerCuenta = (gasto) => gasto?.cuentaId } = {},
) => gastos.filter((gasto) => {
  const cuenta = obtenerCuenta(gasto);
  const fecha = fechaParaInput(gasto.fecha);
  const detalle = String(gasto.detalle || "").toLocaleLowerCase("es");
  const textoBuscado = String(filtros.detalle || "").toLocaleLowerCase("es");

  if (!detalle.includes(textoBuscado)) return false;
  if (filtros.cuentaId && obtenerId(cuenta) !== filtros.cuentaId) return false;
  if (
    filtros.categoriaId
    && obtenerId(gasto.categoriaId) !== filtros.categoriaId
  ) return false;
  if (
    filtros.subcategoriaId
    && obtenerId(gasto.subcategoriaId) !== filtros.subcategoriaId
  ) return false;
  if (filtros.estado && gasto.estado !== filtros.estado) return false;

  if (filtros.moneda) {
    const moneda = obtenerMonedaMovimiento(cuenta, gasto.moneda);
    if (moneda !== filtros.moneda) return false;
  }

  if (
    Object.prototype.hasOwnProperty.call(filtros, "incluirMontoReal")
    && filtros.incluirMontoReal !== ""
  ) {
    const debeIncluir = filtros.incluirMontoReal === "true";
    if (Boolean(gasto.incluirMontoReal) !== debeIncluir) return false;
  }

  if (filtros.fechaModo === "mes") {
    const mes = fecha.slice(5, 7);
    const anio = fecha.slice(0, 4);
    if (filtros.fechaMes && mes !== filtros.fechaMes) return false;
    if (filtros.fechaAnio && anio !== filtros.fechaAnio) return false;
  }

  if (filtros.fechaModo === "rango") {
    if (filtros.fechaDesde && fecha < filtros.fechaDesde) return false;
    if (filtros.fechaHasta && fecha > filtros.fechaHasta) return false;
  }

  if (!cumpleFiltroMonto(
    gasto.montoBancario,
    filtros.montoBancarioModo,
    filtros.montoBancario,
    filtros.montoBancarioDesde,
    filtros.montoBancarioHasta,
  )) return false;

  return cumpleFiltroMonto(
    gasto.montoReal,
    filtros.montoRealModo,
    filtros.montoReal,
    filtros.montoRealDesde,
    filtros.montoRealHasta,
  );
});
