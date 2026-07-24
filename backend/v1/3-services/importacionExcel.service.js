import MovimientoImportado from "../0.1-models/movimientoImportado.model.js";
import Gasto from "../0.1-models/gasto.model.js";
import Cuenta from "../0.1-models/cuenta.model.js";
import ResumenTarjeta from "../0.1-models/resumenTarjeta.model.js";
import Subcategoria from "../0.1-models/subcategoria.model.js";
import { crearGastoService } from "./gasto.service.js";
import {
  parsearExcelBancario,
  parsearExcelPersonal,
  parsearExcelTarjeta,
} from "../utils/excelParsers.js";
import { calcularTotalesResumen } from "../utils/resumenTarjetaTotales.js";

export const importarExcelService = async ({ usuarioId, cuentaId, file }) => {
  if (!file) {
    throw new Error("No se recibio ningun archivo Excel");
  }

  const { movimientos } = parsearExcelBancario(file.buffer);

  const movimientosProcesados = [];

  for (const movimiento of movimientos) {
    const detalleNormalizado = normalizarTexto(movimiento.detalleOriginal);

    const hashBanco = crearHashBanco({
      usuarioId,
      cuentaId,
      referenciaBanco: movimiento.referenciaBanco,
      fechaBanco: movimiento.fechaBanco,
      montoBancario: movimiento.montoBancario,
      detalleNormalizado,
    });

    const movimientoExistente = await MovimientoImportado.findOne({
      usuarioId,
      cuentaId,
      hashBanco,
    });

    if (movimientoExistente) {
      await liberarMovimientoSiGastoFueEliminado(movimientoExistente);
    }

    const posiblesDuplicados = await buscarPosiblesDuplicados({
      usuarioId,
      cuentaId,
      fechaBanco: movimiento.fechaBanco,
      montoBancario: movimiento.montoBancario,
      detalleNormalizado,
    });

    if (movimientoExistente) {
      movimientosProcesados.push({
        estado: "duplicado_importacion",
        movimiento: movimientoExistente,
        posiblesDuplicados,
      });

      continue;
    }

    const movimientoCreado = await MovimientoImportado.create({
      usuarioId,
      cuentaId,
      referenciaBanco: movimiento.referenciaBanco,
      fechaBanco: movimiento.fechaBanco,
      detalleOriginal: movimiento.detalleOriginal,
      detalleNormalizado,
      montoBancario: movimiento.montoBancario,
      moneda: movimiento.moneda,
      hashBanco,
      archivoNombre: file.originalname,
    });

    movimientosProcesados.push({
      estado: posiblesDuplicados.length > 0 ? "posible_duplicado" : "nuevo",
      movimiento: movimientoCreado,
      posiblesDuplicados,
    });
  }

  return {
    totalLeidos: movimientos.length,
    totalProcesados: movimientosProcesados.length,
    movimientos: movimientosProcesados,
  };
};




const obtenerCuentaCredito = async (usuarioId, cuentaId) => {
  const cuenta = await Cuenta.findOne({ _id: cuentaId, usuarioId });
  if (!cuenta) {
    const error = new Error("Cuenta no encontrada");
    error.status = 404;
    throw error;
  }
  if (cuenta.tipoCuenta !== "credito") {
    const error = new Error("Este formato sólo corresponde a cuentas de crédito");
    error.status = 409;
    throw error;
  }
  return cuenta;
};

export const importarExcelTarjetaService = async ({ usuarioId, cuentaId, file }) => {
  if (!file) {
    throw new Error("No se recibio ningun archivo Excel");
  }

  await obtenerCuentaCredito(usuarioId, cuentaId);

  const { resumen, movimientos } = parsearExcelTarjeta(file.buffer);

  return {
    resumen,
    archivoNombre: file.originalname,
    totalLeidos: movimientos.length,
    totalProcesados: movimientos.length,
    movimientos,
  };
};

