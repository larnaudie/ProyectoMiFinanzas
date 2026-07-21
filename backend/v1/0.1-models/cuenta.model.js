import mongoose from "mongoose";

const cuentaSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    nombreCuenta: {
        type: String,
        required: true,
        unique: true
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

export default mongoose.model("Cuenta", cuentaSchema, "cuentas");