import {
  obtenerCuentasService,
  actualizarCuentaService,
  crearCuentaService,
  actualizarOrdenCuentasService,
  eliminarCuentaService,
  eliminarTodasLasCuentasService,
} from "../3-services/cuenta.service.js";

export const obtenerCuentas = async (req, res, next) => {
  try {
    const cuentasObtenidas = await obtenerCuentasService(req.user.id);
    res.status(200).json({
      message: "Cuentas obtenidas",
      cuentas: cuentasObtenidas,
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerCuentaPorId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cuentaObtenida = await obtenerCuentaPorIdService(id);
    res.status(200).json({
      message: `Cuenta ${cuentaObtenida.id} obtenida con exito`,
      cuenta: cuentaObtenida,
    });
  } catch (error) {
    next(error);
  }
};

export const crearCuenta = async (req, res, next) => {
  try {
    const cuentaCreada = await crearCuentaService(req.user.id, req.body);
    res.status(201).json({
      message: `Cuenta ${cuentaCreada.id} creada exitosamente`,
      cuenta: cuentaCreada,
    });
  } catch (error) {
    next(error);
  }
};

export const actualizarCuenta = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const cuentaActualizada = await actualizarCuentaService(usuarioId, id, req.body);
    res.status(201).json({
      message: `Cuenta ${cuentaActualizada.id} actualizada exitosamente`,
      cuenta: cuentaActualizada,
    });
  } catch (error) {
    next(error);
  }
};

export const actualizarOrdenCuentas = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const cuentasOrdenadas = await actualizarOrdenCuentasService(usuarioId, req.body.cuentas || []);
    res.status(200).json({
      message: "Orden de cuentas actualizado",
      cuentas: cuentasOrdenadas,
    });
  } catch (error) {
    next(error);
  }
};
export const eliminarCuenta = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const cuentaEliminada = await eliminarCuentaService(usuarioId, id);
    res.status(200).json({
      message: `Cuenta ${cuentaEliminada.id} eliminada exitosamente`,
      cuenta: cuentaEliminada,
    });
  } catch (error) {
    next(error);
  }
};

export const eliminarTodasLasCuentas = async (req, res, next) => {
  try {
    const cuentasEliminadas = await eliminarTodasLasCuentasService(req.user.id);
    res.status(200).json({
      message: `Todas las cuentas eliminadas exitosamente`,
      cuentas: cuentasEliminadas,
    });
  } catch (error) {
    next(error);
  }
};