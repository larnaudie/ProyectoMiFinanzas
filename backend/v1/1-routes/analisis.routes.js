import express from "express";
import {
  actualizarExcepcionPeriodo,
  actualizarControlPago,
  asignarPagoAPeriodo,
  crearControlPago,
  crearControlesPago,
  eliminarControlPago,
  obtenerCandidatosPago,
  obtenerAnalisis,
  quitarPagoAsignado,
} from "../2-controllers/analisis.controller.js";

const router = express.Router({ mergeParams: true });

router.get("/", obtenerAnalisis);
router.post("/controles", crearControlPago);
router.post("/controles/varios", crearControlesPago);
router.get("/controles/:id/candidatos", obtenerCandidatosPago);
router.put("/controles/:id/asignacion", asignarPagoAPeriodo);
router.delete("/controles/:id/asignacion", quitarPagoAsignado);
router.put("/controles/:id/excepcion", actualizarExcepcionPeriodo);
router.patch("/controles/:id", actualizarControlPago);
router.delete("/controles/:id", eliminarControlPago);

export default router;
