import { obtenerCotizacionUiBcuService } from "../3-services/cotizacionBcu.service.js";

export const obtenerCotizacionUi = async (req, res, next) => {
  try {
    const cotizacion = await obtenerCotizacionUiBcuService({
      forzar: req.query.actualizar === "true",
    });

    res.status(200).json({
      message: "Cotización de UI obtenida",
      cotizacion,
    });
  } catch (error) {
    next(error);
  }
};
