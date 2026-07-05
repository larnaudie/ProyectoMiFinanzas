import Joi from "joi";

export const gastosSchema = Joi.object({
  detalle: Joi.string().trim().min(3).max(30).required().messages({
    "string.min": "El nombre del gasto debe tener al menos 3 caracteres",
    "string.max": "El nombre del gasto no puede exceder los 30 caracteres",
    "string.required": "El nombre del gasto es obligatorio",
  }),
  cuentaId: Joi.string().required().messages({
    "string.required": "La cuenta es obligatoria",
  }),
  fecha: Joi.date().allow("", null).messages({
    "date.required": "La fecha es obligatoria",
  }),
  montoBancario: Joi.number().allow("", null).messages({
    "number.required": "El monto es obligatorio",
  }),
  porcentaje: Joi.number().min(0).max(100).default(0).allow("", null).messages({
    "number.min": "El porcentaje no puede ser negativo",
    "number.max": "El porcentaje no puede exceder el 100%",
  }),
  incluirMontoReal: Joi.boolean().default(false).messages({
    "boolean.default":
      "El valor predeterminado para incluir monto real es false",
  }),
  categoriaId: Joi.string().allow("", null).messages({
    "string.required": "La categoría es obligatoria",
  }),
  subcategoriaId: Joi.string().allow("", null).messages({
    "string.required": "La subcategoría es obligatoria",
  }),
  cambiarEstado: Joi.boolean(),
  origen: Joi.object({
    tipo: Joi.string()
      .valid("manual", "tarjeta", "prestamo", "excel")
      .default("manual"),
    referenciaId: Joi.string().allow(null, ""),
  }).optional(),
});

export const actualizarGastoSchema = Joi.object({
  detalle: Joi.string(),
  cuentaId: Joi.string(),
  fecha: Joi.date().allow("", null),
  montoBancario: Joi.number().allow("", null),
  porcentaje: Joi.number().min(0).max(100).allow("", null),
  incluirMontoReal: Joi.boolean(),
  categoriaId: Joi.string().allow("", null),
  subcategoriaId: Joi.string().allow("", null),
  cambiarEstado: Joi.boolean(),
}).min(1);
