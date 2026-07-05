import Joi from "joi";

export const registrarUsuarioSchema = Joi.object({
  username: Joi.string().trim().min(3).max(30).required().messages({
    "string.base": "El nombre de usuario debe ser un texto",
    "string.empty": "El nombre de usuario no puede estar vacío",
    "string.min":
      "El nombre de usuario debe tener al menos {#limit} caracteres",
    "string.max":
      "El nombre de usuario no puede tener más de {#limit} caracteres",
  }),
  password: Joi.string().trim().min(6).max(128).required().messages({
    "string.base": "La contraseña debe ser un texto",
    "string.empty": "La contraseña no puede estar vacía",
    "string.min": "La contraseña debe tener al menos {#limit} caracteres",
    "string.max": "La contraseña no puede tener más de {#limit} caracteres",
  }),
  confirmPassword: Joi.string()
    .trim()
    .valid(Joi.ref("password"))
    .required()
    .messages({
      "any.only": "Las contraseñas no coinciden",
    }),
  rol: Joi.string().valid("user", "admin").default("user").messages({
    "any.only": "El rol debe ser user o admin",
  }),
  codigoAdmin: Joi.string()
    .when("rol", {
      is: "admin",
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "any.required": "El codigo de administrador es obligatorio",
    }),
});

export const loginUsuarioSchema = Joi.object({
  username: Joi.string().trim().required().messages({
    "string.base": "El nombre de usuario debe ser un texto",
    "string.empty": "El nombre de usuario no puede estar vacío",
    "any.required": "El nombre de usuario es obligatorio",
  }),
  password: Joi.string().trim().required().messages({
    "string.base": "La contraseña debe ser un texto",
    "string.empty": "La contraseña no puede estar vacía",
    "any.required": "La contraseña es obligatoria",
  }),
});
