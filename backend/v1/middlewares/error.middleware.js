export const errorMiddleware = (err, req, res, next) => {
    if (err?.code === 11000) {
        const campo = Object.keys(err.keyPattern || err.keyValue || {})
            .find((nombre) => nombre !== "usuarioId" && nombre !== "cuentaId");
        const etiquetas = {
            nombreBanco: "banco",
            nombreCuenta: "cuenta",
            nombreCategoria: "categoría",
            nombreSubcategoria: "subcategoría",
            nombre: "préstamo",
            hashBanco: "movimiento importado",
        };
        const entidad = etiquetas[campo] || "registro";

        return res.status(409).json({
            message: `Ya existe un ${entidad} igual para este usuario.`,
        });
    }

    console.error(err.stack);
    return res.status(err.status || 500).json({
        message: err.message || "Error interno del servidor",
        details: err.details || "Error interno del servidor",
    });
}
