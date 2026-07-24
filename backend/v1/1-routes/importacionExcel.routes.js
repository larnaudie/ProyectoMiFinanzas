import express from "express";
import { uploadExcel } from "../middlewares/uploadExcel.middleware.js";
import {
  importarExcel,
  importarExcelPersonal,
  importarExcelTarjeta,
  confirmarImportacionTarjetaCuenta,
  obtenerResumenesCuentaCredito,
  obtenerResumenCuentaCredito,
  obtenerMovimientosImportados,
  ignorarMovimientoImportado,
  vincularMovimientoAGasto,
  crearGastoDesdeMovimientoImportado,
} from "../2-controllers/importacionExcel.controller.js";
import { importarResumenTarjetaSchema } from "../0-validators/tarjeta.validators.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";

const router = express.Router({ mergeParams: true });
// /v1/importaciones
router.post(
  "/cuentas/:cuentaId/excel",
  uploadExcel.single("excel"),
  importarExcel
);


router.post(
  "/cuentas/:cuentaId/tarjeta-excel",
  uploadExcel.single("excel"),
  importarExcelTarjeta
);
router.get(
  "/cuentas/:cuentaId/resumenes-tarjeta",
  obtenerResumenesCuentaCredito,
);
router.get(
  "/cuentas/:cuentaId/resumenes-tarjeta/:resumenId",
  obtenerResumenCuentaCredito,
);
router.post(
  "/cuentas/:cuentaId/tarjeta-resumen",
  validateBody(importarResumenTarjetaSchema),
  confirmarImportacionTarjetaCuenta,
);
router.post(
  "/cuentas/:cuentaId/excel-personal",
  uploadExcel.single("excel"),
  importarExcelPersonal
);
router.get(
  "/cuentas/:cuentaId/movimientos",
  obtenerMovimientosImportados
);

router.patch(
  "/movimientos/:id/ignorar",
  ignorarMovimientoImportado
);

router.patch(
  "/movimientos/:id/vincular-gasto",
  vincularMovimientoAGasto
);

router.post(
  "/movimientos/:id/crear-gasto",
  crearGastoDesdeMovimientoImportado
);

export default router;
