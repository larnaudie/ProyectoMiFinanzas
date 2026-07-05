import Banco from "../0.1-models/banco.model.js";

export const obtenerBancosService = async (usuarioId) => {
  const bancos = await Banco.find({ usuarioId })
  return bancos;
};

export const actualizarBancoService = async (usuarioId, id, data) => {
  const bancoActualizado = await Banco.findOneAndUpdate({ _id: id, usuarioId }, data, {
    returnDocument: "after",
  });
  return bancoActualizado;
};

export const crearBancoService = async (usuarioId, data) => {
  const nuevoBanco = new Banco({  usuarioId: usuarioId, ...data, });
  await nuevoBanco.save();
  return nuevoBanco;
};

export const eliminarBancoService = async (usuarioId, id) => {
  const bancoEliminado = await Banco.findOneAndDelete({ _id: id, usuarioId });
  return bancoEliminado;
};

export const eliminarTodosLosBancosService = async (usuarioId) => {
  const bancosEliminados = await Banco.deleteMany({ usuarioId });
  return bancosEliminados;
};
