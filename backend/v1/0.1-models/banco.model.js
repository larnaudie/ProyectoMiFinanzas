import mongoose from "mongoose";

const bancoSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    nombreBanco: {
        type: String,
        required: true,
        unique: true
    },
    cuentas: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cuenta"
    }],

});

export default mongoose.model("Banco", bancoSchema, "bancos");