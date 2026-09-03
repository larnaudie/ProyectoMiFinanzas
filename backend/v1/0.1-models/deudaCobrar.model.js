import mongoose from "mongoose";
import { MONEDAS_SOPORTADAS } from "../utils/monedas.js";

const cotizacionSchema = new mongoose.Schema({
  fuente: { type: String, default: "Banco Central del Uruguay" },
  fecha: { type: Date, default: null },
  uyuPorDolar: { type: Number, default: null },
  uyuPorUi: { type: Number, default: null },
}, { _id: false });

const cobroSchema = new mongoose.Schema({
  gastoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gasto",
    required: true,
  },
  fecha: { type: Date, required: true },
  montoOriginal: { type: Number, required: true, min: 0 },
  monedaOriginal: {
    type: String,
    enum: MONEDAS_SOPORTADAS,
    required: true,
  },
  montoAplicado: { type: Number, required: true, min: 0 },
  cotizacion: { type: cotizacionSchema, default: () => ({}) },
}, { timestamps: true });

const deudaCobrarSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
    index: true,
  },
  nombre: { type: String, required: true, trim: true },
  deudor: { type: String, required: true, trim: true },
  monedaCapital: {
    type: String,
    enum: MONEDAS_SOPORTADAS,
    required: true,
  },
  capitalOriginal: { type: Number, required: true, min: 0 },
  fechaInicio: { type: Date, default: null },
  estado: {
    type: String,
    enum: ["activa", "saldada"],
    default: "activa",
    index: true,
  },
  saldadaEn: { type: Date, default: null },
  saldadaManualmente: { type: Boolean, default: false },
  saldoPendienteAlSaldar: { type: Number, min: 0, default: 0 },
  notas: { type: String, trim: true, default: "" },
  cobros: [cobroSchema],
}, { timestamps: true });

deudaCobrarSchema.index({ usuarioId: 1, nombre: 1 }, { unique: true });
deudaCobrarSchema.index({ usuarioId: 1, "cobros.gastoId": 1 });

export default mongoose.model("DeudaCobrar", deudaCobrarSchema, "deudasCobrar");
