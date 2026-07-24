import mongoose from "mongoose";

const cuentaSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    nombreCuenta: {
        type: String,
        required: true
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
        default: "UYU"
    },
    orden: {
        type: Number,
        default: 0
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

export default mongoose.model("Cuenta", cuentaSchema, "cuentas");
