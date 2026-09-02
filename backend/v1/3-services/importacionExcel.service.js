import MovimientoImportado from "../0.1-models/movimientoImportado.model.js";
import SaldoCuenta from "../0.1-models/saldoCuenta.model.js";
import Gasto from "../0.1-models/gasto.model.js";
import Cuenta from "../0.1-models/cuenta.model.js";
import ResumenTarjeta from "../0.1-models/resumenTarjeta.model.js";
import Categoria from "../0.1-models/categoria.model.js";
import Subcategoria from "../0.1-models/subcategoria.model.js";
import { crearGastoService } from "./gasto.service.js";
import {
  listarHojasExcel,
  parsearExcelBancario,
  parsearExcelPersonal,
  parsearExcelTarjeta,
} from "../utils/excelParsers.js";
import { calcularTotalesResumen } from "../utils/resumenTarjetaTotales.js";
import {
  normalizarMoneda,
  obtenerMonedaMovimiento,
  obtenerMonedasCuenta,
} from "../utils/monedas.js";
import {
  esMontoDistintoDeCero,
} from "../utils/montosGasto.js";
import {
  construirPlanesCuotasResumen,
  extraerPlanCuotasTarjeta,
} from "../utils/planesCuotasTarjeta.js";

export const actualizarSaldoCuentaDesdeExcel = async ({
  cuenta,
  saldoDetectado,
  archivoNombre,
}) => {
  if (!saldoDetectado) return null;

  const respuesta = {
    ...saldoDetectado,
    actualizado: false,
    saldoActual: cuenta.saldoActual ?? null,
    motivo: null,
  };

  if (cuenta.tipoCuenta !== "debito") {
    return { ...respuesta, motivo: "cuenta_credito" };
  }

  const monedaSaldo = normalizarMoneda(saldoDetectado.moneda);
  const monedaCuenta = normalizarMoneda(cuenta.moneda);
  if (monedaSaldo !== monedaCuenta) {
    return { ...respuesta, motivo: "moneda_no_coincide" };
  }

  const fechaSaldo = new Date(saldoDetectado.fecha);
  const fechaReferenciaActual = cuenta.saldoInformadoAl
    || (cuenta.saldoActual !== null && cuenta.saldoActual !== undefined
      ? cuenta.saldoActualizadoEn
      : null);

  if (
    fechaReferenciaActual
    && fechaSaldo < new Date(fechaReferenciaActual)
  ) {
    return { ...respuesta, motivo: "saldo_mas_antiguo" };
  }

  cuenta.saldoActual = Number(saldoDetectado.monto);
  cuenta.saldoActualizadoEn = new Date();
  cuenta.saldoInformadoAl = fechaSaldo;
  cuenta.saldoOrigen = "excel";
  cuenta.saldoArchivoNombre = archivoNombre || null;
  await cuenta.save();

  return {
    ...respuesta,
    actualizado: true,
    saldoActual: cuenta.saldoActual,
  };
};

