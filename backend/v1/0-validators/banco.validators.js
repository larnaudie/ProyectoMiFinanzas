import Joi from "joi";

const bancosSchema = Joi.object({
    nombreBanco: Joi.string().min(3).max(30).required().messages({
        'string.min': 'El nombre del banco debe tener al menos 3 caracteres',
        'string.max': 'El nombre del banco no puede exceder los 30 caracteres',
        'string.required': 'El nombre del banco es obligatorio'
    })
});

export default bancosSchema;