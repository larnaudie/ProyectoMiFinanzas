import mongoose from "mongoose";

const bancoSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    nombreBanco: {
        type: String,
        required: true
    },
    cuentas: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cuenta"
    }],

});

bancoSchema.index({ usuarioId: 1, nombreBanco: 1 }, { unique: true });

export default mongoose.model("Banco", bancoSchema, "bancos");
