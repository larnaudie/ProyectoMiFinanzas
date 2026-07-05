import mongoose from "mongoose";

const movimientoImportadoSchema = new mongoose.Schema({
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
  gastoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gasto",
    default: null,
  },
  referenciaBanco: {
    type: String,
    default: null,
  },
  fechaBanco: {
    type: Date,
    required: true,
  },
  detalleOriginal: {
    type: String,
    required: true,
  },
  detalleNormalizado: {
    type: String,
    required: true,
  },
  montoBancario: {
    type: Number,
    required: true,
  },
  moneda: {
    type: String,
    default: "UYU",
  },
  hashBanco: {
    type: String,
    required: true,
    unique: true,
  },
  estadoImportacion: {
    type: String,
    enum: ["pendiente", "vinculado", "ignorado"],
    default: "pendiente",
  },
  archivoNombre: {
    type: String,
    default: null,
  },
}, { timestamps: true });

movimientoImportadoSchema.index({ usuarioId: 1, cuentaId: 1, estadoImportacion: 1 });

export default mongoose.model(
  "MovimientoImportado",
  movimientoImportadoSchema,
  "movimientosImportados"
);