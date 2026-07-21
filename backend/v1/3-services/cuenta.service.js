import Cuenta from "../0.1-models/cuenta.model.js";

export const obtenerCuentasService = async (usuarioId) => {
    const cuentas = await Cuenta.find({ usuarioId }).sort({ orden: 1, _id: 1 });
    return cuentas;
}

export const actualizarCuentaService = async (usuarioId, id, data) => {
    const cuentaActualizada = await Cuenta.findOneAndUpdate({ _id: id, usuarioId }, data, { returnDocument: "after" });
    return cuentaActualizada;
}

export const actualizarOrdenCuentasService = async (usuarioId, cuentas) => {
    const operaciones = cuentas.map((cuenta, index) => ({
        updateOne: {
            filter: { _id: cuenta.id, usuarioId },
            update: { $set: { orden: Number.isFinite(cuenta.orden) ? cuenta.orden : index } },
        },
    }));

    if (operaciones.length > 0) {
        await Cuenta.bulkWrite(operaciones);
    }

    return obtenerCuentasService(usuarioId);
}

export const crearCuentaService = async (usuarioId, data) => {
    const ultimaCuenta = await Cuenta.findOne({ usuarioId }).sort({ orden: -1 });
    const orden = ultimaCuenta ? (ultimaCuenta.orden || 0) + 1 : 0;
    const nuevaCuenta = new Cuenta({ usuarioId: usuarioId, orden, ...data });
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