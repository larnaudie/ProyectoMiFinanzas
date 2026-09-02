import mongoose from "mongoose";
import { migrarIndicesUnicosPorUsuario } from "./indicesPorUsuario.js";

let conexionPromise = null;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (!process.env.MONGO_URI) {
        throw new Error("Falta configurar MONGO_URI");
    }

    if (!conexionPromise) {
        conexionPromise = mongoose.connect(process.env.MONGO_URI)
            .then(async () => {
                const ejecutarMigracion = process.env.MIGRATE_INDEXES_ON_STARTUP === "true"
                    || process.env.NODE_ENV !== "production";

                if (ejecutarMigracion) {
                    await migrarIndicesUnicosPorUsuario();
                }

                console.log("Conectado a MongoDB");
                return mongoose.connection;
            })
            .catch((error) => {
                conexionPromise = null;
                throw error;
            });
    }

    return conexionPromise;
};
export default connectDB;
