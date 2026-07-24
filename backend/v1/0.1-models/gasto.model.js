import mongoose from "mongoose";

const gastoSchema = new mongoose.Schema(
  {
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
      index: true,
    },
    detalle: { type: String, required: true, trim: true },
    cuentaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cuenta",
      required: true,
      index: true,
    },
    fecha: { type: Date },
    montoBancario: { type: Number },
    montoReal: { type: Number, default: 0 },
    porcentaje: { type: Number },
    incluirMontoReal: { type: Boolean, default: false },
    moneda: { type: String, enum: ["UYU", "USD"], default: "UYU" },
    estado: {
      type: String,
      enum: ["pendiente", "creado"],
      default: "pendiente",
      index: true,
    },
    categoriaId: { type: mongoose.Schema.Types.ObjectId, ref: "Categoria" },
    subcategoriaId: { type: mongoose.Schema.Types.ObjectId, ref: "Subcategoria" },
    factura: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    tipoMovimiento: {
      type: String,
      enum: ["manual", "compra", "pago", "cuota", "reintegro"],
      default: "manual",
    },
    origen: {
      tipo: {
        type: String,
        enum: ["manual", "tarjeta", "prestamo", "excel"],
        default: "manual",
      },
      referenciaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Gasto",
        default: null,
      },
    },
    tarjetaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tarjeta",
      default: null,
      index: true,
    },
    resumenTarjetaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResumenTarjeta",
      default: null,
      index: true,
    },
    hashImportacion: { type: String, default: null },
    montoOriginalTarjeta: { type: Number, default: null },
    resumenTarjeta: {
      tarjeta: { type: String, default: null },
      cierre: { type: Date, default: null },
      vencimiento: { type: Date, default: null },
      periodo: { type: String, default: null },
      importacionKey: { type: String, default: null },
    },
  },
  { timestamps: true },
);

gastoSchema.index(
  { usuarioId: 1, resumenTarjetaId: 1, hashImportacion: 1 },
  {
    unique: true,
    partialFilterExpression: { hashImportacion: { $type: "string" } },
  },
);

export default mongoose.model("Gasto", gastoSchema, "gastos");
