import Joi from "joi";

const mensajeSchema = Joi.object({
  role: Joi.string().valid("user", "assistant").required(),
  content: Joi.string().trim().min(1).max(4000).required(),
});

export const consultarAsistenteSchema = Joi.object({
  pregunta: Joi.string().trim().min(2).max(2000).required(),
  historial: Joi.array().items(mensajeSchema).max(12).default([]),
});
