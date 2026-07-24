import express from "express";
import {
  obtenerGastos,
  actualizarGasto,
  crearGasto,
  crearGastoYVincular,
  crearGastoYVincularPago,
  eliminarGasto,
  eliminarTodosLosGastos,
  obtenerGastoPorId,
} from "../2-controllers/gastos.controller.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import {
  gastosSchema,
  actualizarGastoSchema,
  crearGastoVinculadoSchema,
  crearGastoVinculadoPagoSchema,
} from "../0-validators/gasto.validators.js";
import { uploadFactura } from "../middlewares/uploadFactura.middleware.js";
import { subirFacturaGasto } from "../2-controllers/gastos.controller.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/gastos
router.get("/", obtenerGastos);
router.get("/:id", obtenerGastoPorId);
router.post("/", validateBody(gastosSchema), crearGasto);
router.post(
  "/:id/crear-vinculo",
  validateBody(crearGastoVinculadoSchema),
  crearGastoYVincular,
);
router.post(
  "/:id/crear-vinculo-pago",
  validateBody(crearGastoVinculadoPagoSchema),
  crearGastoYVincularPago,
);
router.patch(
  "/:id/factura",
  uploadFactura.single("factura"),
  subirFacturaGasto,
);
router.patch("/:id", validateBody(actualizarGastoSchema), actualizarGasto);
router.delete("/:id", eliminarGasto);
router.delete("/", eliminarTodosLosGastos);


export default router;
