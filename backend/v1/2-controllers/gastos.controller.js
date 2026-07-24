import {
  obtenerGastosService,
  actualizarGastoService,
  crearGastoService,
  crearGastoYVincularService,
  crearGastoYVincularPagoService,
  eliminarGastoService,
  eliminarTodosLosGastosService,
  subirFacturaGastoService,
  obtenerGastoPorIdService,
} from "../3-services/gasto.service.js";

export const obtenerGastos = async (req, res, next) => {
  try {
    const gastosObtenidos = await obtenerGastosService(req.user.id, req.query);
    res.status(200).json({
      message: "Gastos obtenidos",
      gastos: gastosObtenidos,
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerGastoPorId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const gastoObtenido = await obtenerGastoPorIdService(id, req.user.id);
    res.status(200).json({
      message: `Gasto ${gastoObtenido.id} obtenido con éxito`,
      gasto: gastoObtenido,
    });
  } catch (error) {
    next(error);
  }
};

export const crearGasto = async (req, res,next) => {
  try {
    const gasto = await crearGastoService(req.body, req.user.id);
    res.status(201).json({
      message: `Gasto ${gasto.id} creado exitosamente`,
      gasto: gasto,
    });
  } catch (error) {
    next(error);
  }
};

export const crearGastoYVincularPago = async (req, res, next) => {
  try {
    const resultado = await crearGastoYVincularPagoService({
      gastoPagoId: req.params.id,
      usuarioId: req.user.id,
      data: req.body,
    });
    res.status(201).json({
      message: "Gasto creado y vinculado al pago correctamente",
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};

export const crearGastoYVincular = async (req, res, next) => {
  try {
    const resultado = await crearGastoYVincularService({
      gastoOrigenId: req.params.id,
      usuarioId: req.user.id,
      data: req.body,
    });
    res.status(201).json({
      message: "Movimiento creado y vinculado correctamente",
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};

export const actualizarGasto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const gastoActualizado = await actualizarGastoService(id, usuarioId, req.body);
    res.status(201).json({
      message: `Gasto ${gastoActualizado.id} actualizado exitosamente`,
      gasto: gastoActualizado,
    });
  } catch (error) {
    next(error);
  }
};

export const eliminarGasto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const gastoEliminado = await eliminarGastoService(usuarioId, id);
    res.status(200).json({
      message: `Gasto ${gastoEliminado.id} eliminado exitosamente`,
      gasto: gastoEliminado,
    });
  } catch (error) {
    next(error);
  }
};

export const eliminarTodosLosGastos = async (req, res, next) => {
  try {
    const gastosEliminados = await eliminarTodosLosGastosService(req.user.id);
    res.status(200).json({
      message: `Se eliminaron ${gastosEliminados.deletedCount} gastos exitosamente`,
      gastos: gastosEliminados,
    });
  } catch (error) {
    next(error);
  } 
}

export const subirFacturaGasto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const gasto = await subirFacturaGastoService(id, usuarioId, req.file);

    res.status(200).json({
      message: "Factura subida exitosamente",
      gasto,
    });
  } catch (error) {
    next(error);
  }
};
