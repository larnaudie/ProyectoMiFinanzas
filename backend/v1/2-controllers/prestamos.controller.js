import {
  actualizarPrestamoService,
  crearPrestamoService,
  desvincularPagoPrestamoService,
  eliminarPrestamoService,
  obtenerPrestamoPorIdService,
  obtenerPrestamosService,
  reconciliarPrestamoService,
} from "../3-services/prestamo.service.js";

export const obtenerPrestamos = async (req, res, next) => {
  try {
    const prestamos = await obtenerPrestamosService(req.user.id);
    res.status(200).json({ message: "Préstamos obtenidos", prestamos });
  } catch (error) {
    next(error);
  }
};

export const obtenerPrestamoPorId = async (req, res, next) => {
  try {
    const prestamo = await obtenerPrestamoPorIdService(req.user.id, req.params.id);
    res.status(200).json({ message: "Préstamo obtenido", prestamo });
  } catch (error) {
    next(error);
  }
};

export const crearPrestamo = async (req, res, next) => {
  try {
    const prestamo = await crearPrestamoService(req.user.id, req.body);
    res.status(201).json({ message: "Préstamo creado", prestamo });
  } catch (error) {
    next(error);
  }
};

export const actualizarPrestamo = async (req, res, next) => {
  try {
    const prestamo = await actualizarPrestamoService(
      req.user.id,
      req.params.id,
      req.body,
    );
    res.status(200).json({ message: "Préstamo actualizado", prestamo });
  } catch (error) {
    next(error);
  }
};

export const reconciliarPrestamo = async (req, res, next) => {
  try {
    const prestamo = await reconciliarPrestamoService(req.user.id, req.params.id);
    res.status(200).json({ message: "Pagos conciliados", prestamo });
  } catch (error) {
    next(error);
  }
};

export const desvincularPagoPrestamo = async (req, res, next) => {
  try {
    const prestamo = await desvincularPagoPrestamoService(
      req.user.id,
      req.params.id,
      req.params.gastoId,
    );
    res.status(200).json({ message: "Pago desvinculado", prestamo });
  } catch (error) {
    next(error);
  }
};

export const eliminarPrestamo = async (req, res, next) => {
  try {
    const prestamo = await eliminarPrestamoService(req.user.id, req.params.id);
    res.status(200).json({ message: "Préstamo eliminado", prestamo });
  } catch (error) {
    next(error);
  }
};

