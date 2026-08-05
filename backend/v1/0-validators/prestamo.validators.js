import Joi from "joi";
import { MONEDAS_SOPORTADAS } from "../utils/monedas.js";

const reglaDeteccionSchema = Joi.object({
  activa: Joi.boolean(),
  cuentaId: Joi.string().allow("", null),
  subcategoriaId: Joi.string().allow("", null),
  textos: Joi.array().items(Joi.string().trim().min(2)).default([]),
  referencia: Joi.string().trim().allow("", null),
  desde: Joi.date().allow("", null),
});

const entregaInicialSchema = Joi.object({
  monto: Joi.number().min(0).default(0),
  moneda: Joi.string().valid(...MONEDAS_SOPORTADAS).default("USD"),
});

const camposPrestamo = {
  nombre: Joi.string().trim().min(3).max(100),
  tipo: Joi.string().valid("personal", "auto", "hipotecario", "financiacion", "otro"),
  entidad: Joi.string().trim().max(100).allow("", null),
  monedaCapital: Joi.string().valid(...MONEDAS_SOPORTADAS),
  capitalFinanciado: Joi.number().positive(),
  entregaInicial: entregaInicialSchema,
  tea: Joi.number().min(0).max(100),
  plazoCuotas: Joi.number().integer().min(1).max(600),
  cuotaTeorica: Joi.number().positive().allow(null, ""),
  sistemaAmortizacion: Joi.string().valid("frances"),
  fechaInicio: Joi.date().allow("", null),
  diaVencimiento: Joi.number().integer().min(1).max(31).allow(null, ""),
  estado: Joi.string().valid("activo", "pausado", "finalizado"),
  notas: Joi.string().max(1000).allow("", null),
  reglaDeteccion: reglaDeteccionSchema,
};

export const crearPrestamoSchema = Joi.object({
  ...camposPrestamo,
  nombre: camposPrestamo.nombre.required(),
  tipo: camposPrestamo.tipo.required(),
  monedaCapital: camposPrestamo.monedaCapital.required(),
  capitalFinanciado: camposPrestamo.capitalFinanciado.required(),
  tea: camposPrestamo.tea.required(),
  plazoCuotas: camposPrestamo.plazoCuotas.required(),
});

export const actualizarPrestamoSchema = Joi.object(camposPrestamo).min(1);

