import mongoose from "mongoose";
import { MONEDAS_SOPORTADAS } from "../utils/monedas.js";

const pagoSchema = new mongoose.Schema({
  gastoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gasto",
    required: true,
  },
  cuotaNumero: { type: Number, required: true },
  fecha: { type: Date, required: true },
  montoDebitado: { type: Number, required: true },
  monedaDebito: { type: String, enum: MONEDAS_SOPORTADAS, required: true },
  automatico: { type: Boolean, default: true },
}, { _id: false, timestamps: true });

const prestamoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
    index: true,
  },
  nombre: { type: String, required: true, trim: true },
  tipo: {
    type: String,
    enum: ["personal", "auto", "hipotecario", "financiacion", "otro"],
    default: "personal",
  },
  entidad: { type: String, trim: true, default: "" },
  monedaCapital: { type: String, enum: MONEDAS_SOPORTADAS, required: true },
  capitalFinanciado: { type: Number, required: true, min: 0 },
  entregaInicial: {
    monto: { type: Number, default: 0 },
    moneda: { type: String, enum: MONEDAS_SOPORTADAS, default: "USD" },
  },
  tea: { type: Number, required: true, min: 0 },
  plazoCuotas: { type: Number, required: true, min: 1 },
  cuotaTeorica: { type: Number, default: null },
  sistemaAmortizacion: {
    type: String,
    enum: ["frances"],
    default: "frances",
  },
  fechaInicio: { type: Date, default: null },
  diaVencimiento: { type: Number, min: 1, max: 31, default: null },
  estado: {
    type: String,
    enum: ["activo", "pausado", "finalizado"],
    default: "activo",
    index: true,
  },
  notas: { type: String, default: "" },
  reglaDeteccion: {
    activa: { type: Boolean, default: true },
    cuentaId: { type: mongoose.Schema.Types.ObjectId, ref: "Cuenta", default: null },
    subcategoriaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategoria",
      default: null,
    },
    textos: [{ type: String, trim: true }],
    referencia: { type: String, trim: true, default: "" },
    desde: { type: Date, default: null },
  },
  pagos: [pagoSchema],
}, { timestamps: true });

prestamoSchema.index({ usuarioId: 1, nombre: 1 }, { unique: true });
prestamoSchema.index({ usuarioId: 1, "pagos.gastoId": 1 });

export default mongoose.model("Prestamo", prestamoSchema, "prestamos");

