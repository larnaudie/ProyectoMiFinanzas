import Subcategoria from "../0.1-models/subcategoria.model.js";

export const obtenerSubcategoriasService = async (usuarioId) => {
    const subcategorias = await Subcategoria.find({ usuarioId }).populate("categoria", "nombreCategoria");
    return subcategorias;
}

export const actualizarSubcategoriaService = async (usuarioId, id, data) => {
    const subcategoriaActualizada = await Subcategoria.findOneAndUpdate({ _id: id, usuarioId }, data, { returnDocument: "after" });
    return subcategoriaActualizada;
}

export const crearSubcategoriaService = async (usuarioId, data) => {
    const nuevaSubcategoria = new Subcategoria({ usuarioId: usuarioId, ...data });
    await nuevaSubcategoria.save();
    return nuevaSubcategoria;
}

export const eliminarSubcategoriaService = async (usuarioId, id) => {
    const subcategoriaEliminada = await Subcategoria.findOneAndDelete({ _id: id, usuarioId });
    return subcategoriaEliminada;
}

export const eliminarTodasLasSubcategoriasService = async (usuarioId) => {
    const subcategoriasEliminadas = await Subcategoria.deleteMany({ usuarioId });
    return subcategoriasEliminadas;
}