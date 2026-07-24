import {
  actualizarTarjetaService,
  crearTarjetaService,
  eliminarTarjetaService,
  importarResumenTarjetaService,
  obtenerResumenesTarjetaService,
  obtenerResumenTarjetaService,
  obtenerTarjetaPorIdService,
  obtenerTarjetasService,
  previsualizarResumenTarjetaService,
} from "../3-services/tarjeta.service.js";

export const obtenerTarjetasCredito = async (req, res, next) => {
  try {
    const tarjetas = await obtenerTarjetasService(req.user.id, req.query);
    res.json({ message: "Tarjetas obtenidas", tarjetas });
  } catch (error) {
    next(error);
  }
};

export const obtenerTarjetaCreditoPorId = async (req, res, next) => {
  try {
    const tarjeta = await obtenerTarjetaPorIdService(req.user.id, req.params.id);
    res.json({ message: "Tarjeta obtenida", tarjeta });
  } catch (error) {
    next(error);
  }
};

export const crearTarjetaCredito = async (req, res, next) => {
  try {
    const tarjeta = await crearTarjetaService(req.user.id, req.body);
    res.status(201).json({ message: "Tarjeta creada", tarjeta });
  } catch (error) {
    next(error);
  }
};

export const actualizarTarjetaCredito = async (req, res, next) => {
  try {
    const tarjeta = await actualizarTarjetaService(req.user.id, req.params.id, req.body);
    res.json({ message: "Tarjeta actualizada", tarjeta });
  } catch (error) {
    next(error);
  }
};

export const eliminarTarjetaCredito = async (req, res, next) => {
  try {
    const tarjeta = await eliminarTarjetaService(req.user.id, req.params.id);
    res.json({ message: "Tarjeta eliminada", tarjeta });
  } catch (error) {
    next(error);
  }
};

export const previsualizarResumenTarjeta = async (req, res, next) => {
  try {
    const resultado = await previsualizarResumenTarjetaService({
      usuarioId: req.user.id,
      tarjetaId: req.params.id,
      file: req.file,
    });
    res.json({ message: "Archivo leído correctamente", ...resultado });
  } catch (error) {
    next(error);
  }
};

export const importarResumenTarjeta = async (req, res, next) => {
  try {
    const resultado = await importarResumenTarjetaService({
      usuarioId: req.user.id,
      tarjetaId: req.params.id,
      ...req.body,
    });
    res.status(201).json({ message: "Resumen importado correctamente", ...resultado });
  } catch (error) {
    next(error);
  }
};

export const obtenerResumenesTarjeta = async (req, res, next) => {
  try {
    const resumenes = await obtenerResumenesTarjetaService(req.user.id, req.params.id);
    res.json({ message: "Resúmenes obtenidos", resumenes });
  } catch (error) {
    next(error);
  }
};

export const obtenerResumenTarjeta = async (req, res, next) => {
  try {
    const resultado = await obtenerResumenTarjetaService(
      req.user.id,
      req.params.id,
      req.params.resumenId,
    );
    res.json({ message: "Resumen obtenido", ...resultado });
  } catch (error) {
    next(error);
  }
};

