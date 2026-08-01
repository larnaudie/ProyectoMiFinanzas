import Gasto from "../0.1-models/gasto.model.js";
import MovimientoImportado from "../0.1-models/movimientoImportado.model.js";
import Cuenta from "../0.1-models/cuenta.model.js";
import Subcategoria from "../0.1-models/subcategoria.model.js";
import cloudinary from "../config/cloudinary.config.js";
import { normalizarMontoBancarioTarjeta } from "../utils/resumenTarjetaTotales.js";
import { normalizarMontoContraparte } from "../utils/vinculosGasto.js";
import {
  calcularMontoRealGasto,
  gastoTieneMontosCompletos,
  redondearMonto,
} from "../utils/montosGasto.js";
import {
  normalizarMoneda,
  obtenerMonedaMovimiento,
} from "../utils/monedas.js";
import { aplicarPoliticaImpactoEconomico } from "../utils/politicaImpactoEconomico.js";
import {
  aplicarPoliticaCuentaCredito,
} from "../utils/politicaCuentaCredito.js";

const presentarGasto = (gasto) => {
  if (!gasto) return gasto;

  const datos = gasto.toObject ? gasto.toObject() : { ...gasto };
  const cuenta = datos.cuentaId && typeof datos.cuentaId === "object"
    ? datos.cuentaId
    : null;

  const presentado = {
    ...datos,
    moneda: obtenerMonedaMovimiento(cuenta, datos.moneda),
  };

  return aplicarPoliticaCuentaCredito(presentado, cuenta);
};

export const obtenerGastosService = async (usuarioId, filtros = {}) => {
  const consulta = { usuarioId };
  if (filtros.cuentaId) consulta.cuentaId = filtros.cuentaId;
  if (filtros.estado) consulta.estado = filtros.estado;
  if (filtros.tarjetaId) consulta.tarjetaId = filtros.tarjetaId;
  if (filtros.resumenTarjetaId) consulta.resumenTarjetaId = filtros.resumenTarjetaId;

  const gastos = await Gasto.find(consulta)
    .populate("subcategoriaId", "nombreSubcategoria")
    .populate("categoriaId", "nombreCategoria")
    .populate("cuentaId", "nombreCuenta moneda tipoCuenta monedas")
    .populate({
      path: "origen.referenciaId",
      select: "detalle cuentaId fecha montoBancario moneda",
      populate: { path: "cuentaId", select: "nombreCuenta" },
    });
  return gastos.map(presentarGasto);
};

export const obtenerGastoPorIdService = async (id, usuarioId) => {
  const gasto = await Gasto.findOne({ _id: id, usuarioId })
    .populate("subcategoriaId", "nombreSubcategoria")
    .populate("categoriaId", "nombreCategoria")
    .populate("cuentaId", "nombreCuenta moneda tipoCuenta monedas")
    .populate("tarjetaId", "nombreTarjeta ultimosDigitos")
    .populate("resumenTarjetaId")
    .populate({
      path: "origen.referenciaId",
      select: "detalle cuentaId fecha montoBancario",
      populate: { path: "cuentaId", select: "nombreCuenta" },
    });

  if (!gasto) {
    const error = new Error("Gasto no encontrado");
    error.status = 404;
    throw error;
  }
  return presentarGasto(gasto);
};