export const confirmarImportacionTarjetaCuentaService = async ({
  usuarioId,
  cuentaId,
  resumen,
  movimientos,
  archivoNombre,
}) => {
  await obtenerCuentaCredito(usuarioId, cuentaId);

  const cierre = new Date(resumen.cierre).toISOString().slice(0, 10);
  const importacionKey = [
    "tarjeta",
    cuentaId,
    resumen.cuentaTarjetaUltimosDigitos || "",
    resumen.periodo || "",
    cierre,
  ].join("|");

  const resumenGuardado = await ResumenTarjeta.findOneAndUpdate(
    { usuarioId, cuentaId, tarjetaId: null, importacionKey },
    {
      $set: {
        periodo: resumen.periodo,
        cierre: resumen.cierre,
        vencimiento: resumen.vencimiento || null,
        cuentaTarjetaUltimosDigitos: resumen.cuentaTarjetaUltimosDigitos || "",
        limiteCredito: resumen.limiteCredito,
        pagoContado: resumen.pagoContado,
        pagoMinimo: resumen.pagoMinimo,
        saldoAnterior: resumen.saldoAnterior,
        saldoFinal: resumen.saldoFinal,
        archivoNombre,
      },
      $setOnInsert: {
        usuarioId,
        cuentaId,
        tarjetaId: null,
        importacionKey,
        cantidadMovimientos: 0,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  const operaciones = movimientos.map((movimiento) => {
    const hashImportacion = `${importacionKey}|${movimiento.sourceHash}`;
    const montoReal = movimiento.incluirMontoReal === true
      ? Number(movimiento.montoBancario) * (Number(movimiento.porcentaje) / 100)
      : 0;

    return {
      updateOne: {
        filter: { usuarioId, cuentaId, hashImportacion },
        update: {
          $set: {
            resumenTarjetaId: resumenGuardado._id,
            montoBancario: movimiento.montoBancario,
            montoOriginalTarjeta: movimiento.montoEstadoCuenta,
            tipoMovimiento: movimiento.tipo,
          },
          $setOnInsert: {
            usuarioId,
            cuentaId,
            detalle: movimiento.detalle,
            fecha: movimiento.fecha,
            montoReal,
            porcentaje: movimiento.porcentaje,
            incluirMontoReal: movimiento.incluirMontoReal,
            moneda: movimiento.moneda,
            estado: "pendiente",
            origen: { tipo: "tarjeta", referenciaId: null },
            hashImportacion,
            resumenTarjeta: {
              tarjeta: resumen.cuentaTarjetaUltimosDigitos,
              cierre: resumen.cierre,
              vencimiento: resumen.vencimiento,
              periodo: resumen.periodo,
              importacionKey,
            },
          },
        },
        upsert: true,
      },
    };
  });

  const resultado = operaciones.length > 0
    ? await Gasto.bulkWrite(operaciones, { ordered: false })
    : { upsertedCount: 0 };
  const hashes = movimientos.map((movimiento) => `${importacionKey}|${movimiento.sourceHash}`);
  const gastos = await Gasto.find({ usuarioId, cuentaId, hashImportacion: { $in: hashes } })
    .sort({ fecha: 1, _id: 1 });

  resumenGuardado.cantidadMovimientos = await Gasto.countDocuments({
    usuarioId,
    cuentaId,
    resumenTarjetaId: resumenGuardado._id,
  });
  await resumenGuardado.save();

  return {
    resumen: resumenGuardado,
    totalLeidos: movimientos.length,
    totalCreados: resultado.upsertedCount || 0,
    totalDuplicados: movimientos.length - (resultado.upsertedCount || 0),
    gastos,
  };
};

const obtenerGastosDeResumenes = async (usuarioId, resumenes) => {
  const ids = resumenes.map((resumen) => resumen._id);
  if (ids.length === 0) return [];

  return Gasto.find({
    usuarioId,
    resumenTarjetaId: { $in: ids },
  }).lean();
};

const presentarResumenCuentaCredito = (resumen, gastos) => ({
  ...resumen.toObject(),
  totales: calcularTotalesResumen(resumen, gastos),
});

export const obtenerResumenesCuentaCreditoService = async ({ usuarioId, cuentaId }) => {
  await obtenerCuentaCredito(usuarioId, cuentaId);

  const resumenes = await ResumenTarjeta.find({
    usuarioId,
    cuentaId,
    tarjetaId: null,
  }).sort({ cierre: -1, _id: -1 });
  const gastos = await obtenerGastosDeResumenes(usuarioId, resumenes);

  return resumenes.map((resumen) => presentarResumenCuentaCredito(
    resumen,
    gastos.filter((gasto) => String(gasto.resumenTarjetaId) === String(resumen._id)),
  ));
};

export const obtenerResumenCuentaCreditoService = async ({
  usuarioId,
  cuentaId,
  resumenId,
}) => {
  await obtenerCuentaCredito(usuarioId, cuentaId);

  const resumen = await ResumenTarjeta.findOne({
    _id: resumenId,
    usuarioId,
    cuentaId,
    tarjetaId: null,
  });
  if (!resumen) {
    const error = new Error("Resumen de tarjeta no encontrado");
    error.status = 404;
    throw error;
  }

  const gastos = await Gasto.find({
    usuarioId,
    cuentaId,
    resumenTarjetaId: resumen._id,
  }).lean();

  return presentarResumenCuentaCredito(resumen, gastos);
};

export const importarExcelPersonalService = async ({ usuarioId, cuentaId, file }) => {
  if (!file) {
    throw new Error("No se recibio ningun archivo Excel");
  }

  const { movimientos } = parsearExcelPersonal(file.buffer);
  const gastosProcesados = [];

  for (const movimiento of movimientos) {
    const hashImportacion = `personal|${cuentaId}|${movimiento.sourceHash}`;
    const gastoExistente = await Gasto.findOne({ usuarioId, hashImportacion });
    if (gastoExistente) {
      gastosProcesados.push({
        gasto: gastoExistente,
        duplicado: true,
        subcategoriaEncontrada: Boolean(gastoExistente.subcategoriaId),
        nombreSubcategoria: movimiento.nombreSubcategoria,
      });
      continue;
    }

    const subcategoria = movimiento.nombreSubcategoria
      ? await Subcategoria.findOne({
          usuarioId,
          nombreSubcategoria: new RegExp(`^${escaparRegex(movimiento.nombreSubcategoria)}$`, "i"),
        })
      : null;

    const gasto = await crearGastoService(
      {
        detalle: movimiento.detalle,
        cuentaId,
        fecha: movimiento.fecha,
        montoBancario: movimiento.montoBancario,
        porcentaje: movimiento.porcentaje,
        incluirMontoReal: true,
        subcategoriaId: subcategoria?._id,
        cambiarEstado: false,
        origen: {
          tipo: "excel",
          referenciaId: null,
        },
        hashImportacion,
      },
      usuarioId
    );

    gastosProcesados.push({
      gasto,
      duplicado: false,
      subcategoriaEncontrada: Boolean(subcategoria),
      nombreSubcategoria: movimiento.nombreSubcategoria,
    });
  }

  return {
    totalLeidos: movimientos.length,
    totalProcesados: gastosProcesados.length,
    gastos: gastosProcesados,
  };
};
const buscarPosiblesDuplicados = async ({
  usuarioId,
  cuentaId,
  fechaBanco,
  montoBancario,
  detalleNormalizado,
}) => {
  const desde = new Date(fechaBanco);
  desde.setDate(desde.getDate() - 7);

  const hasta = new Date(fechaBanco);
  hasta.setDate(hasta.getDate() + 7);

  const gastos = await Gasto.find({
    usuarioId,
    cuentaId,
    montoBancario,
    fecha: {
      $gte: desde,
      $lte: hasta,
    },
  });

  return gastos.filter((gasto) => {
    const detalleGasto = normalizarTexto(gasto.detalle);
    return detalleGasto.includes(detalleNormalizado) ||
      detalleNormalizado.includes(detalleGasto);
  });
};

const crearHashBanco = ({
  usuarioId,
  cuentaId,
  referenciaBanco,
  fechaBanco,
  montoBancario,
  detalleNormalizado,
}) => {
  const fecha = new Date(fechaBanco).toISOString().slice(0, 10);

  return [
    usuarioId,
    cuentaId,
    referenciaBanco,
    fecha,
    montoBancario,
    detalleNormalizado,
  ].join("|");
};

const escaparRegex = (texto) => {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const liberarMovimientoSiGastoFueEliminado = async (movimiento) => {
  if (movimiento.estadoImportacion !== "vinculado" || !movimiento.gastoId) {
    return movimiento;
  }

  const gastoExiste = await Gasto.exists({
    _id: movimiento.gastoId,
    usuarioId: movimiento.usuarioId,
  });

  if (gastoExiste) {
    return movimiento;
  }

  movimiento.estadoImportacion = "pendiente";
  movimiento.gastoId = null;
  await movimiento.save();

  return movimiento;
};

const normalizarTexto = (texto) => {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const limpiarMovimientosVinculadosSinGasto = async ({ usuarioId, cuentaId }) => {
  const movimientos = await MovimientoImportado.find({
    usuarioId,
    cuentaId,
    estadoImportacion: "vinculado",
    gastoId: { $ne: null },
  });

  for (const movimiento of movimientos) {
    await liberarMovimientoSiGastoFueEliminado(movimiento);
  }
};

export const obtenerMovimientosImportadosService = async ({
  usuarioId,
  cuentaId,
  estadoImportacion,
}) => {
  await limpiarMovimientosVinculadosSinGasto({ usuarioId, cuentaId });

  const filtro = {
    usuarioId,
    cuentaId,
  };

  if (estadoImportacion) {
    filtro.estadoImportacion = estadoImportacion;
  }

  const movimientos = await MovimientoImportado.find(filtro)
    .populate("gastoId")
    .sort({ fechaBanco: -1 });

  for (const movimiento of movimientos) {
    if (movimiento.estadoImportacion === "vinculado" && !movimiento.gastoId) {
      movimiento.estadoImportacion = "pendiente";
      movimiento.gastoId = null;
      await movimiento.save();
    }
  }

  return movimientos;
};

export const ignorarMovimientoImportadoService = async ({ usuarioId, id }) => {
  const movimiento = await MovimientoImportado.findOneAndUpdate(
    { _id: id, usuarioId },
    {
      estadoImportacion: "ignorado",
      gastoId: null,
    },
    { new: true }
  );

  if (!movimiento) {
    throw new Error("Movimiento importado no encontrado");
  }

  return movimiento;
};

export const vincularMovimientoAGastoService = async ({
  usuarioId,
  id,
  gastoId,
}) => {
  const movimiento = await MovimientoImportado.findOne({
    _id: id,
    usuarioId,
  });

  if (!movimiento) {
    throw new Error("Movimiento importado no encontrado");
  }

  const gasto = await Gasto.findOne({
    _id: gastoId,
    usuarioId,
    cuentaId: movimiento.cuentaId,
  });

  if (!gasto) {
    throw new Error("Gasto no encontrado para esta cuenta");
  }

  movimiento.gastoId = gasto._id;
  movimiento.estadoImportacion = "vinculado";

  await movimiento.save();

  return movimiento;
};

export const crearGastoDesdeMovimientoImportadoService = async ({
  usuarioId,
  id,
  data,
}) => {
  const movimiento = await MovimientoImportado.findOne({
    _id: id,
    usuarioId,
  });

  if (!movimiento) {
    throw new Error("Movimiento importado no encontrado");
  }

  await liberarMovimientoSiGastoFueEliminado(movimiento);

  if (movimiento.estadoImportacion === "vinculado") {
    const error = new Error("El gasto de este movimiento bancario ya existe");
    error.status = 409;
    throw error;
  }

  const hashImportacion = `bancario|${movimiento.hashBanco}`;
  const gastoExistente = await Gasto.findOne({
    usuarioId,
    $or: [
      {
        "origen.tipo": "excel",
        "origen.referenciaId": movimiento._id,
      },
      { hashImportacion },
    ],
  }).select("_id");

  if (gastoExistente) {
    movimiento.gastoId = gastoExistente._id;
    movimiento.estadoImportacion = "vinculado";
    await movimiento.save();

    const error = new Error("El gasto de este movimiento bancario ya existe");
    error.status = 409;
    throw error;
  }

  let gasto;
  try {
    gasto = await crearGastoService(
      {
        detalle: data.detalle || movimiento.detalleOriginal,
        cuentaId: movimiento.cuentaId,
        fecha: data.fecha || movimiento.fechaBanco,
        montoBancario: movimiento.montoBancario,
        porcentaje: data.porcentaje,
        incluirMontoReal: data.incluirMontoReal,
        categoriaId: data.categoriaId,
        subcategoriaId: data.subcategoriaId,
        cambiarEstado: data.cambiarEstado,
        origen: {
          tipo: "excel",
          referenciaId: movimiento._id,
        },
        hashImportacion,
      },
      usuarioId,
    );
  } catch (error) {
    if (error?.code === 11000) {
      const conflicto = new Error("El gasto de este movimiento bancario ya existe");
      conflicto.status = 409;
      throw conflicto;
    }
    throw error;
  }

  movimiento.gastoId = gasto._id;
  movimiento.estadoImportacion = "vinculado";

  await movimiento.save();

  return {
    movimiento,
    gasto,
  };
};
