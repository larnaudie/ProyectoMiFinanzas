import {
  importarExcelService,
  obtenerMovimientosImportadosService,
  ignorarMovimientoImportadoService,
  vincularMovimientoAGastoService,
  crearGastoDesdeMovimientoImportadoService,
} from "../3-services/importacionExcel.service.js";

export const importarExcel = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { cuentaId } = req.params;
    const file = req.file;

    const resultado = await importarExcelService({
      usuarioId,
      cuentaId,
      file,
    });

    res.status(201).json({
      message: "Excel importado correctamente",
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerMovimientosImportados = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { cuentaId } = req.params;
    const { estado } = req.query;

    const movimientos = await obtenerMovimientosImportadosService({
      usuarioId,
      cuentaId,
      estadoImportacion: estado,
    });

    res.json({
      message: "Movimientos importados obtenidos",
      movimientos,
    });
  } catch (error) {
    next(error);
  }
};

export const ignorarMovimientoImportado = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;

    const movimiento = await ignorarMovimientoImportadoService({
      usuarioId,
      id,
    });

    res.json({
      message: "Movimiento ignorado correctamente",
      movimiento,
    });
  } catch (error) {
    next(error);
  }
};

export const vincularMovimientoAGasto = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;
    const { gastoId } = req.body;

    const movimiento = await vincularMovimientoAGastoService({
      usuarioId,
      id,
      gastoId,
    });

    res.json({
      message: "Movimiento vinculado correctamente",
      movimiento,
    });
  } catch (error) {
    next(error);
  }
};

export const crearGastoDesdeMovimientoImportado = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;

    const resultado = await crearGastoDesdeMovimientoImportadoService({
      usuarioId,
      id,
      data: req.body,
    });

    res.status(201).json({
      message: "Gasto creado desde movimiento importado",
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};