export const actualizarGastoService = async (id, usuarioId, data) => {
  const gastoActual = await Gasto.findOne({ _id: id, usuarioId });

  if (!gastoActual) {
    throw new Error("Gasto no encontrado");
  }

  const gastoData = limpiarCamposVacios(data);

  const debeCrear = gastoData.cambiarEstado === true;

  delete gastoData.cambiarEstado;
  delete gastoData.estado;
  delete gastoData.usuarioId;

  const datosCombinados = {
    ...gastoActual.toObject(),
    ...gastoData,
    origen: {
      ...gastoActual.origen?.toObject?.(),
      ...gastoData.origen,
    },
  };

  normalizarSignoGastoTarjeta(datosCombinados);
  normalizarMontosGasto(datosCombinados);
  await aplicarPoliticaSubcategoria(datosCombinados, usuarioId);
  const cuentaGasto = await Cuenta.findOne({
    _id: gastoData.cuentaId || gastoActual.cuentaId,
    usuarioId,
  }).select("tipoCuenta");
  Object.assign(
    datosCombinados,
    aplicarPoliticaCuentaCredito(datosCombinados, cuentaGasto),
  );
  if (datosCombinados.origen?.tipo === "tarjeta") {
    gastoData.montoBancario = datosCombinados.montoBancario;
  }
  gastoData.incluirMontoReal = datosCombinados.incluirMontoReal;
  gastoData.porcentaje = datosCombinados.porcentaje;

  await validarReferenciaOrigen(
    datosCombinados,
    usuarioId,
    gastoActual.cuentaId,
    gastoActual._id,
  );

  const estaCompleto = gastoEstaCompleto(datosCombinados);

  if (gastoActual.estado === "creado" && !estaCompleto) {
    throw new Error("No se puede guardar incompleto un gasto creado");
  }

  let nuevoEstado = gastoActual.estado;

  if (gastoActual.estado === "creado") {
    nuevoEstado = "creado";
  } else if (debeCrear) {
    if (!datosCombinados.subcategoriaId) {
      const error = new Error(
        "Selecciona una subcategoría antes de pasar el gasto a creado",
      );
      error.status = 400;
      throw error;
    }

    if (!estaCompleto) {
      throw new Error("No se puede crear un gasto incompleto");
    }

    nuevoEstado = "creado";
  } else {
    nuevoEstado = "pendiente";
  }

  const gastoActualizado = await Gasto.findOneAndUpdate(
    { _id: id, usuarioId },
    {
      ...gastoData,
      estado: nuevoEstado,
      montoBancario: datosCombinados.montoBancario,
      montoReal: calcularMontoRealGasto(datosCombinados),
    },
    { new: true }
  )
    .populate("subcategoriaId", "nombreSubcategoria")
    .populate("categoriaId", "nombreCategoria")
    .populate("cuentaId", "nombreCuenta moneda tipoCuenta monedas")
    .populate({
      path: "origen.referenciaId",
      select: "detalle cuentaId fecha montoBancario moneda",
      populate: { path: "cuentaId", select: "nombreCuenta" },
    });

  return presentarGasto(gastoActualizado);
};

export const crearGastoService = async (data, usuarioId) => {
  const gastoData = limpiarCamposVacios(data);
  let cuentaGasto = null;

  if (gastoData.cuentaId) {
    cuentaGasto = await Cuenta.findOne({
      _id: gastoData.cuentaId,
      usuarioId,
    }).select("moneda tipoCuenta monedas");

    if (cuentaGasto) {
      gastoData.moneda = obtenerMonedaMovimiento(
        cuentaGasto,
        gastoData.moneda,
      );
    }
  }

  normalizarSignoGastoTarjeta(gastoData);
  normalizarMontosGasto(gastoData);
  await aplicarPoliticaSubcategoria(gastoData, usuarioId);
  Object.assign(
    gastoData,
    aplicarPoliticaCuentaCredito(gastoData, cuentaGasto),
  );

  await validarReferenciaOrigen(gastoData, usuarioId);
  await validarDuplicadoTarjeta(gastoData, usuarioId);

  const debeCrear = gastoData.cambiarEstado === true;

  delete gastoData.cambiarEstado;
  delete gastoData.estado;

  const estaCompleto = gastoEstaCompleto(gastoData);

  if (debeCrear && !gastoData.subcategoriaId) {
    const error = new Error(
      "Selecciona una subcategoría antes de pasar el gasto a creado",
    );
    error.status = 400;
    throw error;
  }

  if (debeCrear && !estaCompleto) {
    throw new Error("No se puede crear un gasto incompleto");
  }

  const gasto = await Gasto.create({
    ...gastoData,
    usuarioId,
    estado: debeCrear ? "creado" : "pendiente",
    montoReal: calcularMontoRealGasto(gastoData),
  });

  return gasto;
};

