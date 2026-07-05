import express from "express";
import { registrarUsuario, loginUsuario } from "../2-controllers/auth.controller.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import { registrarUsuarioSchema, loginUsuarioSchema } from "../0-validators/auth.validators.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/auth
router.post("/register", validateBody(registrarUsuarioSchema), registrarUsuario)
router.post("/login", validateBody(loginUsuarioSchema), loginUsuario)

export default router;