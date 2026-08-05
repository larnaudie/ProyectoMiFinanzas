import Prestamo from "../0.1-models/prestamo.model.js";
import Gasto from "../0.1-models/gasto.model.js";
import Cuenta from "../0.1-models/cuenta.model.js";
import Subcategoria from "../0.1-models/subcategoria.model.js";
import {
  calcularCuotaFrancesa,
  calcularResumenPrestamo,
} from "../utils/prestamos.js";
import {
  desvincularGastoPrestamo,
  reconciliarPrestamo,
  reconciliarPrestamosUsuario,
} from "./conciliacionPrestamo.service.js";

const poblarPrestamo = (consulta) => consulta
  .populate("reglaDeteccion.cuentaId", "nombreCuenta moneda")
  .populate("reglaDeteccion.subcategoriaId", "nombreSubcategoria")
  .populate({
    path: "pagos.gastoId",
    select: "detalle fecha montoBancario montoReal moneda cuentaId",
    populate: { path: "cuentaId", select: "nombreCuenta moneda" },
  });

const presentarPrestamo = (prestamo) => {
  const datos = prestamo.toObject ? prestamo.toObject() : { ...prestamo };
  return { ...datos, resumen: calcularResumenPrestamo(datos) };
};

const limpiar = (data) => {
  const limpio = structuredClone(data || {});
  const nulos = (objeto) => {
    Object.entries(objeto || {}).forEach(([clave, valor]) => {
      if (valor === "") objeto[clave] = null;
      else if (valor && typeof valor === "object" && !Array.isArray(valor)) nulos(valor);
    });
  };
  nulos(limpio);
  return limpio;
};

const validarCatalogos = async (usuarioId, regla = {}) => {
  if (regla.cuentaId) {
    const cuenta = await Cuenta.exists({ _id: regla.cuentaId, usuarioId });
    if (!cuenta) {
      const error = new Error("La cuenta elegida no existe");
      error.status = 404;
      throw error;
    }
  }
  if (regla.subcategoriaId) {
    const subcategoria = await Subcategoria.exists({
      _id: regla.subcategoriaId,
      usuarioId,
    });
    if (!subcategoria) {
      const error = new Error("La subcategoría elegida no existe");
      error.status = 404;
      throw error;
    }
  }
};

export const obtenerPrestamosService = async (usuarioId) => {
  await reconciliarPrestamosUsuario(usuarioId);
  const prestamos = await poblarPrestamo(
    Prestamo.find({ usuarioId }).sort({ estado: 1, createdAt: -1 }),
  );
  return prestamos.map(presentarPrestamo);
};

export const obtenerPrestamoPorIdService = async (usuarioId, id) => {
  const prestamoBase = await Prestamo.findOne({ _id: id, usuarioId });
  if (!prestamoBase) {
    const error = new Error("Préstamo no encontrado");
    error.status = 404;
    throw error;
  }
  await reconciliarPrestamo(prestamoBase);
  const prestamo = await poblarPrestamo(Prestamo.findById(id));
  return presentarPrestamo(prestamo);
};

export const crearPrestamoService = async (usuarioId, data) => {
  const limpio = limpiar(data);
  await validarCatalogos(usuarioId, limpio.reglaDeteccion);
  const existente = await Prestamo.exists({ usuarioId, nombre: limpio.nombre });
  if (existente) {
    const error = new Error("Ya existe un pr\u00e9stamo con ese nombre");
    error.status = 409;
    throw error;
  }
  if (!limpio.cuotaTeorica) {
    limpio.cuotaTeorica = calcularCuotaFrancesa({
      capital: limpio.capitalFinanciado,
      tea: limpio.tea,
      plazoCuotas: limpio.plazoCuotas,
    });
  }
  let prestamo;
  try {
    prestamo = await Prestamo.create({ ...limpio, usuarioId });
  } catch (error) {
    if (error?.code === 11000) {
      error.status = 409;
      error.message = "Ya existe un pr\u00e9stamo con ese nombre";
    }
    throw error;
  }
  await reconciliarPrestamo(prestamo);
  return obtenerPrestamoPorIdService(usuarioId, prestamo._id);
};

export const actualizarPrestamoService = async (usuarioId, id, data) => {
  const limpio = limpiar(data);
  delete limpio.usuarioId;
  delete limpio.pagos;
  await validarCatalogos(usuarioId, limpio.reglaDeteccion);
  const prestamo = await Prestamo.findOneAndUpdate(
    { _id: id, usuarioId },
    limpio,
    { new: true, runValidators: true },
  );
  if (!prestamo) {
    const error = new Error("Préstamo no encontrado");
    error.status = 404;
    throw error;
  }
  if (prestamo.estado === "activo") await reconciliarPrestamo(prestamo);
  return obtenerPrestamoPorIdService(usuarioId, id);
};

export const reconciliarPrestamoService = async (usuarioId, id) => {
  const prestamo = await Prestamo.findOne({ _id: id, usuarioId });
  if (!prestamo) {
    const error = new Error("Préstamo no encontrado");
    error.status = 404;
    throw error;
  }
  if (prestamo.estado === "finalizado") prestamo.estado = "activo";
  prestamo.reglaDeteccion.activa = true;
  await reconciliarPrestamo(prestamo);
  return obtenerPrestamoPorIdService(usuarioId, id);
};

export const desvincularPagoPrestamoService = async (usuarioId, id, gastoId) => {
  await desvincularGastoPrestamo({ usuarioId, prestamoId: id, gastoId });
  return obtenerPrestamoPorIdService(usuarioId, id);
};

export const eliminarPrestamoService = async (usuarioId, id) => {
  const prestamo = await Prestamo.findOneAndDelete({ _id: id, usuarioId });
  if (!prestamo) {
    const error = new Error("Préstamo no encontrado");
    error.status = 404;
    throw error;
  }
  await Gasto.updateMany(
    { usuarioId, prestamoId: prestamo._id },
    { $set: { prestamoId: null, cuotaPrestamoNumero: null } },
  );
  return prestamo;
};
