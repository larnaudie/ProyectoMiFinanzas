import Joi from "joi";

const idSchema = Joi.string().trim().hex().length(24);
const montoPorMonedaSchema = Joi.object({
  UYU: Joi.number().allow(null).default(null),
  USD: Joi.number().allow(null).default(null),
});

export const crearTarjetaSchema = Joi.object({
  nombreTarjeta: Joi.string().trim().min(2).max(50).required(),
  cuentaId: idSchema.required(),
  bancoId: idSchema.allow(null, "").default(null),
  ultimosDigitos: Joi.string().trim().pattern(/^\d{0,4}$/).allow("").default(""),
  activa: Joi.boolean().default(true),
});

export const actualizarTarjetaSchema = Joi.object({
  nombreTarjeta: Joi.string().trim().min(2).max(50),
  cuentaId: idSchema,
  bancoId: idSchema.allow(null, ""),
  ultimosDigitos: Joi.string().trim().pattern(/^\d{0,4}$/).allow(""),
  activa: Joi.boolean(),
}).min(1);

const resumenSchema = Joi.object({
  cuentaTarjetaUltimosDigitos: Joi.string().trim().pattern(/^\d{0,4}$/).allow("").default(""),
  periodo: Joi.string().trim().max(80).allow("").default(""),
  cierre: Joi.date().required(),
  vencimiento: Joi.date().allow(null, "").default(null),
  limiteCredito: montoPorMonedaSchema.default({ UYU: null, USD: null }),
  pagoContado: montoPorMonedaSchema.default({ UYU: null, USD: null }),
  pagoMinimo: montoPorMonedaSchema.default({ UYU: null, USD: null }),
  saldoAnterior: montoPorMonedaSchema.default({ UYU: null, USD: null }),
  saldoFinal: montoPorMonedaSchema.default({ UYU: null, USD: null }),
});

const movimientoSchema = Joi.object({
  sourceHash: Joi.string().hex().length(64).required(),
  fila: Joi.number().integer().min(1).allow(null),
  fecha: Joi.date().required(),
  tarjeta: Joi.string().trim().allow("").default(""),
  detalle: Joi.string().trim().min(1).max(180).required(),
  importePesos: Joi.number().default(0),
  importeDolares: Joi.number().default(0),
  montoEstadoCuenta: Joi.number().invalid(0).required(),
  montoBancario: Joi.number().invalid(0).required(),
  moneda: Joi.string().valid("UYU", "USD").required(),
  tipo: Joi.string().valid("compra", "pago", "cuota", "reintegro").required(),
  porcentaje: Joi.number().min(0).max(100).default(100),
  incluirMontoReal: Joi.boolean().default(true),
});

export const importarResumenTarjetaSchema = Joi.object({
  resumen: resumenSchema.required(),
  movimientos: Joi.array().items(movimientoSchema).min(1).max(1000).required(),
  archivoNombre: Joi.string().trim().max(255).allow("").default(""),
});

