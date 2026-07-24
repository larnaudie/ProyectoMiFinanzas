import Joi from "joi";

const cuentasSchema = Joi.object({
    nombreCuenta: Joi.string().min(3).max(30).required().messages({
        'string.min': 'El nombre de la cuenta debe tener al menos 3 caracteres',
        'string.max': 'El nombre de la cuenta no puede exceder los 30 caracteres',
        'string.required': 'El nombre de la cuenta es obligatorio'
    }),
    tipoCuenta: Joi.string().valid("debito", "credito").default("debito"),
    moneda: Joi.string().valid("UYU", "USD").default("UYU"),
    bancoId: Joi.string().hex().length(24).allow("", null).default(null),
});

export default cuentasSchema;
