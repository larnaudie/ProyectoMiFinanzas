import mongoose from "mongoose";

const tarjetaSchema = new mongoose.Schema(
  {
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
      index: true,
    },
    cuentaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cuenta",
      required: true,
      index: true,
    },
    bancoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Banco",
      default: null,
    },
    nombreTarjeta: {
      type: String,
      required: true,
      trim: true,
    },
    ultimosDigitos: {
      type: String,
      trim: true,
      default: "",
    },
    activa: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

tarjetaSchema.index({ usuarioId: 1, cuentaId: 1, nombreTarjeta: 1 });

export default mongoose.model("Tarjeta", tarjetaSchema, "tarjetas");
