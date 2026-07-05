import express from "express";
import {
    obtenerBancos,
    actualizarBanco,
    eliminarBanco,
    crearBanco,
    eliminarTodosLosBancos,
} from "../2-controllers/bancos.controller.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import bancosSchema from "../0-validators/banco.validators.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/bancos
router.get("/", obtenerBancos)
router.post("/", validateBody(bancosSchema), crearBanco)
router.patch("/:id", actualizarBanco)
router.delete("/:id", eliminarBanco)
router.delete("/", eliminarTodosLosBancos)

export default router;