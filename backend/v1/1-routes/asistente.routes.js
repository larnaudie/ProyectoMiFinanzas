import express from "express";
import { consultarAsistente } from "../2-controllers/asistente.controller.js";
import { consultarAsistenteSchema } from "../0-validators/asistente.validators.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";

const router = express.Router({ mergeParams: true });

router.post("/consultar", validateBody(consultarAsistenteSchema), consultarAsistente);

export default router;
