import express from "express";
import {
  actualizarEstadoDeuda,
  crearDeudaCobrar,
  desvincularCobroDeuda,
  eliminarDeudaCobrar,
  obtenerCandidatosCobro,
  obtenerDeudaCobrar,
  obtenerDeudasCobrar,
  vincularCobroDeuda,
} from "../2-controllers/deudasCobrar.controller.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import {
  actualizarEstadoDeudaSchema,
  crearDeudaCobrarSchema,
  vincularCobroDeudaSchema,
} from "../0-validators/deudaCobrar.validators.js";

const router = express.Router({ mergeParams: true });

router.get("/candidatos", obtenerCandidatosCobro);
router.get("/", obtenerDeudasCobrar);
router.get("/:id", obtenerDeudaCobrar);
router.post("/", validateBody(crearDeudaCobrarSchema), crearDeudaCobrar);
router.post("/:id/cobros", validateBody(vincularCobroDeudaSchema), vincularCobroDeuda);
router.delete("/:id/cobros/:gastoId", desvincularCobroDeuda);
router.patch("/:id/estado", validateBody(actualizarEstadoDeudaSchema), actualizarEstadoDeuda);
router.delete("/:id", eliminarDeudaCobrar);

export default router;
