import express from 'express';
import {authenticateToken} from './middlewares/authenticate.middleware.js';
import authRouter from "./1-routes/auth.routes.js";

import usuariosRouter from "./1-routes/usuarios.routes.js";
import bancosRouter from "./1-routes/bancos.routes.js";
import cuentasRouter from "./1-routes/cuentas.routes.js";
import gastosRouter from "./1-routes/gastos.routes.js";
import categoriasRouter from "./1-routes/categorias.routes.js";
import subcategoriasRouter from "./1-routes/subcategorias.routes.js";
import importacionesRouter from "./1-routes/importacionExcel.routes.js";
import tarjetasRouter from "./1-routes/tarjetasCredito.routes.js";
//import prestamosRouter from "./1-routes/prestamos.routes.js";


const router = express.Router({ mergeParams: true });

//rutas desprotegidas
router.use("/auth", authRouter);

router.use(authenticateToken);

//rutas protegidas
router.use("/bancos", bancosRouter);
router.use("/cuentas", cuentasRouter);
router.use("/gastos", gastosRouter);
router.use("/categorias", categoriasRouter);
router.use("/subcategorias", subcategoriasRouter);
router.use("/importaciones", importacionesRouter);
router.use("/tarjetas", tarjetasRouter);
//router.use("/prestamos", prestamosRouter);

export default router; 
