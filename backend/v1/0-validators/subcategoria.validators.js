import Joi from "joi";

const subcategoriasSchema = Joi.object({
  nombreSubcategoria: Joi.string().trim().min(3).max(30).required().messages({
    "string.min": "El nombre de la subcategoria debe tener al menos 3 caracteres",
    "string.max": "El nombre de la subcategoria no puede exceder los 30 caracteres",
    "any.required": "El nombre de la subcategoria es obligatorio",
  }),
  categoria: Joi.string().allow("", null).optional().messages({
    "string.base": "La categoria debe ser un id valido",
  }),
});

export default subcategoriasSchema;