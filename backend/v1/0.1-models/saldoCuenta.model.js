import mongoose from "mongoose";
import { MONEDAS_SOPORTADAS } from "../utils/monedas.js";

const saldoCuentaSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  cuentaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cuenta",
    required: true,
  },
  fecha: {
    type: Date,
    required: true,
  },
  monto: {
    type: Number,
    required: true,
  },
  moneda: {
    type: String,
    enum: MONEDAS_SOPORTADAS,
    required: true,
  },
  hashBanco: {
    type: String,
    required: true,
  },
  referenciaBanco: {
    type: String,
    default: null,
  },
  detalleOriginal: {
    type: String,
    default: null,
  },
  filaExcel: {
    type: Number,
    default: null,
  },
  archivoNombre: {
    type: String,
    default: null,
  },
  cuentaBanco: {
    type: String,
    default: null,
  },
}, { timestamps: true });

saldoCuentaSchema.index(
  { usuarioId: 1, cuentaId: 1, hashBanco: 1 },
  { unique: true },
);
saldoCuentaSchema.index({ usuarioId: 1, cuentaId: 1, fecha: -1 });

export default mongoose.model("SaldoCuenta", saldoCuentaSchema, "saldosCuentas");
