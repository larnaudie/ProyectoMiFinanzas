import {
  obtenerBancosService,
  actualizarBancoService,
  crearBancoService,
  eliminarBancoService,
  eliminarTodosLosBancosService,
} from "../3-services/banco.service.js";

export const obtenerBancos = async (req, res, next) => {
  try {
    const bancosObtenidos = await obtenerBancosService(req.user.id);
    res.status(200).json({
      message: "Bancos obtenidos",
      bancos: bancosObtenidos,
    });
  } catch (error) {
    next(error);
  }
};

export const crearBanco = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const bancoCreado = await crearBancoService(usuarioId, req.body);
    res.status(201).json({
      message: `Banco ${bancoCreado.id} creado exitosamente`,
      banco: bancoCreado,
    });
  } catch (error) {
    next(error);
  }
};

export const actualizarBanco = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const bancoActualizado = await actualizarBancoService(usuarioId, id, req.body);
    res.status(201).json({
      message: `Banco ${bancoActualizado.id} actualizado exitosamente`,
      banco: bancoActualizado,
    });
  } catch (error) {
    next(error);
  }
};

export const eliminarBanco = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const bancoEliminado = await eliminarBancoService(usuarioId, id);
    res.status(200).json({
      message: `Banco ${bancoEliminado.id} eliminado exitosamente`,
      banco: bancoEliminado,
    });
  } catch (error) {
    next(error);
  }
};

export const eliminarTodosLosBancos = async (req, res, next) => {
  try {
    const bancosEliminados = await eliminarTodosLosBancosService(req.user.id);
    res.status(200).json({
      message: `Todos los bancos eliminados exitosamente`,
      bancos: bancosEliminados,
    });
  } catch (error) {
    next(error);
  }
};
