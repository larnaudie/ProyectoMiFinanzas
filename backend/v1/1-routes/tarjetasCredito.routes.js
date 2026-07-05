import express from "express";
import {
    obtenerTarjetasCredito,
    obtenerTarjetaCreditoPorId,
    actualizarTarjetaCredito,
    eliminarTarjetaCredito,
} from "../controllers/tarjetasCredito.controller.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/tarjetasCredito
router.get("/", obtenerTarjetasCredito)
router.get("/:id", obtenerTarjetaCreditoPorId)
router.post("/", crearTarjetaCredito)
router.patch("/:id", actualizarTarjetaCredito)
router.delete("/:id", eliminarTarjetaCredito)

export default router;