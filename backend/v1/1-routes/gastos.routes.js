import express from "express";
import {
  obtenerGastos,
  actualizarGasto,
  crearGasto,
  eliminarGasto,
  eliminarTodosLosGastos,
} from "../2-controllers/gastos.controller.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import gastosSchema from "../0-validators/gasto.validators.js";
import { uploadFactura } from "../middlewares/uploadFactura.middleware.js";
import { subirFacturaGasto } from "../2-controllers/gastos.controller.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/gastos
router.get("/", obtenerGastos);
router.post("/", validateBody(gastosSchema), crearGasto);
router.patch(
  "/:id/factura",
  uploadFactura.single("factura"),
  subirFacturaGasto,
);
router.patch("/:id", validateBody(gastosSchema), actualizarGasto);
router.delete("/:id", eliminarGasto);
router.delete("/", eliminarTodosLosGastos);


export default router;
