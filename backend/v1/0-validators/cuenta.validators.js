import Joi from "joi";

import { MONEDAS_SOPORTADAS } from "../utils/monedas.js";

const cuentasSchema = Joi.object({
    nombreCuenta: Joi.string().min(3).max(30).required().messages({
        'string.min': 'El nombre de la cuenta debe tener al menos 3 caracteres',
        'string.max': 'El nombre de la cuenta no puede exceder los 30 caracteres',
        'string.required': 'El nombre de la cuenta es obligatorio'
    }),
    tipoCuenta: Joi.string().valid("debito", "credito").default("debito"),
    moneda: Joi.string().valid(...MONEDAS_SOPORTADAS).default("UYU"),
    monedas: Joi.array()
        .items(Joi.string().valid(...MONEDAS_SOPORTADAS))
        .unique()
        .min(1),
    bancoId: Joi.string().hex().length(24).allow("", null).default(null),
    saldoActual: Joi.number().allow(null),
});

export const actualizarCuentaSchema = Joi.object({
    nombreCuenta: Joi.string().min(3).max(30),
    tipoCuenta: Joi.string().valid("debito", "credito"),
    moneda: Joi.string().valid(...MONEDAS_SOPORTADAS),
    monedas: Joi.array()
        .items(Joi.string().valid(...MONEDAS_SOPORTADAS))
        .unique()
        .min(1),
    bancoId: Joi.string().hex().length(24).allow("", null),
    saldoActual: Joi.number().allow(null),
}).min(1);

export default cuentasSchema;
