import express from "express";
import {
    obtenerPrestamos,
    obtenerPrestamoPorId,
    actualizarPrestamo,
    crearPrestamo,
    eliminarPrestamo,
    reconciliarPrestamo,
    desvincularPagoPrestamo,
} from "../2-controllers/prestamos.controller.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import {
  actualizarPrestamoSchema,
  crearPrestamoSchema,
} from "../0-validators/prestamo.validators.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/prestamos
router.get("/", obtenerPrestamos)
router.get("/:id", obtenerPrestamoPorId)
router.post("/", validateBody(crearPrestamoSchema), crearPrestamo)
router.post("/:id/reconciliar", reconciliarPrestamo)
router.delete("/:id/pagos/:gastoId", desvincularPagoPrestamo)
router.patch("/:id", validateBody(actualizarPrestamoSchema), actualizarPrestamo)
router.delete("/:id", eliminarPrestamo)

export default router;
