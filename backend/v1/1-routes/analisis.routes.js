import express from "express";
import {
  actualizarControlPago,
  crearControlPago,
  crearControlesPago,
  eliminarControlPago,
  obtenerAnalisis,
} from "../2-controllers/analisis.controller.js";

const router = express.Router({ mergeParams: true });

router.get("/", obtenerAnalisis);
router.post("/controles", crearControlPago);
router.post("/controles/varios", crearControlesPago);
router.patch("/controles/:id", actualizarControlPago);
router.delete("/controles/:id", eliminarControlPago);

export default router;
