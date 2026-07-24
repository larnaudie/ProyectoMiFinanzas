import {
  importarExcelService,
  importarExcelPersonalService,
  importarExcelTarjetaService,
  confirmarImportacionTarjetaCuentaService,
  obtenerResumenesCuentaCreditoService,
  obtenerResumenCuentaCreditoService,
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


export const importarExcelPersonal = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { cuentaId } = req.params;
    const file = req.file;

    const resultado = await importarExcelPersonalService({
      usuarioId,
      cuentaId,
      file,
    });

    res.status(201).json({
      message: "Excel personal importado correctamente",
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};

export const importarExcelTarjeta = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { cuentaId } = req.params;
    const file = req.file;

    const resultado = await importarExcelTarjetaService({ usuarioId, cuentaId, file });

    res.status(201).json({
      message: "Excel de tarjeta importado correctamente",
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};

export const confirmarImportacionTarjetaCuenta = async (req, res, next) => {
  try {
    const resultado = await confirmarImportacionTarjetaCuentaService({
      usuarioId: req.user.id,
      cuentaId: req.params.cuentaId,
      ...req.body,
    });

    res.status(201).json({
      message: "Movimientos de tarjeta importados correctamente",
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerResumenesCuentaCredito = async (req, res, next) => {
  try {
    const resumenes = await obtenerResumenesCuentaCreditoService({
      usuarioId: req.user.id,
      cuentaId: req.params.cuentaId,
    });
    res.status(200).json({
      message: "Resúmenes de tarjeta obtenidos",
      resumenes,
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerResumenCuentaCredito = async (req, res, next) => {
  try {
    const resumen = await obtenerResumenCuentaCreditoService({
      usuarioId: req.user.id,
      cuentaId: req.params.cuentaId,
      resumenId: req.params.resumenId,
    });
    res.status(200).json({
      message: "Resumen de tarjeta obtenido",
      resumen,
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
