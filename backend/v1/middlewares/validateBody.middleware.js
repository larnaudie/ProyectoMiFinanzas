export const validateBody = schema => (req, res, next) => {
    const { value, error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            mensaje: "Error en la validación",
            error: error.details
        });
    }
    //req.validatedBody = value;
    req.body = value; // Sobrescribimos el body con los datos validados y transformados
    next();
}
