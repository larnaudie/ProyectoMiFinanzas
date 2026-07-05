import {
  obtenerCategoriasService,
  actualizarCategoriaService,
  crearCategoriaService,
  eliminarCategoriaService,
  eliminarTodasLasCategoriasService,
} from "../3-services/categoria.service.js";

export const obtenerCategorias = async (req, res, next) => {
  try {
    const categoriasObtenidas = await obtenerCategoriasService(req.user.id);
    res.status(200).json({
      message: "Categorías obtenidas",
      categorias: categoriasObtenidas,
    });
  } catch (error) {
    next(error);
  }
};

export const crearCategoria = async (req, res, next) => {
  try {
    const categoriaCreada = await crearCategoriaService(req.user.id, { ...req.body });
    res.status(201).json({
      message: `Categoría ${categoriaCreada.id} creada exitosamente`,
      categoria: categoriaCreada,
    });
  } catch (error) {
    next(error);
  }
};

export const actualizarCategoria = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const categoriaActualizada = await actualizarCategoriaService(usuarioId, id, req.body);
    res.status(201).json({
      message: `Categoría ${categoriaActualizada.id} actualizada exitosamente`,
      categoria: categoriaActualizada,
    });
  } catch (error) {
    next(error);
  }
};

export const eliminarCategoria = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const categoriaEliminada = await eliminarCategoriaService(usuarioId, id);
    res.status(200).json({
      message: `Categoría ${categoriaEliminada.id} eliminada exitosamente`,
      categoria: categoriaEliminada,
    });
  } catch (error) {
    next(error);
  }
};

export const eliminarTodasLasCategorias = async (req, res, next) => {
  try {
    const categoriasEliminadas = await eliminarTodasLasCategoriasService(req.user.id);
    res.status(200).json({
      message: "Todas las categorías eliminadas exitosamente",
      categorias: categoriasEliminadas,
    });
  } catch (error) {
    next(error);
  } 
}

