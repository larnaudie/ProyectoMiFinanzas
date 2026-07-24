import crypto from "node:crypto";
import Banco from "../0.1-models/banco.model.js";
import Cuenta from "../0.1-models/cuenta.model.js";
import Gasto from "../0.1-models/gasto.model.js";
import ResumenTarjeta from "../0.1-models/resumenTarjeta.model.js";
import Tarjeta from "../0.1-models/tarjeta.model.js";
import { parsearExcelTarjeta } from "../utils/excelParsers.js";

const errorHttp = (mensaje, status = 400) => {
  const error = new Error(mensaje);
  error.status = status;
  return error;
};

const validarRelaciones = async (usuarioId, { cuentaId, bancoId }) => {
  const cuenta = await Cuenta.findOne({ _id: cuentaId, usuarioId }).select("_id");
  if (!cuenta) throw errorHttp("La cuenta seleccionada no existe", 404);

  if (bancoId) {
    const banco = await Banco.findOne({ _id: bancoId, usuarioId }).select("_id");
    if (!banco) throw errorHttp("El banco seleccionado no existe", 404);
  }
};

const buscarTarjeta = async (usuarioId, tarjetaId) => {
  const tarjeta = await Tarjeta.findOne({ _id: tarjetaId, usuarioId });
  if (!tarjeta) throw errorHttp("Tarjeta no encontrada", 404);
  return tarjeta;
};

const popularTarjeta = (consulta) =>
  consulta
    .populate("cuentaId", "nombreCuenta moneda bancoId")
    .populate("bancoId", "nombreBanco");

export const obtenerTarjetasService = async (usuarioId, filtros = {}) => {
  const consulta = { usuarioId };
  if (filtros.cuentaId) consulta.cuentaId = filtros.cuentaId;
  if (filtros.activa === "true" || filtros.activa === "false") {
    consulta.activa = filtros.activa === "true";
  }

  return popularTarjeta(Tarjeta.find(consulta).sort({ activa: -1, nombreTarjeta: 1 }));
};

export const obtenerTarjetaPorIdService = async (usuarioId, tarjetaId) => {
  const tarjeta = await popularTarjeta(Tarjeta.findOne({ _id: tarjetaId, usuarioId }));
  if (!tarjeta) throw errorHttp("Tarjeta no encontrada", 404);
  return tarjeta;
};

export const crearTarjetaService = async (usuarioId, data) => {
  await validarRelaciones(usuarioId, data);
  const tarjeta = await Tarjeta.create({ usuarioId, ...data, bancoId: data.bancoId || null });
  return obtenerTarjetaPorIdService(usuarioId, tarjeta._id);
};

export const actualizarTarjetaService = async (usuarioId, tarjetaId, data) => {
  const actual = await buscarTarjeta(usuarioId, tarjetaId);
  await validarRelaciones(usuarioId, {
    cuentaId: data.cuentaId || actual.cuentaId,
    bancoId: Object.hasOwn(data, "bancoId") ? data.bancoId : actual.bancoId,
  });

  const tarjeta = await Tarjeta.findOneAndUpdate(
    { _id: tarjetaId, usuarioId },
    { ...data, ...(Object.hasOwn(data, "bancoId") ? { bancoId: data.bancoId || null } : {}) },
    { new: true, runValidators: true },
  );
  return obtenerTarjetaPorIdService(usuarioId, tarjeta._id);
};

export const eliminarTarjetaService = async (usuarioId, tarjetaId) => {
  await buscarTarjeta(usuarioId, tarjetaId);
  if (await ResumenTarjeta.exists({ usuarioId, tarjetaId })) {
    throw errorHttp("No se puede eliminar una tarjeta que ya tiene resúmenes importados", 409);
  }
  return Tarjeta.findOneAndDelete({ _id: tarjetaId, usuarioId });
};

export const previsualizarResumenTarjetaService = async ({ usuarioId, tarjetaId, file }) => {
  if (!file) throw errorHttp("No se recibió ningún archivo Excel");
  const tarjeta = await buscarTarjeta(usuarioId, tarjetaId);
  const resultado = parsearExcelTarjeta(file.buffer);

  const esperados = tarjeta.ultimosDigitos;
  const encontrados = resultado.resumen.cuentaTarjetaUltimosDigitos;
  if (esperados && encontrados && esperados !== encontrados) {
    throw errorHttp(
      `El archivo corresponde a la tarjeta terminada en ${encontrados}, no a la terminada en ${esperados}`,
      409,
    );
  }

  return {
    ...resultado,
    archivoNombre: file.originalname,
    totalLeidos: resultado.movimientos.length,
  };
};

const crearClaveResumen = (tarjetaId, resumen) =>
  crypto
    .createHash("sha256")
    .update(
      [
        tarjetaId,
        resumen.cuentaTarjetaUltimosDigitos || "",
        resumen.periodo || "",
        new Date(resumen.cierre).toISOString().slice(0, 10),
      ].join("|"),
    )
    .digest("hex");

