import mongoose from "mongoose";
import { MONEDAS_SOPORTADAS } from "../utils/monedas.js";

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
  montoReal: {
    type: Number,
    default: 0,
  },
  saldoBanco: {
    type: Number,
    default: null,
  },
  tipoMonto: {
    type: String,
    enum: ["bancario", "real"],
    default: "bancario",
  },
  moneda: {
    type: String,
    enum: MONEDAS_SOPORTADAS,
    default: "UYU",
  },
  hashBanco: {
    type: String,
    required: true,
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
movimientoImportadoSchema.index(
  { usuarioId: 1, cuentaId: 1, hashBanco: 1 },
  { unique: true },
);

export default mongoose.model(
  "MovimientoImportado",
  movimientoImportadoSchema,
  "movimientosImportados"
);
