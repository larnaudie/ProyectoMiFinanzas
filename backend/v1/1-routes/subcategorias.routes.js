import express from "express";
import {
    obtenerSubcategorias,
    crearSubcategoria,
    actualizarSubcategoria,
    eliminarSubcategoria,
    eliminarTodasLasSubcategorias
} from "../2-controllers/subcategorias.controller.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import subcategoriasSchema from "../0-validators/subcategoria.validators.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/subcategorias
router.get("/", obtenerSubcategorias)
router.post("/", validateBody(subcategoriasSchema), crearSubcategoria)
router.patch("/:id", actualizarSubcategoria)
router.delete("/:id", eliminarSubcategoria)
router.delete("/", eliminarTodasLasSubcategorias)

export default router;