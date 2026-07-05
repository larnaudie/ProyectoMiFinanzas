import mongoose from "mongoose";

const subcategoriaSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    nombreSubcategoria: {
        type: String,
        required: true,
        unique: true
    },
    categoria: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Categoria"
    },

});

export default mongoose.model("Subcategoria", subcategoriaSchema, "subcategorias");