import Categoria from "../0.1-models/categoria.model.js";

export const obtenerCategoriasService = async (usuarioId) => {
  const categorias = await Categoria.find({ usuarioId })
  return categorias;
};

export const actualizarCategoriaService = async (usuarioId, id, data) => {
  const categoriaActualizada = await Categoria.findOneAndUpdate({ _id: id, usuarioId }, data, {
    returnDocument: "after",
  });
  return categoriaActualizada;
};

export const crearCategoriaService = async (usuarioId, data) => {
  const nuevaCategoria = new Categoria({ usuarioId: usuarioId, ...data });
  await nuevaCategoria.save();
  return nuevaCategoria;
};

export const eliminarCategoriaService = async (usuarioId, id) => {
  const categoriaEliminada = await Categoria.findOneAndDelete({ _id: id, usuarioId });
  return categoriaEliminada;
};

export const eliminarTodasLasCategoriasService = async (usuarioId) => {
  const categoriasEliminadas = await Categoria.deleteMany({ usuarioId });
  return categoriasEliminadas;
};