export const crearGastoYVincularService = async ({
  gastoOrigenId,
  usuarioId,
  data,
}) => {
  const gastoOrigen = await Gasto.findOne({ _id: gastoOrigenId, usuarioId });
  if (!gastoOrigen) {
    const error = new Error("Movimiento no encontrado");
    error.status = 404;
    throw error;
  }

  const esMovimientoTarjeta = gastoOrigen.origen?.tipo === "tarjeta";
  if (esMovimientoTarjeta && gastoOrigen.tipoMovimiento !== "pago") {
    const error = new Error("Sólo un movimiento de tarjeta de tipo Pago puede vincularse");
    error.status = 409;
    throw error;
  }

  const gastoYaVinculado = gastoOrigen.origen?.referenciaId
    ? await Gasto.exists({
      _id: gastoOrigen.origen.referenciaId,
      usuarioId,
    })
    : null;

  if (gastoYaVinculado) {
    const error = new Error("Este movimiento ya tiene otro movimiento vinculado");
    error.status = 409;
    throw error;
  }

  const cuentaDestino = await Cuenta.findOne({
    _id: data.cuentaId,
    usuarioId,
  }).select("nombreCuenta moneda");
  if (!cuentaDestino) {
    const error = new Error("La cuenta seleccionada no existe");
    error.status = 404;
    throw error;
  }

  if (String(cuentaDestino._id) === String(gastoOrigen.cuentaId)) {
    const error = new Error("El movimiento vinculado debe pertenecer a otra cuenta");
    error.status = 409;
    throw error;
  }

  const montoBancario = normalizarMontoContraparte(
    gastoOrigen.montoBancario,
    data.montoBancario,
  );
  if (!Number.isFinite(montoBancario) || montoBancario === 0) {
    const error = new Error("El monto bancario debe ser distinto de 0");
    error.status = 400;
    throw error;
  }

  let gastoCreado;
  try {
    gastoCreado = await crearGastoService(
      {
        detalle: data.detalle,
        cuentaId: cuentaDestino._id,
        fecha: data.fecha,
        montoBancario,
        porcentaje: 0,
        incluirMontoReal: false,
        moneda: normalizarMoneda(cuentaDestino.moneda),
        categoriaId: data.categoriaId,
        subcategoriaId: data.subcategoriaId,
        cambiarEstado: Boolean(data.subcategoriaId),
        tipoMovimiento: "manual",
        origen: { tipo: "manual", referenciaId: null },
      },
      usuarioId,
    );

    const gastoOrigenActualizado = await actualizarGastoService(
      gastoOrigen._id,
      usuarioId,
      {
        tipoMovimiento: gastoOrigen.tipoMovimiento,
        origen: {
          tipo: gastoOrigen.origen?.tipo || "manual",
          referenciaId: gastoCreado._id,
        },
      },
    );

    return { gastoOrigen: gastoOrigenActualizado, gastoCreado };
  } catch (error) {
    if (gastoCreado?._id) {
      await Gasto.deleteOne({ _id: gastoCreado._id, usuarioId });
    }
    throw error;
  }
};

export const crearGastoYVincularPagoService = async ({
  gastoPagoId,
  usuarioId,
  data,
}) => {
  const resultado = await crearGastoYVincularService({
    gastoOrigenId: gastoPagoId,
    usuarioId,
    data,
  });

  return {
    gastoPago: resultado.gastoOrigen,
    gastoCreado: resultado.gastoCreado,
  };
};

export const eliminarGastoService = async (usuarioId, id) => {
  const gastoEliminado = await Gasto.findOneAndDelete({ _id: id, usuarioId });

  if (gastoEliminado) {
    await Promise.all([
      MovimientoImportado.updateMany(
        { usuarioId, gastoId: id },
        { estadoImportacion: "pendiente", gastoId: null },
      ),
      Gasto.updateMany(
        { usuarioId, "origen.referenciaId": id },
        { $set: { "origen.referenciaId": null } },
      ),
    ]);
  }

  return gastoEliminado;
};

export const eliminarTodosLosGastosService = async (usuarioId) => {
  const gastos = await Gasto.find({ usuarioId }).select("_id");
  const gastoIds = gastos.map((gasto) => gasto._id);

  const gastosEliminados = await Gasto.deleteMany({ usuarioId });

  if (gastoIds.length > 0) {
    await MovimientoImportado.updateMany(
      { usuarioId, gastoId: { $in: gastoIds } },
      { estadoImportacion: "pendiente", gastoId: null }
    );
  }

  return gastosEliminados;
};

export const subirFacturaGastoService = async (id, usuarioId, file) => {
  if (!file) {
    throw new Error("No se recibiÃƒÆ’Ã‚Â³ ningÃƒÆ’Ã‚Âºn archivo");
  }

  const gasto = await Gasto.findOne({ _id: id, usuarioId });

  if (!gasto) {
    throw new Error("Gasto no encontrado");
  }

  const resultado = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "mi-finanzas/facturas",
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    stream.end(file.buffer);
  });

  gasto.factura = {
    url: resultado.secure_url,
    publicId: resultado.public_id,
  };

  await gasto.save();

  return gasto;
};


// - - - Helpers - - - 

const limpiarCamposVacios = (data) => {
  const limpio = { ...data };

  Object.keys(limpio).forEach((key) => {
    if (limpio[key] === "") {
      limpio[key] = null;
    }
  });

  if (limpio.origen) {
    limpio.origen = { ...limpio.origen };
    if (limpio.origen.referenciaId === "") limpio.origen.referenciaId = null;
  }

  return limpio;
};

