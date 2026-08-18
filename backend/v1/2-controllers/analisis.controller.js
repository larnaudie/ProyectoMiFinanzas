import {
  actualizarControlPagoService,
  crearControlPagoService,
  crearControlesPagoService,
  eliminarControlPagoService,
  obtenerAnalisisService,
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
