import Gasto from "../0.1-models/gasto.model.js";
import cloudinary from "../config/cloudinary.config.js";

export const obtenerGastosService = async (usuarioId) => {
  const gastos = await Gasto.find({ usuarioId })
    .populate("subcategoriaId", "nombreSubcategoria")
    .populate("categoriaId", "nombreCategoria")
    .populate("cuentaId", "nombreCuenta");
  return gastos;
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
  delete gastoData.montoReal;
  delete gastoData.usuarioId;

  const datosCombinados = {
    ...gastoActual.toObject(),
    ...gastoData,
  };

  const estaCompleto = gastoEstaCompleto(datosCombinados);

  if (gastoActual.estado === "creado" && !estaCompleto) {
    throw new Error("No se puede guardar incompleto un gasto creado");
  }

  let nuevoEstado = gastoActual.estado;

  if (gastoActual.estado === "creado") {
    nuevoEstado = "creado";
  } else if (debeCrear) {
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
      montoReal: calcularMontoReal(datosCombinados),
    },
    { new: true }
  );

  return gastoActualizado;
};

export const crearGastoService = async (data, usuarioId) => {
  const gastoData = limpiarCamposVacios(data);

  delete gastoData.cambiarEstado;
  delete gastoData.estado;
  delete gastoData.montoReal;

  const estaCompleto = gastoEstaCompleto(gastoData);

  const gasto = await Gasto.create({
    ...gastoData,
    usuarioId,
    estado: estaCompleto ? "creado" : "pendiente",
    montoReal: calcularMontoReal(gastoData),
  });

  return gasto;
};

export const eliminarGastoService = async (usuarioId, id) => {
  const gastoEliminado = await Gasto.findOneAndDelete({ _id: id, usuarioId });
  return gastoEliminado;
};

export const eliminarTodosLosGastosService = async (usuarioId) => {
  const gastosEliminados = await Gasto.deleteMany({ usuarioId });
  return gastosEliminados;
};

export const subirFacturaGastoService = async (id, usuarioId, file) => {
  if (!file) {
    throw new Error("No se recibió ningún archivo");
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

  return limpio;
};

const gastoEstaCompleto = (gasto) => {
  return (
    gasto.detalle &&
    gasto.cuentaId &&
    gasto.fecha &&
    gasto.montoBancario !== null &&
    gasto.montoBancario !== undefined &&
    gasto.porcentaje !== null &&
    gasto.porcentaje !== undefined &&
    gasto.categoriaId &&
    gasto.subcategoriaId
  );
};

const calcularMontoReal = (gasto) => {
  if (!gastoEstaCompleto(gasto) || !gasto.incluirMontoReal) {
    return 0;
  }

  return gasto.montoBancario * (gasto.porcentaje / 100);
};
