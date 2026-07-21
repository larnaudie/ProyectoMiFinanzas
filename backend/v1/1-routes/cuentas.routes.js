import express from "express";
import {
    obtenerCuentas,
    actualizarCuenta,
    actualizarOrdenCuentas,
    eliminarCuenta,
    crearCuenta,
} from "../2-controllers/cuentas.controller.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import cuentasSchema from "../0-validators/cuenta.validators.js";


const router = express.Router({ mergeParams: true });

//Peticiones a /v1/cuentas
router.get("/", obtenerCuentas)
router.post("/", validateBody(cuentasSchema), crearCuenta)
router.patch("/orden", actualizarOrdenCuentas)
router.patch("/:id", actualizarCuenta)
router.delete("/:id", eliminarCuenta)

export default router;