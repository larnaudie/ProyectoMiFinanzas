import express from "express";
import {
    obtenerPrestamos,
    obtenerPrestamoPorId,
    actualizarPrestamo,
    crearPrestamo,
    eliminarPrestamo,
    eliminarTodosLosPrestamos
} from "../2-controllers/prestamos.controller.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/prestamos
router.get("/", obtenerPrestamos)
router.get("/:id", obtenerPrestamoPorId)
router.post("/", crearPrestamo)
router.patch("/:id", actualizarPrestamo)
router.delete("/:id", eliminarPrestamo)
router.delete("/", eliminarTodosLosPrestamos)

export default router;