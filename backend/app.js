import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import v1Router from "./v1/v1.routes.js";
import { notFoundMiddleware } from './v1/middlewares/notFound.middleware.js';
import { errorMiddleware } from './v1/middlewares/error.middleware.js';
import connectDB from './v1/config/db.config.js';

dotenv.config();

const app = express();

const origenesPermitidos = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origen) => origen.trim())
    .filter(Boolean);

app.use(cors({
    origin(origen, callback) {
        if (!origen || origenesPermitidos.length === 0 || origenesPermitidos.includes(origen)) {
            return callback(null, true);
        }

        const error = new Error("Origen no permitido por CORS");
        error.status = 403;
        return callback(error);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        next(error);
    }
});

app.get("/", (req, res) => {
    res.json({ ok: true, servicio: "MiFinanzas API" });
});

app.use("/v1", v1Router);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
