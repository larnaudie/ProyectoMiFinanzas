import express from "express";
import {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    actualizarUsuario,
} from "../2-controllers/usuarios.controller.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/usuarios
router.get("/", obtenerUsuarios)
router.get("/:id", obtenerUsuarioPorId)
router.patch("/:id", actualizarUsuario)

export default router;