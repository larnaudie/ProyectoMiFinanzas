import mongoose from "mongoose";

const categoriaSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    nombreCategoria: {
        type: String,
        required: true,
        trim: true
    }

});

categoriaSchema.index(
    { usuarioId: 1, nombreCategoria: 1 },
    { unique: true },
);

export default mongoose.model("Categoria", categoriaSchema, "categorias");
