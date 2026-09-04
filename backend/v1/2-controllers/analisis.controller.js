import {
  actualizarExcepcionPeriodoService,
  actualizarControlPagoService,
  asignarPagoAPeriodoService,
  crearControlPagoService,
  crearControlesPagoService,
  eliminarControlPagoService,
  obtenerCandidatosPagoService,
  obtenerAnalisisService,
  quitarPagoAsignadoService,
} from "../3-services/analisis.service.js";

export const obtenerAnalisis = async (req, res, next) => {
  try {
    const analisis = await obtenerAnalisisService(req.user.id, req.query);
    res.status(200).json({
      message: "Control mensual obtenido",
      analisis,
    });
  } catch (error) {
    next(error);
  }
};

export const crearControlPago = async (req, res, next) => {
  try {
    const control = await crearControlPagoService(req.user.id, req.body);
    res.status(201).json({
      message: "Pago mensual agregado al control",
      control,
    });
  } catch (error) {
    next(error);
  }
};

export const crearControlesPago = async (req, res, next) => {
  try {
    const controles = await crearControlesPagoService(
      req.user.id,
      req.body.subcategoriaIds,
    );
    res.status(201).json({
      message: "Pagos mensuales agregados al control",
      controles,
    });
  } catch (error) {
    next(error);
  }
};

export const actualizarControlPago = async (req, res, next) => {
  try {
    const control = await actualizarControlPagoService(
      req.user.id,
      req.params.id,
      req.body,
    );
    res.status(200).json({
      message: "Control mensual actualizado",
      control,
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerCandidatosPago = async (req, res, next) => {
  try {
    const movimientos = await obtenerCandidatosPagoService(
      req.user.id,
      req.params.id,
      req.query,
    );
    res.status(200).json({
      message: "Movimientos disponibles obtenidos",
      movimientos,
    });
  } catch (error) {
    next(error);
  }
};

export const asignarPagoAPeriodo = async (req, res, next) => {
  try {
    await asignarPagoAPeriodoService(req.user.id, req.params.id, req.body);
    res.status(200).json({ message: "Pago asignado al período" });
  } catch (error) {
    next(error);
  }
};

export const quitarPagoAsignado = async (req, res, next) => {
  try {
    await quitarPagoAsignadoService(req.user.id, req.params.id, req.query);
    res.status(200).json({ message: "Asignación de pago eliminada" });
  } catch (error) {
    next(error);
  }
};

export const actualizarExcepcionPeriodo = async (req, res, next) => {
  try {
    await actualizarExcepcionPeriodoService(
      req.user.id,
      req.params.id,
      req.body,
    );
    res.status(200).json({
      message: req.body.omitido === true
        ? "El pago no se controlará en este período"
        : "El pago volvió a incluirse en este período",
    });
  } catch (error) {
    next(error);
  }
};

export const eliminarControlPago = async (req, res, next) => {
  try {
    const control = await eliminarControlPagoService(
      req.user.id,
      req.params.id,
    );
    res.status(200).json({
      message: "Pago mensual quitado del control",
      control,
    });
  } catch (error) {
    next(error);
  }
};
