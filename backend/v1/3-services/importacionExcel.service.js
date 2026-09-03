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
import { reconciliarPrestamosUsuarioSeguro } from "./conciliacionPrestamo.service.js";

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

  // Un ajuste manual representa el valor que el usuario conoce en ese momento,
  // pero la siguiente importacion bancaria debe volver a dejar la cuenta
  // sincronizada con el saldo informado por el banco. Entre dos Excels, en
  // cambio, conservamos siempre el saldo con fecha bancaria mas reciente para
  // que importar un estado viejo no haga retroceder la cuenta.
  if (
    cuenta.saldoOrigen === "excel"
    && fechaReferenciaActual
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
  const operacionesSaldosPorHash = new Map();
  const movimientosPreparados = movimientos.map((movimiento) => {
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
    const hashAnterior = movimiento.tipoMonto === "real"
      ? crearHashBanco({
          usuarioId,
          cuentaId,
          referenciaBanco: movimiento.referenciaBanco,
          fechaBanco: movimiento.fechaBanco,
          montoBancario: movimiento.montoReal,
          montoReal: 0,
          detalleNormalizado,
        })
      : null;

    return {
      movimiento,
      detalleNormalizado,
      hashBanco,
      hashAnterior,
    };
  });
  const hashesBuscados = [
    ...new Set(
      movimientosPreparados
        .flatMap(({ hashBanco, hashAnterior }) => [hashBanco, hashAnterior])
        .filter(Boolean),
    ),
  ];
  const movimientosExistentes = hashesBuscados.length > 0
    ? await MovimientoImportado.find({
        usuarioId,
        cuentaId,
        hashBanco: { $in: hashesBuscados },
      })
    : [];
  const movimientosPorHash = new Map(
    movimientosExistentes.map((movimiento) => [movimiento.hashBanco, movimiento]),
  );
  const idsGastosVinculados = [
    ...new Set(
      movimientosExistentes
        .filter((movimiento) => (
          movimiento.estadoImportacion === "vinculado" && movimiento.gastoId
        ))
        .map((movimiento) => String(movimiento.gastoId)),
    ),
  ];
  const [idsGastosQueExisten, gastosParaDuplicados] = await Promise.all([
    idsGastosVinculados.length > 0
      ? Gasto.find({
          _id: { $in: idsGastosVinculados },
          usuarioId,
        }).distinct("_id")
      : [],
    obtenerGastosParaBuscarDuplicados({
      usuarioId,
      cuentaId,
      movimientos: movimientosPreparados,
    }),
  ]);
  const idsGastosValidos = new Set(idsGastosQueExisten.map(String));
  const gastosPorMonto = indexarGastosPorMonto(gastosParaDuplicados);
  const movimientosNuevos = [];
  const actualizacionesPorId = new Map();

  for (const {
    movimiento,
    detalleNormalizado,
    hashBanco,
    hashAnterior,
  } of movimientosPreparados) {

    if (movimiento.saldoBanco !== null && movimiento.saldoBanco !== undefined) {
      operacionesSaldosPorHash.set(hashBanco, {
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

    let movimientoExistente = movimientosPorHash.get(hashBanco) || null;

    if (!movimientoExistente && hashAnterior) {
      const movimientoAnterior = movimientosPorHash.get(hashAnterior) || null;

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
        movimientosPorHash.delete(hashAnterior);
        movimientosPorHash.set(hashBanco, movimientoAnterior);
      }

      movimientoExistente = movimientoAnterior;
    }

    if (movimientoExistente) {
      if (
        movimientoExistente.estadoImportacion === "vinculado"
        && movimientoExistente.gastoId
        && !idsGastosValidos.has(String(movimientoExistente.gastoId))
      ) {
        movimientoExistente.estadoImportacion = "pendiente";
        movimientoExistente.gastoId = null;
      }
      movimientoExistente.saldoBanco = movimiento.saldoBanco ?? null;
      movimientoExistente.archivoNombre = file.originalname;
      if (!movimientoExistente.isNew) {
        actualizacionesPorId.set(String(movimientoExistente._id), movimientoExistente);
      }
    }

    const posiblesDuplicados = buscarPosiblesDuplicadosEnMemoria({
      fechaBanco: movimiento.fechaBanco,
      montoBancario: movimiento.montoBancario,
      montoReal: movimiento.montoReal,
      detalleNormalizado,
      gastosPorMonto,
    });

    if (movimientoExistente) {
      movimientosProcesados.push({
        estado: "duplicado_importacion",
        movimiento: movimientoExistente,
        posiblesDuplicados,
      });

      continue;
    }

    const movimientoCreado = new MovimientoImportado({
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
    movimientosNuevos.push(movimientoCreado);
    movimientosPorHash.set(hashBanco, movimientoCreado);

    movimientosProcesados.push({
      estado: posiblesDuplicados.length > 0 ? "posible_duplicado" : "nuevo",
      movimiento: movimientoCreado,
      posiblesDuplicados,
    });
  }

  const operacionesMovimientos = [
    ...[...actualizacionesPorId.values()].map((movimiento) => ({
      updateOne: {
        filter: { _id: movimiento._id, usuarioId, cuentaId },
        update: {
          $set: {
            montoBancario: movimiento.montoBancario,
            montoReal: movimiento.montoReal,
            saldoBanco: movimiento.saldoBanco ?? null,
            tipoMonto: movimiento.tipoMonto,
            hashBanco: movimiento.hashBanco,
            estadoImportacion: movimiento.estadoImportacion,
            gastoId: movimiento.gastoId || null,
            archivoNombre: movimiento.archivoNombre,
          },
        },
      },
    })),
    ...movimientosNuevos.map((movimiento) => ({
      insertOne: {
        document: movimiento.toObject({ depopulate: true }),
      },
    })),
  ];
  const operacionesSaldos = [...operacionesSaldosPorHash.values()];
  const resultadoSaldosVacio = { matchedCount: 0, upsertedCount: 0 };
  const [, resultadoSaldos, saldoCuenta] = await Promise.all([
    operacionesMovimientos.length > 0
      ? MovimientoImportado.bulkWrite(operacionesMovimientos, { ordered: false })
      : null,
    operacionesSaldos.length > 0
      ? SaldoCuenta.bulkWrite(operacionesSaldos, { ordered: false })
      : resultadoSaldosVacio,
    actualizarSaldoCuentaDesdeExcel({
      cuenta,
      saldoDetectado,
      archivoNombre: file.originalname,
    }),
  ]);

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
const claveMontoParaDuplicado = ({ montoBancario, montoReal }) => (
  esMontoDistintoDeCero(montoBancario)
    ? `b:${Number(montoBancario)}`
    : `r:${Number(montoReal)}`
);

const obtenerGastosParaBuscarDuplicados = async ({
  usuarioId,
  cuentaId,
  movimientos,
}) => {
  if (movimientos.length === 0) return [];

  const fechas = movimientos
    .map(({ movimiento }) => new Date(movimiento.fechaBanco).getTime())
    .filter(Number.isFinite);
  if (fechas.length === 0) return [];

  const fechaMinima = fechas.reduce((menor, fecha) => Math.min(menor, fecha));
  const fechaMaxima = fechas.reduce((mayor, fecha) => Math.max(mayor, fecha));
  const desde = new Date(fechaMinima);
  desde.setDate(desde.getDate() - 7);
  const hasta = new Date(fechaMaxima);
  hasta.setDate(hasta.getDate() + 7);
  const montosBancarios = [
    ...new Set(
      movimientos
        .map(({ movimiento }) => movimiento.montoBancario)
        .filter(esMontoDistintoDeCero)
        .map(Number),
    ),
  ];
  const montosReales = [
    ...new Set(
      movimientos
        .map(({ movimiento }) => movimiento)
        .filter(({ montoBancario }) => !esMontoDistintoDeCero(montoBancario))
        .map(({ montoReal }) => Number(montoReal)),
    ),
  ];
  const filtrosMonto = [];
  if (montosBancarios.length > 0) {
    filtrosMonto.push({ montoBancario: { $in: montosBancarios } });
  }
  if (montosReales.length > 0) {
    filtrosMonto.push({
      montoBancario: { $in: [0, null] },
      montoReal: { $in: montosReales },
    });
  }

  return Gasto.find({
    usuarioId,
    cuentaId,
    $or: filtrosMonto,
    fecha: {
      $gte: desde,
      $lte: hasta,
    },
  })
    .select("_id fecha detalle montoBancario montoReal estado")
    .lean();
};

const indexarGastosPorMonto = (gastos) => {
  const gastosPorMonto = new Map();

  gastos.forEach((gasto) => {
    const clave = claveMontoParaDuplicado(gasto);
    const gastosDelMonto = gastosPorMonto.get(clave) || [];
    gastosDelMonto.push(gasto);
    gastosPorMonto.set(clave, gastosDelMonto);
  });

  return gastosPorMonto;
};

const buscarPosiblesDuplicadosEnMemoria = ({
  fechaBanco,
  montoBancario,
  montoReal,
  detalleNormalizado,
  gastosPorMonto,
}) => {
  const fechaMovimiento = new Date(fechaBanco).getTime();
  const margenSieteDias = 7 * 24 * 60 * 60 * 1000;
  const candidatos = gastosPorMonto.get(
    claveMontoParaDuplicado({ montoBancario, montoReal }),
  ) || [];

  return candidatos.filter((gasto) => {
    if (Math.abs(new Date(gasto.fecha).getTime() - fechaMovimiento) > margenSieteDias) {
      return false;
    }
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
  }).select("_id gastoId").lean();

  if (movimientos.length === 0) return;

  const idsGastos = [...new Set(movimientos.map(({ gastoId }) => String(gastoId)))];
  const idsGastosExistentes = new Set(
    (await Gasto.find({
      _id: { $in: idsGastos },
      usuarioId,
    }).distinct("_id")).map(String),
  );
  const idsMovimientosSinGasto = movimientos
    .filter(({ gastoId }) => !idsGastosExistentes.has(String(gastoId)))
    .map(({ _id }) => _id);

  if (idsMovimientosSinGasto.length > 0) {
    await MovimientoImportado.updateMany(
      { _id: { $in: idsMovimientosSinGasto }, usuarioId, cuentaId },
      { $set: { estadoImportacion: "pendiente", gastoId: null } },
    );
  }
};

export const obtenerMovimientosImportadosService = async ({
  usuarioId,
  cuentaId,
  estadoImportacion,
}) => {
  const filtro = {
    usuarioId,
    cuentaId,
  };

  if (estadoImportacion) {
    filtro.estadoImportacion = estadoImportacion;
  }

  // La pantalla de importación sólo pide pendientes. En ese caso no hay
  // vínculos que validar ni documentos de gasto que poblar: alcanza una única
  // consulta liviana.
  if (estadoImportacion === "pendiente") {
    return MovimientoImportado.find(filtro)
      .sort({ fechaBanco: -1 })
      .lean();
  }

  await limpiarMovimientosVinculadosSinGasto({ usuarioId, cuentaId });

  const movimientos = await MovimientoImportado.find(filtro)
    .populate("gastoId")
    .sort({ fechaBanco: -1 })
    .lean();
  const movimientosDesvinculados = movimientos.filter((movimiento) => (
    movimiento.estadoImportacion === "vinculado" && !movimiento.gastoId
  ));

  if (movimientosDesvinculados.length > 0) {
    const ids = movimientosDesvinculados.map(({ _id }) => _id);
    await MovimientoImportado.updateMany(
      { _id: { $in: ids }, usuarioId, cuentaId },
      { $set: { estadoImportacion: "pendiente", gastoId: null } },
    );
    movimientosDesvinculados.forEach((movimiento) => {
      movimiento.estadoImportacion = "pendiente";
      movimiento.gastoId = null;
    });
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
  const [movimiento, subcategoria] = await Promise.all([
    MovimientoImportado.findOne({
      _id: id,
      usuarioId,
    }),
    data.subcategoriaId
      ? Subcategoria.findOne({
          _id: data.subcategoriaId,
          usuarioId,
        }).select("nombreSubcategoria")
      : null,
  ]);

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
      {
        // El movimiento ya fue encontrado dentro del usuario y contiene la
        // moneda de la cuenta de débito importada.
        cuentaPreCargada: {
          _id: movimiento.cuentaId,
          moneda: movimiento.moneda,
          monedas: [],
          tipoCuenta: "debito",
        },
        subcategoriaPreCargada: subcategoria,
        // Se ejecuta junto con el vínculo final para no sumar otra espera en
        // serie a esta acción.
        reconciliarPrestamos: false,
      },
    );
  } catch (error) {
    if (error?.code === 11000) {
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
      }
      const conflicto = new Error("El gasto de este movimiento bancario ya existe");
      conflicto.status = 409;
      throw conflicto;
    }
    throw error;
  }

  movimiento.gastoId = gasto._id;
  movimiento.estadoImportacion = "vinculado";

  await Promise.all([
    movimiento.save(),
    reconciliarPrestamosUsuarioSeguro(usuarioId),
  ]);

  return {
    movimiento,
    gasto,
  };
};
