import Cuenta from "../0.1-models/cuenta.model.js";

export const obtenerCuentasService = async (usuarioId) => {
    const cuentas = await Cuenta.find({ usuarioId })
    return cuentas;
}

export const actualizarCuentaService = async (usuarioId, id, data) => {
    const cuentaActualizada = await Cuenta.findOneAndUpdate({ _id: id, usuarioId }, data, { returnDocument: "after" });
    return cuentaActualizada;
}

export const crearCuentaService = async (usuarioId, data) => {
    const nuevaCuenta = new Cuenta({ usuarioId: usuarioId, ...data });
    await nuevaCuenta.save();
    return nuevaCuenta;
}

export const eliminarCuentaService = async (usuarioId, id) => {
    const cuentaEliminada = await Cuenta.findOneAndDelete({ _id: id, usuarioId });
    return cuentaEliminada;
}

export const eliminarTodasLasCuentasService = async (usuarioId) => {
    const cuentasEliminadas = await Cuenta.deleteMany({ usuarioId });
    return cuentasEliminadas;
}