import express from "express";
import {
    obtenerCategorias,
    actualizarCategoria,
    eliminarCategoria,
    crearCategoria,
    eliminarTodasLasCategorias
} from "../2-controllers/categorias.controller.js";
import { validateBody } from "../middlewares/validateBody.middleware.js";
import categoriasSchema from "../0-validators/categoria.validators.js";

const router = express.Router({ mergeParams: true });

//Peticiones a /v1/categorias
router.get("/", obtenerCategorias)
router.post("/", validateBody(categoriasSchema), crearCategoria)
router.patch("/:id", actualizarCategoria)
router.delete("/:id", eliminarCategoria)
router.delete("/", eliminarTodasLasCategorias)

export default router;