import mongoose from "mongoose";
import Subcategoria from "../0.1-models/subcategoria.model.js";
import Gasto from "../0.1-models/gasto.model.js";

const limpiarCategoriaVacia = (data) => {
    const dataLimpia = { ...data };

    if (dataLimpia.categoria === "" || dataLimpia.categoria === null) {
        delete dataLimpia.categoria;
    }

    return dataLimpia;
};

export const obtenerSubcategoriasService = async (
    usuarioId,
    { incluirConteos = true } = {},
) => {
    const consultaSubcategorias = Subcategoria.find({ usuarioId })
        .populate("categoria", "nombreCategoria")
        .lean();

    // Los selectores del importador sólo necesitan el catálogo. Evitamos allí
    // recorrer todos los gastos del usuario para calcular un contador que no se
    // muestra en esa pantalla.
    if (!incluirConteos) {
        return consultaSubcategorias;
    }

    const usuarioObjectId = new mongoose.Types.ObjectId(usuarioId);
    const [subcategorias, conteosGastos] = await Promise.all([
        consultaSubcategorias,
        Gasto.aggregate([
            {
                $match: {
                    usuarioId: usuarioObjectId,
                    subcategoriaId: { $ne: null },
                },
            },
            {
                $group: {
                    _id: "$subcategoriaId",
                    cantidadGastos: { $sum: 1 },
                },
            },
        ]),
    ]);
    const conteosPorSubcategoria = new Map(
        conteosGastos.map((conteo) => [
            String(conteo._id),
            Number(conteo.cantidadGastos || 0),
        ]),
    );

    return subcategorias.map((subcategoria) => ({
        ...subcategoria,
        cantidadGastos:
            conteosPorSubcategoria.get(String(subcategoria._id)) || 0,
    }));
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
