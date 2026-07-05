import Joi from "joi";

const categoriasSchema = Joi.object({
    nombreCategoria: Joi.string().min(3).max(30).required().messages({
        'string.min': 'El nombre de la categoría debe tener al menos 3 caracteres',
        'string.max': 'El nombre de la categoría no puede exceder los 30 caracteres',
        'string.required': 'El nombre de la categoría es obligatorio'
    }),

});

export default categoriasSchema;