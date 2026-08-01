import Subcategoria from "../0.1-models/subcategoria.model.js";

const limpiarCategoriaVacia = (data) => {
    const dataLimpia = { ...data };

    if (dataLimpia.categoria === "" || dataLimpia.categoria === null) {
        delete dataLimpia.categoria;
    }

    return dataLimpia;
};

export const obtenerSubcategoriasService = async (usuarioId) => {
    const subcategorias = await Subcategoria.find({ usuarioId }).populate("categoria", "nombreCategoria");
    return subcategorias;
}

export const actualizarSubcategoriaService = async (usuarioId, id, data) => {
    const quitarCategoria = data.categoria === "" || data.categoria === null;
    const datosActualizados = limpiarCategoriaVacia(data);
    const actualizacion = quitarCategoria
        ? { $set: datosActualizados, $unset: { categoria: "" } }
        : { $set: datosActualizados };
    const subcategoriaActualizada = await Subcategoria.findOneAndUpdate(
        { _id: id, usuarioId },
        actualizacion,
        { returnDocument: "after" },
    );
    return subcategoriaActualizada;
}

export const crearSubcategoriaService = async (usuarioId, data) => {
    const nuevaSubcategoria = new Subcategoria({ usuarioId: usuarioId, ...limpiarCategoriaVacia(data) });
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
