import express from "express";
import { uploadExcel } from "../middlewares/uploadExcel.middleware.js";
import {
  importarExcel,
  importarExcelPersonal,
  obtenerMovimientosImportados,
  ignorarMovimientoImportado,
  vincularMovimientoAGasto,
  crearGastoDesdeMovimientoImportado,
} from "../2-controllers/importacionExcel.controller.js";

const router = express.Router({ mergeParams: true });
// /v1/importaciones
router.post(
  "/cuentas/:cuentaId/excel",
  uploadExcel.single("excel"),
  importarExcel
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