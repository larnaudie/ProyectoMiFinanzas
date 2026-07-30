import express from "express";
import { obtenerCotizacionUi } from "../2-controllers/cotizaciones.controller.js";

const router = express.Router({ mergeParams: true });

router.get("/ui", obtenerCotizacionUi);

export default router;
