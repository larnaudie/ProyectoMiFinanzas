import mongoose from "mongoose";
import ControlPagoMensual from "../0.1-models/controlPagoMensual.model.js";
import Gasto from "../0.1-models/gasto.model.js";
import Subcategoria from "../0.1-models/subcategoria.model.js";
import {
  evaluarControlesMensuales,
  limitesPeriodoControl,
  sugerirSubcategoriasHabituales,
} from "../utils/controlPagosMensuales.js";

const errorConEstado = (mensaje, status) => {
  const error = new Error(mensaje);
  error.status = status;
  return error;
};

const obtenerControles = (usuarioId) => ControlPagoMensual.find({ usuarioId })
  .populate("subcategoriaId", "nombreSubcategoria")
  .sort({ nombre: 1 })
  .lean();

const obtenerGastosDelPeriodo = (usuarioId, inicio, fin) => Gasto.find({
  usuarioId,
  fecha: { $gte: inicio, $lt: fin },
})
  .select(
    "detalle fecha montoBancario montoReal incluirMontoReal moneda estado cuentaId subcategoriaId",
  )
  .populate("cuentaId", "nombreCuenta moneda monedas tipoCuenta")
  .lean();

const obtenerSubcategorias = (usuarioId) => Subcategoria.find({ usuarioId })
  .select("nombreSubcategoria")
  .sort({ nombreSubcategoria: 1 })
  .lean();

export const obtenerAnalisisService = async (usuarioId, filtros = {}) => {
  const periodo = limitesPeriodoControl(filtros);
  const [controles, gastos, subcategorias] = await Promise.all([
    obtenerControles(usuarioId),
    obtenerGastosDelPeriodo(usuarioId, periodo.inicio, periodo.fin),
    obtenerSubcategorias(usuarioId),
  ]);
  const resultado = evaluarControlesMensuales({ controles, gastos });

  return {
    periodo: {
      anio: periodo.anio,
      mes: periodo.mes,
      inicio: periodo.inicio,
      fin: periodo.fin,
    },
    ...resultado,
    subcategoriasDisponibles: subcategorias.map((subcategoria) => ({
      _id: String(subcategoria._id),
      nombreSubcategoria: subcategoria.nombreSubcategoria,
    })),
    sugerencias: sugerirSubcategoriasHabituales({ subcategorias, controles }),
    soloConsulta: true,
  };
};

export const crearControlPagoService = async (usuarioId, datos = {}) => {
  const subcategoriaId = String(datos.subcategoriaId || "");
  if (!mongoose.isValidObjectId(subcategoriaId)) {
    throw errorConEstado("Seleccioná una subcategoría válida", 400);
  }

  const subcategoria = await Subcategoria.findOne({
    _id: subcategoriaId,
    usuarioId,
  }).lean();
  if (!subcategoria) {
    throw errorConEstado("La subcategoría no pertenece al usuario", 404);
  }

  const nombre = String(datos.nombre || subcategoria.nombreSubcategoria).trim();
  if (!nombre) throw errorConEstado("Ingresá un nombre para el control", 400);

  try {
    return await ControlPagoMensual.create({
      usuarioId,
      nombre: nombre.slice(0, 80),
      subcategoriaId,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw errorConEstado("Ese pago mensual ya está configurado", 409);
    }
    throw error;
  }
};

export const crearControlesPagoService = async (
  usuarioId,
  subcategoriaIds = [],
) => {
  const ids = [...new Set(subcategoriaIds.map(String))]
    .filter((id) => mongoose.isValidObjectId(id))
    .slice(0, 50);
  if (!ids.length) {
    throw errorConEstado("Seleccioná al menos una subcategoría", 400);
  }

  const subcategorias = await Subcategoria.find({
    _id: { $in: ids },
    usuarioId,
  }).select("nombreSubcategoria").lean();
  if (!subcategorias.length) {
    throw errorConEstado("No se encontraron subcategorías válidas", 404);
  }

  await ControlPagoMensual.bulkWrite(
    subcategorias.map((subcategoria) => ({
      updateOne: {
        filter: { usuarioId, subcategoriaId: subcategoria._id },
        update: {
          $setOnInsert: {
            nombre: subcategoria.nombreSubcategoria,
            usuarioId,
            subcategoriaId: subcategoria._id,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  return obtenerControles(usuarioId);
};

export const actualizarControlPagoService = async (
  usuarioId,
  controlId,
  datos = {},
) => {
  if (!mongoose.isValidObjectId(controlId)) {
    throw errorConEstado("Control mensual inválido", 400);
  }

  const subcategoriaId = String(datos.subcategoriaId || "");
  if (!mongoose.isValidObjectId(subcategoriaId)) {
    throw errorConEstado("Seleccioná una subcategoría válida", 400);
  }

  const [control, subcategoria] = await Promise.all([
    ControlPagoMensual.findOne({ _id: controlId, usuarioId }).lean(),
    Subcategoria.findOne({ _id: subcategoriaId, usuarioId }).lean(),
  ]);
  if (!control) throw errorConEstado("Control mensual no encontrado", 404);
  if (!subcategoria) {
    throw errorConEstado("La subcategoría no pertenece al usuario", 404);
  }

  const nombre = String(datos.nombre || subcategoria.nombreSubcategoria).trim();
  if (!nombre) throw errorConEstado("Ingresá un nombre para el control", 400);

  try {
    return await ControlPagoMensual.findOneAndUpdate(
      { _id: controlId, usuarioId },
      {
        $set: {
          nombre: nombre.slice(0, 80),
          subcategoriaId,
        },
      },
      { new: true, runValidators: true },
    )
      .populate("subcategoriaId", "nombreSubcategoria")
      .lean();
  } catch (error) {
    if (error?.code === 11000) {
      throw errorConEstado("Ese pago mensual ya está configurado", 409);
    }
    throw error;
  }
};

export const eliminarControlPagoService = async (usuarioId, controlId) => {
  if (!mongoose.isValidObjectId(controlId)) {
    throw errorConEstado("Control mensual inválido", 400);
  }
  const control = await ControlPagoMensual.findOneAndDelete({
    _id: controlId,
    usuarioId,
  }).lean();
  if (!control) throw errorConEstado("Control mensual no encontrado", 404);
  return control;
};
