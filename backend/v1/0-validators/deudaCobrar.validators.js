import Joi from "joi";
import { MONEDAS_SOPORTADAS } from "../utils/monedas.js";

export const crearDeudaCobrarSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(100).required(),
  deudor: Joi.string().trim().min(2).max(100).required(),
  monedaCapital: Joi.string().valid(...MONEDAS_SOPORTADAS).required(),
  capitalOriginal: Joi.number().positive().required(),
  fechaInicio: Joi.date().allow("", null),
  notas: Joi.string().trim().max(1000).allow("", null),
});

export const vincularCobroDeudaSchema = Joi.object({
  gastoId: Joi.string().required(),
  cotizacion: Joi.object({
    fuente: Joi.string().trim().max(150).allow("", null),
    fecha: Joi.date().allow("", null),
    uyuPorDolar: Joi.number().positive().allow(null),
    uyuPorUi: Joi.number().positive().allow(null),
  }).default({}),
});

export const actualizarEstadoDeudaSchema = Joi.object({
  estado: Joi.string().valid("activa", "saldada").required(),
});
