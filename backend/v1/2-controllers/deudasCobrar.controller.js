import {
  actualizarEstadoDeudaService,
  crearDeudaCobrarService,
  desvincularCobroDeudaService,
  eliminarDeudaCobrarService,
  obtenerCandidatosCobroService,
  obtenerDeudaCobrarPorIdService,
  obtenerDeudasCobrarService,
  vincularCobroDeudaService,
} from "../3-services/deudaCobrar.service.js";

export const obtenerDeudasCobrar = async (req, res, next) => {
  try {
    const deudas = await obtenerDeudasCobrarService(req.user.id);
    res.status(200).json({ message: "Deudas obtenidas", deudas });
  } catch (error) { next(error); }
};

export const obtenerDeudaCobrar = async (req, res, next) => {
  try {
    const deuda = await obtenerDeudaCobrarPorIdService(req.user.id, req.params.id);
    res.status(200).json({ message: "Deuda obtenida", deuda });
  } catch (error) { next(error); }
};

export const crearDeudaCobrar = async (req, res, next) => {
  try {
    const deuda = await crearDeudaCobrarService(req.user.id, req.body);
    res.status(201).json({ message: "Deuda creada", deuda });
  } catch (error) { next(error); }
};

export const obtenerCandidatosCobro = async (req, res, next) => {
  try {
    const movimientos = await obtenerCandidatosCobroService(req.user.id);
    res.status(200).json({ message: "Movimientos obtenidos", movimientos });
  } catch (error) { next(error); }
};

export const vincularCobroDeuda = async (req, res, next) => {
  try {
    const deuda = await vincularCobroDeudaService(req.user.id, req.params.id, req.body);
    res.status(200).json({ message: "Cobro vinculado", deuda });
  } catch (error) { next(error); }
};

export const desvincularCobroDeuda = async (req, res, next) => {
  try {
    const deuda = await desvincularCobroDeudaService(
      req.user.id,
      req.params.id,
      req.params.gastoId,
    );
    res.status(200).json({ message: "Cobro desvinculado", deuda });
  } catch (error) { next(error); }
};

export const actualizarEstadoDeuda = async (req, res, next) => {
  try {
    const deuda = await actualizarEstadoDeudaService(
      req.user.id,
      req.params.id,
      req.body.estado,
    );
    res.status(200).json({ message: "Estado actualizado", deuda });
  } catch (error) { next(error); }
};

export const eliminarDeudaCobrar = async (req, res, next) => {
  try {
    const deuda = await eliminarDeudaCobrarService(req.user.id, req.params.id);
    res.status(200).json({ message: "Deuda eliminada", deuda });
  } catch (error) { next(error); }
};