const gastoEstaCompleto = (gasto) => {
  return (
    gasto.detalle &&
    gasto.cuentaId &&
    gasto.fecha &&
    gastoTieneMontosCompletos(gasto) &&
    gasto.subcategoriaId
  );
};
const normalizarMontosGasto = (gastoData) => {
  gastoData.montoBancario = redondearMonto(gastoData.montoBancario);
  gastoData.montoReal = redondearMonto(gastoData.montoReal);
};

const aplicarPoliticaSubcategoria = async (gastoData, usuarioId) => {
  if (
    !gastoData.subcategoriaId
    || gastoData?.origen?.tipo === "tarjeta"
  ) {
    return;
  }

  const subcategoriaId = typeof gastoData.subcategoriaId === "object"
    ? gastoData.subcategoriaId._id
    : gastoData.subcategoriaId;
  const subcategoria = await Subcategoria.findOne({
    _id: subcategoriaId,
    usuarioId,
  }).select("nombreSubcategoria");

  if (!subcategoria) {
    return;
  }

  Object.assign(
    gastoData,
    aplicarPoliticaImpactoEconomico(
      gastoData,
      subcategoria.nombreSubcategoria,
    ),
  );
};

const normalizarSignoGastoTarjeta = (gastoData) => {
  if (
    gastoData?.origen?.tipo !== "tarjeta"
    || gastoData.montoBancario === null
    || gastoData.montoBancario === undefined
  ) {
    return;
  }

  gastoData.montoBancario = normalizarMontoBancarioTarjeta(
    gastoData.montoBancario,
    gastoData.tipoMovimiento,
  );
};

const validarDuplicadoTarjeta = async (gastoData, usuarioId) => {
  const esImportacionTarjeta = gastoData?.origen?.tipo === "tarjeta";
  const importacionKey = gastoData?.resumenTarjeta?.importacionKey;

  if (!esImportacionTarjeta || !importacionKey) {
    return;
  }

  const existente = await Gasto.findOne({
    usuarioId,
    cuentaId: gastoData.cuentaId,
    fecha: new Date(gastoData.fecha),
    detalle: String(gastoData.detalle || "").trim(),
    montoBancario: Number(gastoData.montoBancario),
    tipoMovimiento: gastoData.tipoMovimiento || "compra",
    "origen.tipo": "tarjeta",
    "resumenTarjeta.importacionKey": importacionKey,
  }).select("_id");

  if (existente) {
    const error = new Error("Este movimiento de tarjeta ya fue creado en este resumen");
    error.status = 409;
    throw error;
  }
};

const validarReferenciaOrigen = async (
  gastoData,
  usuarioId,
  cuentaActualId = null,
  gastoActualId = null,
) => {
  const referenciaId = gastoData?.origen?.referenciaId;
  if (!referenciaId) return;

  if (gastoData?.origen?.tipo === "tarjeta" && gastoData.tipoMovimiento !== "pago") {
    const error = new Error("Sólo los movimientos de tipo Pago pueden vincularse");
    error.status = 409;
    throw error;
  }

  const referencia = await Gasto.findOne({ _id: referenciaId, usuarioId })
    .select("cuentaId origen.referenciaId");
  if (!referencia) {
    if (gastoData?.origen?.tipo === "excel") {
      return;
    }

    const error = new Error("El movimiento vinculado no existe");
    error.status = 404;
    throw error;
  }

  const cuentaId = gastoData.cuentaId || cuentaActualId;
  if (cuentaId && String(referencia.cuentaId) === String(cuentaId)) {
    const error = new Error("El gasto debe vincularse con un movimiento de otra cuenta");
    error.status = 409;
    throw error;
  }

  if (referencia.origen?.referenciaId) {
    const error = new Error("El movimiento seleccionado ya forma parte de otro vínculo");
    error.status = 409;
    throw error;
  }

  const consultaVinculoExistente = {
    usuarioId,
    "origen.referenciaId": referenciaId,
  };
  if (gastoActualId) {
    consultaVinculoExistente._id = { $ne: gastoActualId };
  }

  const vinculoExistente = await Gasto.exists(consultaVinculoExistente);
  if (vinculoExistente) {
    const error = new Error("El movimiento seleccionado ya está vinculado");
    error.status = 409;
    throw error;
  }

  if (gastoActualId) {
    const esDestinoDeOtroVinculo = await Gasto.exists({
      usuarioId,
      "origen.referenciaId": gastoActualId,
    });
    if (esDestinoDeOtroVinculo) {
      const error = new Error("Este movimiento ya forma parte de otro vínculo");
      error.status = 409;
      throw error;
    }
  }
};

