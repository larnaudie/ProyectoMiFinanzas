import express from "express";
import {
    crearTarjetaCredito,
    obtenerTarjetasCredito,
    obtenerTarjetaCreditoPorId,
    actualizarTarjetaCredito,
    eliminarTarjetaCredito,
    importarResumenTarjeta,
    obtenerResumenesTarjeta,
    obtenerResumenTarjeta,
    previsualizarResumenTarjeta,
} from "../2-controllers/tarjetasCredito.controller.js";
import {
    actualizarTarjetaSchema,
    crearTarjetaSchema,
    importarResumenTarjetaSchema,
} from "../0-validators/tarjeta.validators.js";
import { uploadExcel } from "../middlewares/uploadExcel.middleware.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/tarjetasCredito
router.get("/", obtenerTarjetasCredito)
router.post("/", validateBody(crearTarjetaSchema), crearTarjetaCredito)
router.get("/:id", obtenerTarjetaCreditoPorId)
router.patch("/:id", validateBody(actualizarTarjetaSchema), actualizarTarjetaCredito)
router.delete("/:id", eliminarTarjetaCredito)
router.post("/:id/importar-preview", uploadExcel.single("excel"), previsualizarResumenTarjeta)
router.post("/:id/resumenes", validateBody(importarResumenTarjetaSchema), importarResumenTarjeta)
router.get("/:id/resumenes", obtenerResumenesTarjeta)
router.get("/:id/resumenes/:resumenId", obtenerResumenTarjeta)

export default router;