const calcularMontoReal = (movimiento) => {
  if (movimiento.incluirMontoReal !== true) return 0;
  return Number(movimiento.montoBancario) * (Number(movimiento.porcentaje) / 100);
};

export const importarResumenTarjetaService = async ({
  usuarioId,
  tarjetaId,
  resumen,
  movimientos,
  archivoNombre,
}) => {
  const tarjeta = await buscarTarjeta(usuarioId, tarjetaId);
  const importacionKey = crearClaveResumen(tarjetaId, resumen);

  let resumenGuardado = await ResumenTarjeta.findOne({ usuarioId, tarjetaId, importacionKey });
  if (!resumenGuardado) {
    resumenGuardado = await ResumenTarjeta.create({
      usuarioId,
      tarjetaId,
      cuentaId: tarjeta.cuentaId,
      ...resumen,
      importacionKey,
      archivoNombre,
      cantidadMovimientos: 0,
    });
  }

  const operaciones = movimientos.map((movimiento) => ({
    updateOne: {
      filter: {
        usuarioId,
        resumenTarjetaId: resumenGuardado._id,
        hashImportacion: movimiento.sourceHash,
      },
      update: {
        $setOnInsert: {
          usuarioId,
          cuentaId: tarjeta.cuentaId,
          tarjetaId: tarjeta._id,
          resumenTarjetaId: resumenGuardado._id,
          detalle: movimiento.detalle,
          fecha: movimiento.fecha,
          montoBancario: movimiento.montoBancario,
          montoOriginalTarjeta: movimiento.montoEstadoCuenta,
          montoReal: calcularMontoReal(movimiento),
          porcentaje: movimiento.porcentaje,
          incluirMontoReal: movimiento.incluirMontoReal,
          moneda: movimiento.moneda,
          estado: "pendiente",
          tipoMovimiento: movimiento.tipo,
          origen: { tipo: "tarjeta", referenciaId: null },
          hashImportacion: movimiento.sourceHash,
          resumenTarjeta: {
            tarjeta: resumen.cuentaTarjetaUltimosDigitos || tarjeta.ultimosDigitos,
            cierre: resumen.cierre,
            vencimiento: resumen.vencimiento,
            periodo: resumen.periodo,
            importacionKey,
          },
        },
      },
      upsert: true,
    },
  }));

  if (operaciones.length > 0) {
    await Gasto.bulkWrite(operaciones, { ordered: false });
  }

  const gastos = await Gasto.find({
    usuarioId,
    resumenTarjetaId: resumenGuardado._id,
  }).sort({ fecha: 1, _id: 1 });

  resumenGuardado.cantidadMovimientos = gastos.length;
  await resumenGuardado.save();

  return { resumen: resumenGuardado, gastos };
};

export const obtenerResumenesTarjetaService = async (usuarioId, tarjetaId) => {
  await buscarTarjeta(usuarioId, tarjetaId);
  const resumenes = await ResumenTarjeta.find({ usuarioId, tarjetaId }).sort({ cierre: -1 });

  const ids = resumenes.map((resumen) => resumen._id);
  const totales = ids.length
    ? await Gasto.aggregate([
        { $match: { usuarioId: resumenes[0].usuarioId, resumenTarjetaId: { $in: ids } } },
        {
          $group: {
            _id: { resumenId: "$resumenTarjetaId", moneda: "$moneda", estado: "$estado" },
            total: { $sum: "$montoBancario" },
            cantidad: { $sum: 1 },
          },
        },
      ])
    : [];

  const totalesPorResumen = new Map();
  totales.forEach((total) => {
    const clave = String(total._id.resumenId);
    const actual = totalesPorResumen.get(clave) || { UYU: 0, USD: 0, pendientes: 0, creados: 0 };
    actual[total._id.moneda] += total.total;
    actual[total._id.estado === "creado" ? "creados" : "pendientes"] += total.cantidad;
    totalesPorResumen.set(clave, actual);
  });

  return resumenes.map((resumen) => ({
    ...resumen.toObject(),
    totales: totalesPorResumen.get(String(resumen._id)) || {
      UYU: 0,
      USD: 0,
      pendientes: 0,
      creados: 0,
    },
  }));
};

export const obtenerResumenTarjetaService = async (usuarioId, tarjetaId, resumenId) => {
  await buscarTarjeta(usuarioId, tarjetaId);
  const resumen = await ResumenTarjeta.findOne({ _id: resumenId, usuarioId, tarjetaId });
  if (!resumen) throw errorHttp("Resumen de tarjeta no encontrado", 404);

  const gastos = await Gasto.find({ usuarioId, tarjetaId, resumenTarjetaId: resumenId })
    .populate("categoriaId", "nombreCategoria")
    .populate("subcategoriaId", "nombreSubcategoria")
    .populate({
      path: "origen.referenciaId",
      select: "detalle cuentaId fecha montoBancario",
      populate: { path: "cuentaId", select: "nombreCuenta" },
    })
    .sort({ fecha: 1, _id: 1 });

  return { resumen, gastos };
};