export const importarExcelService = async ({ usuarioId, cuentaId, file }) => {
  if (!file) {
    throw new Error("No se recibio ningun archivo Excel");
  }

  const cuenta = await Cuenta.findOne({ _id: cuentaId, usuarioId })
    .select(
      "_id moneda tipoCuenta monedas saldoActual saldoActualizadoEn saldoInformadoAl saldoOrigen saldoArchivoNombre",
    );
  if (!cuenta) {
    const error = new Error("Cuenta no encontrada");
    error.status = 404;
    throw error;
  }

  const { movimientos, saldoDetectado } = parsearExcelBancario(file.buffer);

  const movimientosProcesados = [];
  const operacionesSaldos = [];

  for (const movimiento of movimientos) {
    const detalleNormalizado = normalizarTexto(movimiento.detalleOriginal);

    const hashBanco = crearHashBanco({
      usuarioId,
      cuentaId,
      referenciaBanco: movimiento.referenciaBanco,
      fechaBanco: movimiento.fechaBanco,
      montoBancario: movimiento.montoBancario,
      montoReal: movimiento.montoReal,
      detalleNormalizado,
    });

    if (movimiento.saldoBanco !== null && movimiento.saldoBanco !== undefined) {
      operacionesSaldos.push({
        updateOne: {
          filter: { usuarioId, cuentaId, hashBanco },
          update: {
            $set: {
              fecha: movimiento.fechaBanco,
              monto: movimiento.saldoBanco,
              moneda: obtenerMonedaMovimiento(cuenta, movimiento.moneda),
              referenciaBanco: movimiento.referenciaBanco || null,
              detalleOriginal: movimiento.detalleOriginal,
              filaExcel: movimiento.filaExcel || null,
              archivoNombre: file.originalname,
              cuentaBanco: saldoDetectado?.cuentaBanco || null,
            },
            $setOnInsert: {
              usuarioId,
              cuentaId,
              hashBanco,
            },
          },
          upsert: true,
        },
      });
    }

    let movimientoExistente = await MovimientoImportado.findOne({
      usuarioId,
      cuentaId,
      hashBanco,
    });

    if (!movimientoExistente && movimiento.tipoMonto === "real") {
      const hashAnterior = crearHashBanco({
        usuarioId,
        cuentaId,
        referenciaBanco: movimiento.referenciaBanco,
        fechaBanco: movimiento.fechaBanco,
        montoBancario: movimiento.montoReal,
        montoReal: 0,
        detalleNormalizado,
      });
      const movimientoAnterior = await MovimientoImportado.findOne({
        usuarioId,
        cuentaId,
        hashBanco: hashAnterior,
      });

      if (
        movimientoAnterior
        && movimientoAnterior.estadoImportacion !== "vinculado"
        && !movimientoAnterior.gastoId
      ) {
        movimientoAnterior.montoBancario = 0;
        movimientoAnterior.montoReal = movimiento.montoReal;
        movimientoAnterior.saldoBanco = movimiento.saldoBanco ?? null;
        movimientoAnterior.tipoMonto = "real";
        movimientoAnterior.hashBanco = hashBanco;
        movimientoAnterior.archivoNombre = file.originalname;
        movimientoAnterior.estadoImportacion = "pendiente";
        await movimientoAnterior.save();
      }

      movimientoExistente = movimientoAnterior;
    }

    if (movimientoExistente) {
      await liberarMovimientoSiGastoFueEliminado(movimientoExistente);
      movimientoExistente.saldoBanco = movimiento.saldoBanco ?? null;
      movimientoExistente.archivoNombre = file.originalname;
      await movimientoExistente.save();
    }

    const posiblesDuplicados = await buscarPosiblesDuplicados({
      usuarioId,
      cuentaId,
      fechaBanco: movimiento.fechaBanco,
      montoBancario: movimiento.montoBancario,
      montoReal: movimiento.montoReal,
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
      montoReal: movimiento.montoReal || 0,
      saldoBanco: movimiento.saldoBanco ?? null,
      tipoMonto: movimiento.tipoMonto || "bancario",
      moneda: obtenerMonedaMovimiento(cuenta, movimiento.moneda),
      hashBanco,
      archivoNombre: file.originalname,
    });

    movimientosProcesados.push({
      estado: posiblesDuplicados.length > 0 ? "posible_duplicado" : "nuevo",
      movimiento: movimientoCreado,
      posiblesDuplicados,
    });
  }

  const resultadoSaldos = operacionesSaldos.length > 0
    ? await SaldoCuenta.bulkWrite(operacionesSaldos, { ordered: false })
    : { matchedCount: 0, upsertedCount: 0 };

  const saldoCuenta = await actualizarSaldoCuentaDesdeExcel({
    cuenta,
    saldoDetectado,
    archivoNombre: file.originalname,
  });

  return {
    totalLeidos: movimientos.length,
    totalProcesados: movimientosProcesados.length,
    movimientos: movimientosProcesados,
    saldoDetectado: saldoCuenta,
    saldosGuardados:
      (resultadoSaldos.matchedCount || 0)
      + (resultadoSaldos.upsertedCount || 0),
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

const validarMonedasCuentaCredito = (cuenta, movimientos) => {
  const monedasHabilitadas = obtenerMonedasCuenta(cuenta);
  const monedasNoHabilitadas = [
    ...new Set(
      movimientos
        .map((movimiento) => normalizarMoneda(movimiento.moneda))
        .filter((moneda) => !monedasHabilitadas.includes(moneda)),
    ),
  ];

  if (monedasNoHabilitadas.length > 0) {
    const error = new Error(
      `La tarjeta no tiene habilitada la moneda ${monedasNoHabilitadas.join(", ")}`,
    );
    error.status = 409;
    throw error;
  }
};

const normalizarCatalogosMovimientosTarjeta = async (
  usuarioId,
  movimientos,
) => {
  const categoriaIds = [
    ...new Set(movimientos.map((movimiento) => movimiento.categoriaId).filter(Boolean)),
  ];
  const subcategoriaIds = [
    ...new Set(movimientos.map((movimiento) => movimiento.subcategoriaId).filter(Boolean)),
  ];

  const [categorias, subcategorias] = await Promise.all([
    categoriaIds.length > 0
      ? Categoria.find({ usuarioId, _id: { $in: categoriaIds } }).select("_id").lean()
      : [],
    subcategoriaIds.length > 0
      ? Subcategoria.find({ usuarioId, _id: { $in: subcategoriaIds } })
        .select("_id categoria")
        .lean()
      : [],
  ]);
  const categoriasValidas = new Set(
    categorias.map((categoria) => String(categoria._id)),
  );
  const subcategoriasValidas = new Map(
    subcategorias.map((subcategoria) => [String(subcategoria._id), subcategoria]),
  );

  return movimientos.map((movimiento) => {
    const categoriaId = movimiento.categoriaId
      ? String(movimiento.categoriaId)
      : "";
    const subcategoriaId = movimiento.subcategoriaId
      ? String(movimiento.subcategoriaId)
      : "";

    if (categoriaId && !categoriasValidas.has(categoriaId)) {
      const error = new Error("La categoría seleccionada no existe");
      error.status = 400;
      throw error;
    }

    const subcategoria = subcategoriaId
      ? subcategoriasValidas.get(subcategoriaId)
      : null;
    if (subcategoriaId && !subcategoria) {
      const error = new Error("La subcategoría seleccionada no existe");
      error.status = 400;
      throw error;
    }

    return {
      ...movimiento,
      categoriaId: subcategoria?.categoria || categoriaId || null,
      subcategoriaId: subcategoria?._id || null,
    };
  });
};

export const importarExcelTarjetaService = async ({ usuarioId, cuentaId, file }) => {
  if (!file) {
    throw new Error("No se recibio ningun archivo Excel");
  }

  const cuenta = await obtenerCuentaCredito(usuarioId, cuentaId);

  const { resumen, movimientos } = parsearExcelTarjeta(file.buffer);
  validarMonedasCuentaCredito(cuenta, movimientos);

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
  const cuenta = await obtenerCuentaCredito(usuarioId, cuentaId);
  validarMonedasCuentaCredito(cuenta, movimientos);
  const movimientosConPlanes = movimientos.map((movimiento) => {
    const financiamientoTarjeta = movimiento.tipo === "cuota"
      ? extraerPlanCuotasTarjeta({
        detalle: movimiento.detalle,
        fecha: movimiento.fecha,
        moneda: movimiento.moneda,
        monto: movimiento.montoEstadoCuenta,
      })
      : null;
    return {
      ...movimiento,
      financiamientoTarjeta,
    };
  });
  const movimientosNormalizados = await normalizarCatalogosMovimientosTarjeta(
    usuarioId,
    movimientosConPlanes,
  );

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

  const operaciones = movimientosNormalizados.map((movimiento) => {
    const hashImportacion = `${importacionKey}|${movimiento.sourceHash}`;
    return {
      updateOne: {
        filter: { usuarioId, cuentaId, hashImportacion },
        update: {
          $set: {
            resumenTarjetaId: resumenGuardado._id,
            montoBancario: movimiento.montoBancario,
            montoReal: 0,
            porcentaje: 0,
            incluirMontoReal: false,
            montoOriginalTarjeta: movimiento.montoEstadoCuenta,
            tipoMovimiento: movimiento.tipo,
            ...(movimiento.financiamientoTarjeta
              ? {
                financiamientoTarjeta: {
                  planKey: movimiento.financiamientoTarjeta.planKey,
                  detalleBase: movimiento.financiamientoTarjeta.detalleBase,
                  cuotaActual: movimiento.financiamientoTarjeta.cuotaActual,
                  cuotasTotales: movimiento.financiamientoTarjeta.cuotasTotales,
                  montoCuota: movimiento.financiamientoTarjeta.montoCuota,
                  estimado: movimiento.financiamientoTarjeta.estimado !== false,
                },
              }
              : {}),
            ...(movimiento.categoriaId
              ? { categoriaId: movimiento.categoriaId }
              : {}),
            ...(movimiento.subcategoriaId
              ? { subcategoriaId: movimiento.subcategoriaId }
              : {}),
          },
          $setOnInsert: {
            usuarioId,
            cuentaId,
            detalle: movimiento.detalle,
            fecha: movimiento.fecha,
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
  const hashes = movimientosNormalizados.map(
    (movimiento) => `${importacionKey}|${movimiento.sourceHash}`,
  );
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
    totalLeidos: movimientosNormalizados.length,
    totalCreados: resultado.upsertedCount || 0,
    totalDuplicados:
      movimientosNormalizados.length - (resultado.upsertedCount || 0),
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

const presentarResumenCuentaCredito = (resumen, gastos, cuenta) => {
  const planesCuotas = construirPlanesCuotasResumen(gastos);
  return {
    ...resumen.toObject(),
    planesCuotas,
    totales: calcularTotalesResumen(
      resumen,
      gastos,
      obtenerMonedasCuenta(cuenta),
      planesCuotas,
    ),
  };
};

export const obtenerResumenesCuentaCreditoService = async ({ usuarioId, cuentaId }) => {
  const cuenta = await obtenerCuentaCredito(usuarioId, cuentaId);

  const resumenes = await ResumenTarjeta.find({
    usuarioId,
    cuentaId,
    tarjetaId: null,
  }).sort({ cierre: -1, _id: -1 });
  const gastos = await obtenerGastosDeResumenes(usuarioId, resumenes);

  return resumenes.map((resumen) => presentarResumenCuentaCredito(
    resumen,
    gastos.filter((gasto) => String(gasto.resumenTarjetaId) === String(resumen._id)),
    cuenta,
  ));
};

export const obtenerResumenCuentaCreditoService = async ({
  usuarioId,
  cuentaId,
  resumenId,
}) => {
  const cuenta = await obtenerCuentaCredito(usuarioId, cuentaId);

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

  return presentarResumenCuentaCredito(resumen, gastos, cuenta);
};

export const eliminarResumenCuentaCreditoService = async ({
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
  }).select("_id");
  const gastoIds = gastos.map((gasto) => gasto._id);

  if (gastoIds.length > 0) {
    await Promise.all([
      Gasto.updateMany(
        { usuarioId, "origen.referenciaId": { $in: gastoIds } },
        { $set: { "origen.referenciaId": null } },
      ),
      MovimientoImportado.updateMany(
        { usuarioId, gastoId: { $in: gastoIds } },
        { $set: { estadoImportacion: "pendiente", gastoId: null } },
      ),
    ]);
  }

  const gastosEliminados = await Gasto.deleteMany({
    usuarioId,
    cuentaId,
    resumenTarjetaId: resumen._id,
  });

  await ResumenTarjeta.deleteOne({
    _id: resumen._id,
    usuarioId,
    cuentaId,
    tarjetaId: null,
  });

  return {
    resumen,
    gastosEliminados: gastosEliminados.deletedCount || 0,
  };
};

export const obtenerHojasExcelPersonalService = ({ file }) => {
  if (!file) {
    throw new Error("No se recibio ningun archivo Excel");
  }

  return listarHojasExcel(file.buffer);
};

export const importarExcelPersonalService = async ({
  usuarioId,
  cuentaId,
  file,
  nombreHoja,
}) => {
  if (!file) {
    throw new Error("No se recibio ningun archivo Excel");
  }

  const cuenta = await Cuenta.findOne({ _id: cuentaId, usuarioId }).select("_id");
  if (!cuenta) {
    const error = new Error("Cuenta no encontrada");
    error.status = 404;
    throw error;
  }

  const {
    movimientos,
    nombreHoja: nombreHojaImportada,
  } = parsearExcelPersonal(file.buffer, nombreHoja);

  const hashesImportacion = movimientos.map(
    (movimiento) => `personal|${cuentaId}|${movimiento.sourceHash}`,
  );
  const [gastosExistentes, subcategorias] = await Promise.all([
    Gasto.find({
      usuarioId,
      cuentaId,
      hashImportacion: { $in: hashesImportacion },
    }).select("_id estado hashImportacion"),
    Subcategoria.find({ usuarioId }).select("_id nombreSubcategoria categoria"),
  ]);
  const gastoPorHash = new Map(
    gastosExistentes.map((gasto) => [gasto.hashImportacion, gasto]),
  );
  const subcategoriaPorNombre = new Map(
    subcategorias.map((subcategoria) => [
      normalizarTexto(subcategoria.nombreSubcategoria),
      subcategoria,
    ]),
  );

  const movimientosPrevisualizados = movimientos.map((movimiento) => {
    const hashImportacion = `personal|${cuentaId}|${movimiento.sourceHash}`;
    const gastoExistente = gastoPorHash.get(hashImportacion);
    const subcategoria = subcategoriaPorNombre.get(
      normalizarTexto(movimiento.nombreSubcategoria),
    );

    return {
      _id: movimiento.sourceHash,
      sourceHash: movimiento.sourceHash,
      fecha: movimiento.fecha,
      detalle: movimiento.detalle,
      montoBancario: movimiento.montoBancario,
      montoReal: movimiento.montoReal,
      porcentaje: movimiento.porcentaje,
      incluirMontoReal: movimiento.incluirMontoReal,
      sumaAlPresupuesto: false,
      categoriaId: subcategoria?.categoria || null,
      subcategoriaId: subcategoria?._id || null,
      nombreSubcategoria: movimiento.nombreSubcategoria,
      subcategoriaEncontrada: Boolean(subcategoria),
      duplicado: Boolean(gastoExistente),
      gastoId: gastoExistente?._id || null,
      estado: gastoExistente?.estado || "previsualizado",
    };
  });

  return {
    nombreHoja: nombreHojaImportada,
    totalLeidos: movimientos.length,
    totalPrevisualizados: movimientosPrevisualizados.length,
    totalDuplicados: gastosExistentes.length,
    movimientos: movimientosPrevisualizados,
  };
};

export const crearGastoDesdeExcelPersonalService = async ({
  usuarioId,
  cuentaId,
  data,
}) => {
  const cuenta = await Cuenta.findOne({ _id: cuentaId, usuarioId })
    .select("_id moneda");
  if (!cuenta) {
    const error = new Error("Cuenta no encontrada");
    error.status = 404;
    throw error;
  }

  const hashImportacion = `personal|${cuentaId}|${data.sourceHash}`;
  const gastoExistente = await Gasto.findOne({
    usuarioId,
    cuentaId,
    hashImportacion,
  }).select("_id");

  if (gastoExistente) {
    const error = new Error("Este gasto ya existe");
    error.status = 409;
    throw error;
  }

  const { sourceHash, ...gastoData } = data;

  try {
    return await crearGastoService(
      {
        ...gastoData,
        cuentaId,
        moneda: normalizarMoneda(cuenta.moneda),
        cambiarEstado: true,
        origen: {
          tipo: "excel",
          referenciaId: null,
        },
        hashImportacion,
      },
      usuarioId,
    );
  } catch (error) {
    if (error?.code === 11000) {
      const conflicto = new Error("Este gasto ya existe");
      conflicto.status = 409;
      throw conflicto;
    }
    throw error;
  }
};
const buscarPosiblesDuplicados = async ({
  usuarioId,
  cuentaId,
  fechaBanco,
  montoBancario,
  montoReal,
  detalleNormalizado,
}) => {
  const desde = new Date(fechaBanco);
  desde.setDate(desde.getDate() - 7);

  const hasta = new Date(fechaBanco);
  hasta.setDate(hasta.getDate() + 7);

  const filtroMonto = esMontoDistintoDeCero(montoBancario)
    ? { montoBancario: Number(montoBancario) }
    : {
        montoBancario: { $in: [0, null] },
        montoReal: Number(montoReal),
      };

  const gastos = await Gasto.find({
    usuarioId,
    cuentaId,
    ...filtroMonto,
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

export const crearHashBanco = ({
  usuarioId,
  cuentaId,
  referenciaBanco,
  fechaBanco,
  montoBancario,
  montoReal,
  detalleNormalizado,
}) => {
  const fecha = new Date(fechaBanco).toISOString().slice(0, 10);
  const montoClave = esMontoDistintoDeCero(montoBancario)
    ? Number(montoBancario)
    : `real:${Number(montoReal || 0)}`;

  return [
    usuarioId,
    cuentaId,
    referenciaBanco,
    fecha,
    montoClave,
    detalleNormalizado,
  ].join("|");
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
        montoBancario:
          data.montoBancario === "" || data.montoBancario === null
            ? 0
            : data.montoBancario ?? movimiento.montoBancario,
        montoReal: data.montoReal ?? movimiento.montoReal,
        porcentaje: data.porcentaje,
        incluirMontoReal: data.incluirMontoReal,
        sumaAlPresupuesto: data.sumaAlPresupuesto,
        categoriaId: data.categoriaId,
        subcategoriaId: data.subcategoriaId,
        // Confirmar un movimiento importado siempre crea el gasto definitivo.
        // El MovimientoImportado ya funciona como la etapa previa de revisión.
        cambiarEstado: true,
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
