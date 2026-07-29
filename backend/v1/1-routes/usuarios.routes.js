import express from "express";
import {
    actualizarPerfil,
    obtenerPerfil,
} from "../2-controllers/usuarios.controller.js";
import { actualizarPerfilSchema } from "../0-validators/usuarios.validators.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";

const router = express.Router({ mergeParams: true });

router.get("/me", obtenerPerfil);
router.patch("/me", validateBody(actualizarPerfilSchema), actualizarPerfil);

export default router;
