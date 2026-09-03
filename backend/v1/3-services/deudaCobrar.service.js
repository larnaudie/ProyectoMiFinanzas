import DeudaCobrar from "../0.1-models/deudaCobrar.model.js";
import Gasto from "../0.1-models/gasto.model.js";
import Cuenta from "../0.1-models/cuenta.model.js";
import {
  calcularResumenDeuda,
  convertirCobroDeuda,
} from "../utils/deudasCobrar.js";
import { obtenerCotizacionUiBcuService } from "./cotizacionBcu.service.js";

const poblarDeuda = (consulta) => consulta.populate({
  path: "cobros.gastoId",
  select: "detalle fecha montoBancario montoReal moneda cuentaId",
  populate: { path: "cuentaId", select: "nombreCuenta moneda" },
});

const presentarDeuda = (deuda) => {
  const datos = deuda.toObject ? deuda.toObject() : { ...deuda };
  return { ...datos, resumen: calcularResumenDeuda(datos) };
};

const errorHttp = (mensaje, status) => {
  const error = new Error(mensaje);
  error.status = status;
  return error;
};

const fechaCotizacion = (valor) => {
  if (!valor) return null;
  const partes = String(valor).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (partes) return new Date(`${partes[3]}-${partes[2]}-${partes[1]}T12:00:00.000Z`);
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const normalizarCotizacion = (cotizacion = {}) => ({
  fuente: cotizacion.fuente || "Banco Central del Uruguay",
  fecha: fechaCotizacion(cotizacion.fecha),
  uyuPorDolar: Number(cotizacion.uyuPorDolar) || null,
  uyuPorUi: Number(cotizacion.uyuPorUi) || null,
});

const obtenerCotizacionCobro = async ({
  monedaOrigen,
  monedaDestino,
  cotizacionRecibida,
}) => {
  if (monedaOrigen === monedaDestino) return normalizarCotizacion(cotizacionRecibida);

  const recibida = normalizarCotizacion(cotizacionRecibida);
  try {
    convertirCobroDeuda({
      monto: 1,
      monedaOrigen,
      monedaDestino,
      cotizacion: recibida,
    });
    return recibida;
  } catch {
    const bcu = await obtenerCotizacionUiBcuService();
    return normalizarCotizacion({
      fuente: bcu.fuente,
      fecha: bcu.usd?.fecha || bcu.ui?.fecha || bcu.consultadaEn,
      uyuPorDolar: bcu.usd?.uyuPorDolar,
      uyuPorUi: bcu.ui?.uyuPorUnidad,
    });
  }
};

export const obtenerDeudasCobrarService = async (usuarioId) => {
  const deudas = await poblarDeuda(
    DeudaCobrar.find({ usuarioId }).sort({ estado: 1, createdAt: -1 }),
  );
  return deudas.map(presentarDeuda);
};

export const obtenerDeudaCobrarPorIdService = async (usuarioId, id) => {
  const deuda = await poblarDeuda(DeudaCobrar.findOne({ _id: id, usuarioId }));
  if (!deuda) throw errorHttp("Deuda por cobrar no encontrada", 404);
  return presentarDeuda(deuda);
};

export const crearDeudaCobrarService = async (usuarioId, data) => {
  const existente = await DeudaCobrar.exists({ usuarioId, nombre: data.nombre });
  if (existente) throw errorHttp("Ya existe una deuda con ese nombre", 409);

  let deuda;
  try {
    deuda = await DeudaCobrar.create({
      ...data,
      usuarioId,
      fechaInicio: data.fechaInicio || null,
      notas: data.notas || "",
    });
  } catch (error) {
    if (error?.code === 11000) {
      error.status = 409;
      error.message = "Ya existe una deuda con ese nombre";
    }
    throw error;
  }
  return obtenerDeudaCobrarPorIdService(usuarioId, deuda._id);
};

export const obtenerCandidatosCobroService = async (usuarioId) => {
  const cuentas = await Cuenta.find({ usuarioId, tipoCuenta: "debito" })
    .select("_id nombreCuenta moneda")
    .lean();
  const cuentasPorId = new Map(cuentas.map((cuenta) => [String(cuenta._id), cuenta]));

  const movimientos = await Gasto.find({
    usuarioId,
    cuentaId: { $in: cuentas.map((cuenta) => cuenta._id) },
    estado: "creado",
    montoBancario: { $gt: 0 },
    prestamoId: null,
    $or: [{ deudaCobrarId: null }, { deudaCobrarId: { $exists: false } }],
  })
    .select("detalle fecha montoBancario moneda cuentaId")
    .sort({ fecha: -1, _id: -1 })
    .limit(500)
    .lean();

  return movimientos.map((movimiento) => {
    const cuenta = cuentasPorId.get(String(movimiento.cuentaId));
    return {
      ...movimiento,
      moneda: cuenta?.moneda || movimiento.moneda,
      cuentaId: cuenta || movimiento.cuentaId,
    };
  });
};

export const vincularCobroDeudaService = async (usuarioId, id, data) => {
  const deuda = await DeudaCobrar.findOne({ _id: id, usuarioId });
  if (!deuda) throw errorHttp("Deuda por cobrar no encontrada", 404);
  if (deuda.estado === "saldada") {
    throw errorHttp("Reabrí la deuda antes de agregar otro cobro", 409);
  }

  const gasto = await Gasto.findOneAndUpdate(
    {
      _id: data.gastoId,
      usuarioId,
      estado: "creado",
      montoBancario: { $gt: 0 },
      prestamoId: null,
      $or: [{ deudaCobrarId: null }, { deudaCobrarId: { $exists: false } }],
    },
    { $set: { deudaCobrarId: deuda._id } },
    { new: true },
  ).populate("cuentaId", "nombreCuenta moneda tipoCuenta");

  if (!gasto) {
    throw errorHttp("El movimiento no existe, no es un ingreso o ya está vinculado", 409);
  }
  if (gasto.cuentaId?.tipoCuenta === "credito") {
    await Gasto.updateOne({ _id: gasto._id }, { $set: { deudaCobrarId: null } });
    throw errorHttp("Los consumos de tarjeta no pueden registrarse como cobros", 400);
  }

  const monedaOriginal = gasto.cuentaId?.moneda || gasto.moneda;
  try {
    const cotizacion = await obtenerCotizacionCobro({
      monedaOrigen: monedaOriginal,
      monedaDestino: deuda.monedaCapital,
      cotizacionRecibida: data.cotizacion,
    });
    const montoAplicado = convertirCobroDeuda({
      monto: gasto.montoBancario,
      monedaOrigen: monedaOriginal,
      monedaDestino: deuda.monedaCapital,
      cotizacion,
    });
    deuda.cobros.push({
      gastoId: gasto._id,
      fecha: gasto.fecha || gasto.createdAt || new Date(),
      montoOriginal: Math.abs(gasto.montoBancario),
      monedaOriginal,
      montoAplicado,
      cotizacion,
    });
    await deuda.save();
  } catch (error) {
    await Gasto.updateOne(
      { _id: gasto._id, deudaCobrarId: deuda._id },
      { $set: { deudaCobrarId: null } },
    );
    if (!error.status) error.status = 400;
    throw error;
  }

  return obtenerDeudaCobrarPorIdService(usuarioId, deuda._id);
};

export const desvincularCobroDeudaService = async (usuarioId, id, gastoId) => {
  const deuda = await DeudaCobrar.findOne({ _id: id, usuarioId });
  if (!deuda) throw errorHttp("Deuda por cobrar no encontrada", 404);
  const cantidadAnterior = deuda.cobros.length;
  deuda.cobros = deuda.cobros.filter((cobro) => String(cobro.gastoId) !== gastoId);
  if (deuda.cobros.length === cantidadAnterior) {
    throw errorHttp("El cobro no está vinculado a esta deuda", 404);
  }
  if (!calcularResumenDeuda(deuda).completa) deuda.estado = "activa";
  await deuda.save();
  await Gasto.updateOne(
    { _id: gastoId, usuarioId, deudaCobrarId: deuda._id },
    { $set: { deudaCobrarId: null } },
  );
  return obtenerDeudaCobrarPorIdService(usuarioId, deuda._id);
};

export const actualizarEstadoDeudaService = async (usuarioId, id, estado) => {
  const deuda = await DeudaCobrar.findOne({ _id: id, usuarioId });
  if (!deuda) throw errorHttp("Deuda por cobrar no encontrada", 404);
  if (estado === "saldada" && !calcularResumenDeuda(deuda).completa) {
    throw errorHttp("La deuda todavía tiene saldo pendiente", 409);
  }
  deuda.estado = estado;
  await deuda.save();
  return obtenerDeudaCobrarPorIdService(usuarioId, deuda._id);
};

export const eliminarDeudaCobrarService = async (usuarioId, id) => {
  const deuda = await DeudaCobrar.findOneAndDelete({ _id: id, usuarioId });
  if (!deuda) throw errorHttp("Deuda por cobrar no encontrada", 404);
  await Gasto.updateMany(
    { usuarioId, deudaCobrarId: deuda._id },
    { $set: { deudaCobrarId: null } },
  );
  return presentarDeuda(deuda);
};
