import mongoose from "mongoose";

const montosPorMonedaSchema = new mongoose.Schema(
  {
    UYU: { type: Number, default: null },
    USD: { type: Number, default: null },
  },
  { _id: false },
);

const resumenTarjetaSchema = new mongoose.Schema(
  {
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
      index: true,
    },
    tarjetaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tarjeta",
      default: null,
      index: true,
    },
    cuentaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cuenta",
      required: true,
      index: true,
    },
    periodo: { type: String, trim: true, default: "" },
    cierre: { type: Date, required: true },
    vencimiento: { type: Date, default: null },
    cuentaTarjetaUltimosDigitos: { type: String, default: "" },
    limiteCredito: { type: montosPorMonedaSchema, default: () => ({}) },
    pagoContado: { type: montosPorMonedaSchema, default: () => ({}) },
    pagoMinimo: { type: montosPorMonedaSchema, default: () => ({}) },
    saldoAnterior: { type: montosPorMonedaSchema, default: () => ({}) },
    saldoFinal: { type: montosPorMonedaSchema, default: () => ({}) },
    importacionKey: { type: String, required: true },
    archivoNombre: { type: String, default: "" },
    cantidadMovimientos: { type: Number, default: 0 },
  },
  { timestamps: true },
);

resumenTarjetaSchema.index(
  { usuarioId: 1, tarjetaId: 1, importacionKey: 1 },
  { unique: true },
);

resumenTarjetaSchema.index(
  { usuarioId: 1, cuentaId: 1, importacionKey: 1 },
  { unique: true },
);

export default mongoose.model(
  "ResumenTarjeta",
  resumenTarjetaSchema,
  "resumenesTarjeta",
);
