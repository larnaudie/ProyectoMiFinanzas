import Joi from "joi";

export const agregarUsuarioSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(30).required().messages({
    "string.base": "El nombre debe ser una cadena de texto",
    "string.empty": "El nombre no puede estar vacío",
    "string.min": "El nombre debe tener al menos {#limit} caracteres",
    "string.max": "El nombre no puede tener más de {#limit} caracteres",
    "any.required": "El nombre es obligatorio",
  }),
  contraseña: Joi.string()
    .min(6)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/)
    .required()
    .messages({
      "string.base": "La contraseña debe ser una cadena de texto",
      "string.empty": "La contraseña no puede estar vacía",
      "string.min": "La contraseña debe tener al menos {#limit} caracteres",
      "string.pattern.base":
        "La contraseña debe contener al menos una letra y un número",
      "any.required": "La contraseña es obligatoria",
    }),
});
