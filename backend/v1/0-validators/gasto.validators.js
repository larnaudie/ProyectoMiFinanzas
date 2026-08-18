import Joi from "joi";

import { MONEDAS_SOPORTADAS } from "../utils/monedas.js";

const resumenTarjetaSchema = Joi.object({
  tarjeta: Joi.string().allow("", null),
  cierre: Joi.date().allow("", null),
  vencimiento: Joi.date().allow("", null),
  periodo: Joi.string().allow("", null),
  importacionKey: Joi.string().allow("", null),
}).optional();

const origenSchema = Joi.object({
  tipo: Joi.string().valid("manual", "tarjeta", "prestamo", "excel").default("manual"),
  referenciaId: Joi.string().allow(null, ""),
}).optional();

export const gastosSchema = Joi.object({
  detalle: Joi.string().trim().min(3).max(120).required().messages({
    "string.min": "El nombre del gasto debe tener al menos 3 caracteres",
    "string.max": "El nombre del gasto no puede exceder los 120 caracteres",
    "string.required": "El nombre del gasto es obligatorio",
  }),
  cuentaId: Joi.string().required().messages({
    "string.required": "La cuenta es obligatoria",
  }),
  fecha: Joi.date().allow("", null),
  montoBancario: Joi.number().allow("", null),
  montoReal: Joi.number().allow("", null),
  porcentaje: Joi.number().min(0).max(100).default(0).allow("", null),
  incluirMontoReal: Joi.boolean().default(false),
  sumaAlPresupuesto: Joi.boolean().default(false),
  moneda: Joi.string().valid(...MONEDAS_SOPORTADAS),
  categoriaId: Joi.string().allow("", null),
  subcategoriaId: Joi.string().allow("", null),
  cambiarEstado: Joi.boolean(),
  tipoMovimiento: Joi.string()
    .valid("manual", "compra", "pago", "cuota", "reintegro")
    .default("manual"),
  origen: origenSchema,
  resumenTarjeta: resumenTarjetaSchema,
});

export const actualizarGastoSchema = Joi.object({
  detalle: Joi.string(),
  cuentaId: Joi.string(),
  fecha: Joi.date().allow("", null),
  montoBancario: Joi.number().allow("", null),
  montoReal: Joi.number().allow("", null),
  porcentaje: Joi.number().min(0).max(100).allow("", null),
  incluirMontoReal: Joi.boolean(),
  sumaAlPresupuesto: Joi.boolean(),
  moneda: Joi.string().valid(...MONEDAS_SOPORTADAS),
  categoriaId: Joi.string().allow("", null),
  subcategoriaId: Joi.string().allow("", null),
  cambiarEstado: Joi.boolean(),
  tipoMovimiento: Joi.string().valid("manual", "compra", "pago", "cuota", "reintegro"),
  origen: origenSchema,
  resumenTarjeta: resumenTarjetaSchema,
}).min(1);

export const crearGastoVinculadoSchema = Joi.object({
  cuentaId: Joi.string().required(),
  detalle: Joi.string().trim().min(3).max(120).required(),
  fecha: Joi.date().required(),
  montoBancario: Joi.number().invalid(0).required(),
  categoriaId: Joi.string().allow("", null),
  subcategoriaId: Joi.string().allow("", null),
});

export const crearGastoVinculadoPagoSchema = crearGastoVinculadoSchema;

export const crearGastoExcelPersonalSchema = Joi.object({
  sourceHash: Joi.string().hex().length(64).required(),
  detalle: Joi.string().trim().min(3).max(500).required(),
  fecha: Joi.date().required(),
  montoBancario: Joi.number().allow("", null),
  montoReal: Joi.number().allow("", null),
  porcentaje: Joi.number().min(0).max(100).allow("", null),
  incluirMontoReal: Joi.boolean().required(),
  sumaAlPresupuesto: Joi.boolean().default(false),
  categoriaId: Joi.string().allow("", null),
  subcategoriaId: Joi.string().required(),
}).custom((value, helpers) => {
  const montoBancario = Number(value.montoBancario);
  const montoReal = Number(value.montoReal);
  const tieneMontoBancario =
    value.montoBancario !== "" &&
    value.montoBancario !== null &&
    value.montoBancario !== undefined &&
    Number.isFinite(montoBancario) &&
    montoBancario !== 0;
  const tieneMontoReal =
    value.montoReal !== "" &&
    value.montoReal !== null &&
    value.montoReal !== undefined &&
    Number.isFinite(montoReal) &&
    montoReal !== 0;

  if (!tieneMontoBancario && !tieneMontoReal) {
    return helpers.message({
      custom: "El gasto debe tener monto bancario o monto real distinto de cero",
    });
  }

  if (
    tieneMontoBancario &&
    (value.porcentaje === "" ||
      value.porcentaje === null ||
      value.porcentaje === undefined)
  ) {
    return helpers.message({
      custom: "El porcentaje es obligatorio cuando hay monto bancario",
    });
  }

  return value;
});
