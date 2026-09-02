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
        trim: true
    },
    categoria: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Categoria"
    },

});

subcategoriaSchema.index(
    { usuarioId: 1, nombreSubcategoria: 1 },
    { unique: true },
);

export default mongoose.model("Subcategoria", subcategoriaSchema, "subcategorias");
