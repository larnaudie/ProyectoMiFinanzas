import mongoose from "mongoose";
import ControlPagoMensual from "../0.1-models/controlPagoMensual.model.js";
import Gasto from "../0.1-models/gasto.model.js";
import Subcategoria from "../0.1-models/subcategoria.model.js";
import {
  crearCoincidencia,
  evaluarControlesMensuales,
  limitesPeriodoControl,
  normalizarMesesActivos,
  sugerirSubcategoriasHabituales,
} from "../utils/controlPagosMensuales.js";

const errorConEstado = (mensaje, status) => {
  const error = new Error(mensaje);
  error.status = status;
  return error;
};

const validarMesesActivos = (valor) => {
  if (valor === undefined) return normalizarMesesActivos(valor);
  if (!Array.isArray(valor)) {
    throw errorConEstado("Seleccioná los meses en los que corresponde el pago", 400);
  }
  const meses = [...new Set(valor.map(Number))]
    .filter((mes) => Number.isInteger(mes) && mes >= 1 && mes <= 12)
    .sort((a, b) => a - b);
  if (!meses.length || meses.length !== new Set(valor.map(Number)).size) {
    throw errorConEstado("Seleccioná al menos un mes válido", 400);
  }
  return meses;
};

const coincidePeriodo = (item, periodo) => (
  Number(item?.anio) === periodo.anio && Number(item?.mes) === periodo.mes
);

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
  const [controles, gastosPeriodo, subcategorias] = await Promise.all([
    obtenerControles(usuarioId),
    obtenerGastosDelPeriodo(usuarioId, periodo.inicio, periodo.fin),
    obtenerSubcategorias(usuarioId),
  ]);
  const gastosAsignadosIds = controles.flatMap((control) => (
    (control.pagosAsignados || [])
      .filter((item) => coincidePeriodo(item, periodo))
      .map((item) => item.gastoId)
  ));
  const gastosAsignados = gastosAsignadosIds.length
    ? await Gasto.find({
      _id: { $in: gastosAsignadosIds },
      usuarioId,
    })
      .select(
        "detalle fecha montoBancario montoReal incluirMontoReal moneda estado cuentaId subcategoriaId",
      )
      .populate("cuentaId", "nombreCuenta moneda monedas tipoCuenta")
      .lean()
    : [];
  const gastosUnicos = new Map(
    [...gastosPeriodo, ...gastosAsignados].map((gasto) => [String(gasto._id), gasto]),
  );
  const resultado = evaluarControlesMensuales({
    controles,
    gastos: [...gastosUnicos.values()],
    periodo,
  });

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
    soloConsulta: false,
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
  const mesesActivos = validarMesesActivos(datos.mesesActivos);

  try {
    return await ControlPagoMensual.create({
      usuarioId,
      nombre: nombre.slice(0, 80),
      subcategoriaId,
      mesesActivos,
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
  const mesesActivos = datos.mesesActivos === undefined
    ? normalizarMesesActivos(control.mesesActivos)
    : validarMesesActivos(datos.mesesActivos);

  try {
    return await ControlPagoMensual.findOneAndUpdate(
      { _id: controlId, usuarioId },
      {
        $set: {
          nombre: nombre.slice(0, 80),
          subcategoriaId,
          mesesActivos,
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

export const obtenerCandidatosPagoService = async (
  usuarioId,
  controlId,
  filtros = {},
) => {
  if (!mongoose.isValidObjectId(controlId)) {
    throw errorConEstado("Control mensual inválido", 400);
  }
  const periodo = limitesPeriodoControl(filtros);
  const control = await ControlPagoMensual.findOne({
    _id: controlId,
    usuarioId,
  }).lean();
  if (!control) throw errorConEstado("Control mensual no encontrado", 404);

  const [gastos, controlesConAsignaciones] = await Promise.all([
    Gasto.find({
      usuarioId,
      subcategoriaId: control.subcategoriaId,
      estado: "creado",
    })
      .select(
        "detalle fecha montoBancario montoReal incluirMontoReal moneda estado cuentaId subcategoriaId",
      )
      .populate("cuentaId", "nombreCuenta moneda monedas tipoCuenta")
      .sort({ fecha: -1, _id: -1 })
      .limit(150)
      .lean(),
    ControlPagoMensual.find({
      usuarioId,
      "pagosAsignados.0": { $exists: true },
    }).select("pagosAsignados").lean(),
  ]);

  const gastosUsados = new Set();
  controlesConAsignaciones.forEach((controlConAsignaciones) => {
    (controlConAsignaciones.pagosAsignados || []).forEach((asignacion) => {
      const esAsignacionActual = String(controlConAsignaciones._id) === String(controlId)
        && coincidePeriodo(asignacion, periodo);
      if (!esAsignacionActual) gastosUsados.add(String(asignacion.gastoId));
    });
  });

  return gastos
    .filter((gasto) => !gastosUsados.has(String(gasto._id)))
    .slice(0, 100)
    .map((gasto) => crearCoincidencia(gasto));
};

export const asignarPagoAPeriodoService = async (
  usuarioId,
  controlId,
  datos = {},
) => {
  if (!mongoose.isValidObjectId(controlId)) {
    throw errorConEstado("Control mensual inválido", 400);
  }
  const gastoId = String(datos.gastoId || "");
  if (!mongoose.isValidObjectId(gastoId)) {
    throw errorConEstado("Seleccioná un movimiento válido", 400);
  }
  const periodo = limitesPeriodoControl(datos);
  const [control, gasto, controlesConUso] = await Promise.all([
    ControlPagoMensual.findOne({ _id: controlId, usuarioId }),
    Gasto.findOne({ _id: gastoId, usuarioId, estado: "creado" }).lean(),
    ControlPagoMensual.find({
      usuarioId,
      "pagosAsignados.gastoId": gastoId,
    }).select("pagosAsignados").lean(),
  ]);
  if (!control) throw errorConEstado("Control mensual no encontrado", 404);
  if (!gasto) throw errorConEstado("Movimiento de pago no encontrado", 404);
  if (String(gasto.subcategoriaId || "") !== String(control.subcategoriaId)) {
    throw errorConEstado("El movimiento no pertenece a la subcategoría del pago", 409);
  }

  const mesesActivos = normalizarMesesActivos(control.mesesActivos);
  const tieneExcepcion = (control.excepciones || []).some((item) => (
    coincidePeriodo(item, periodo)
  ));
  if (!mesesActivos.includes(periodo.mes) || tieneExcepcion) {
    throw errorConEstado("Este pago no se controla en el período seleccionado", 409);
  }

  const usadoEnOtroPeriodo = controlesConUso.some((controlConUso) => (
    (controlConUso.pagosAsignados || []).some((asignacion) => (
      String(asignacion.gastoId) === gastoId
      && (
        String(controlConUso._id) !== String(controlId)
        || !coincidePeriodo(asignacion, periodo)
      )
    ))
  ));
  if (usadoEnOtroPeriodo) {
    throw errorConEstado("Ese movimiento ya fue asignado a otro período", 409);
  }

  control.pagosAsignados = (control.pagosAsignados || [])
    .filter((item) => !coincidePeriodo(item, periodo));
  control.pagosAsignados.push({
    anio: periodo.anio,
    mes: periodo.mes,
    gastoId,
    asignadoEn: new Date(),
  });
  await control.save();
  return control;
};

export const quitarPagoAsignadoService = async (
  usuarioId,
  controlId,
  filtros = {},
) => {
  if (!mongoose.isValidObjectId(controlId)) {
    throw errorConEstado("Control mensual inválido", 400);
  }
  const periodo = limitesPeriodoControl(filtros);
  const control = await ControlPagoMensual.findOne({
    _id: controlId,
    usuarioId,
  });
  if (!control) throw errorConEstado("Control mensual no encontrado", 404);
  control.pagosAsignados = (control.pagosAsignados || [])
    .filter((item) => !coincidePeriodo(item, periodo));
  await control.save();
  return control;
};

export const actualizarExcepcionPeriodoService = async (
  usuarioId,
  controlId,
  datos = {},
) => {
  if (!mongoose.isValidObjectId(controlId)) {
    throw errorConEstado("Control mensual inválido", 400);
  }
  const periodo = limitesPeriodoControl(datos);
  const control = await ControlPagoMensual.findOne({
    _id: controlId,
    usuarioId,
  });
  if (!control) throw errorConEstado("Control mensual no encontrado", 404);

  control.excepciones = (control.excepciones || [])
    .filter((item) => !coincidePeriodo(item, periodo));
  if (datos.omitido === true) {
    control.excepciones.push({
      anio: periodo.anio,
      mes: periodo.mes,
      creadoEn: new Date(),
    });
  }
  await control.save();
  return control;
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
