import Cuenta from "../0.1-models/cuenta.model.js";
import {
    normalizarListaMonedas,
    normalizarMoneda,
    obtenerMonedasCuenta,
} from "../utils/monedas.js";

const prepararDatosCuenta = (data, cuentaActual = null) => {
    const tipoCuenta = data.tipoCuenta || cuentaActual?.tipoCuenta || "debito";
    const incluyeSaldo = Object.prototype.hasOwnProperty.call(data, "saldoActual");
    const datosSaldo = incluyeSaldo
        ? {
            saldoActual: data.saldoActual === null ? null : Number(data.saldoActual),
            saldoActualizadoEn: new Date(),
            saldoInformadoAl: data.saldoActual === null ? null : new Date(),
            saldoOrigen: data.saldoActual === null ? null : "manual",
            saldoArchivoNombre: null,
        }
        : {};

    if (tipoCuenta === "credito") {
        const monedas = normalizarListaMonedas(
            data.monedas ?? cuentaActual?.monedas,
            ["UYU", "USD"],
        );
        const monedaSolicitada = normalizarMoneda(
            data.moneda ?? cuentaActual?.moneda,
        );

        return {
            ...data,
            ...datosSaldo,
            tipoCuenta,
            monedas,
            moneda: monedas.includes(monedaSolicitada)
                ? monedaSolicitada
                : monedas[0],
        };
    }

    return {
        ...data,
        ...datosSaldo,
        tipoCuenta,
        moneda: normalizarMoneda(data.moneda ?? cuentaActual?.moneda),
        monedas: [],
    };
};

const presentarCuenta = (cuenta) => {
    const datos = cuenta?.toObject?.() || cuenta;
    if (!datos) return datos;

    return {
        ...datos,
        monedas: obtenerMonedasCuenta(datos),
    };
};

export const obtenerCuentasService = async (usuarioId) => {
    const cuentas = await Cuenta.find({ usuarioId })
        .sort({ orden: 1, _id: 1 })
        .lean();
    return cuentas.map(presentarCuenta);
}

export const actualizarCuentaService = async (usuarioId, id, data) => {
    const cuentaActual = await Cuenta.findOne({ _id: id, usuarioId });
    if (!cuentaActual) return null;

    const datosNormalizados = prepararDatosCuenta(data, cuentaActual);
    const cuentaActualizada = await Cuenta.findOneAndUpdate(
        { _id: id, usuarioId },
        datosNormalizados,
        { returnDocument: "after", runValidators: true },
    );
    return presentarCuenta(cuentaActualizada);
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
    const datosNormalizados = prepararDatosCuenta(data);
    const nuevaCuenta = new Cuenta({
        usuarioId,
        orden,
        ...datosNormalizados,
    });
    await nuevaCuenta.save();
    return presentarCuenta(nuevaCuenta);
}

export const eliminarCuentaService = async (usuarioId, id) => {
    const cuentaEliminada = await Cuenta.findOneAndDelete({ _id: id, usuarioId });
    return cuentaEliminada;
}

export const eliminarTodasLasCuentasService = async (usuarioId) => {
    const cuentasEliminadas = await Cuenta.deleteMany({ usuarioId });
    return cuentasEliminadas;
}
