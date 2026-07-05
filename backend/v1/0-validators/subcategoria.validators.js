import Joi from "joi";

const subcategoriasSchema =Joi.object({
    nombreSubcategoria: Joi.string().trim().min(3).max(30).required().messages({
        'string.min': 'El nombre de la subcategoría debe tener al menos 3 caracteres',
        'string.max': 'El nombre de la subcategoría no puede exceder los 30 caracteres',
        'string.required': 'El nombre de la subcategoría es obligatorio'
    }),
    categoria: Joi.string().required().messages({
        'string.required': 'La categoría es obligatoria'
    })

});

export default subcategoriasSchema;