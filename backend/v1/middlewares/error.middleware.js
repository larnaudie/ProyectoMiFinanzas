export const errorMiddleware = (err, req, res, next) => {
    //evitar en producción
    console.error(err.stack);
    res.status(err.status || 500).json({ message: err.message || "Error interno del servidor", details: err.details || "Error interno del servidor" });
}