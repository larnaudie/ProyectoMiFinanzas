import {
  obtenerSubcategoriasService,
  actualizarSubcategoriaService,
  crearSubcategoriaService,
  eliminarSubcategoriaService,
  eliminarTodasLasSubcategoriasService
} from "../3-services/subcategoria.service.js";

export const obtenerSubcategorias = async (req, res, next) => {
  try {
    const subcategoriasObtenidas = await obtenerSubcategoriasService(req.user.id);
    res.json({
      message: "Subcategorías obtenidas",
      subcategorias: subcategoriasObtenidas,
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerSubcategoriaPorId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subcategoriaObtenida = await obtenerSubcategoriaPorIdService(id);
    res.json({
      message: `Subcategoría ${subcategoriaObtenida.id} obtenida con éxito`,
      subcategoria: subcategoriaObtenida,
    });
  } catch (error) {
    next(error);
  }
};

export const crearSubcategoria = async (req, res, next) => {
  try {
    const subcategoriaCreada = await crearSubcategoriaService(req.user.id, req.body);
    res.status(201).json({
      message: `Subcategoría ${subcategoriaCreada.id} creada exitosamente`,
      subcategoria: subcategoriaCreada,
    });
  } catch (error) {
    next(error);
  }
};

export const actualizarSubcategoria = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const subcategoriaActualizada = await actualizarSubcategoriaService(usuarioId, id, req.body);
    res.status(201).json({
      message: `Subcategoría ${subcategoriaActualizada.id} actualizada exitosamente`,
      subcategoria: subcategoriaActualizada,
    });
  } catch (error) {
    next(error);
  }
};

export const eliminarSubcategoria = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const subcategoriaEliminada = await eliminarSubcategoriaService(usuarioId, id);
    res.status(200).json({
      message: `Subcategoría ${subcategoriaEliminada.id} eliminada exitosamente`,
      subcategoria: subcategoriaEliminada,
    });
  } catch (error) {
    next(error);
  }
};

export const eliminarTodasLasSubcategorias = async (req, res, next) => {
  try {
    const subcategoriasEliminadas = await eliminarTodasLasSubcategoriasService(req.user.id);
    res.status(200).json({
      message: "Todas las subcategorías eliminadas exitosamente",
      subcategoria: subcategoriasEliminadas,
    });
  } catch (error) {
    next(error);
  }
};
