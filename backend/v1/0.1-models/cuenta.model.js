import mongoose from "mongoose";
import { MONEDAS_SOPORTADAS } from "../utils/monedas.js";

const cuentaSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    nombreCuenta: {
        type: String,
        required: true,
        trim: true
    },
    bancoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Banco",
        default: null
    },
    tipoCuenta: {
        type: String,
        enum: ["debito", "credito"],
        default: "debito"
    },
    moneda: {
        type: String,
        enum: MONEDAS_SOPORTADAS,
        default: "UYU"
    },
    monedas: [{
        type: String,
        enum: MONEDAS_SOPORTADAS
    }],
    orden: {
        type: Number,
        default: 0
    },
    saldoActual: {
        type: Number,
        default: null
    },
    saldoActualizadoEn: {
        type: Date,
        default: null
    },
    saldoInformadoAl: {
        type: Date,
        default: null
    },
    saldoOrigen: {
        type: String,
        enum: ["manual", "excel"],
        default: null
    },
    saldoArchivoNombre: {
        type: String,
        default: null
    },
    gastos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Gasto"
    }],
    categorias: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Categoria"
    }],
    subcategorias: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subcategoria"
    }],
    tarjetas : [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tarjeta"
    }],
    prestamos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Prestamo"
    }],
});

cuentaSchema.index({ usuarioId: 1, nombreCuenta: 1 }, { unique: true });
cuentaSchema.index({ usuarioId: 1, orden: 1, _id: 1 });

export default mongoose.model("Cuenta", cuentaSchema, "cuentas");
