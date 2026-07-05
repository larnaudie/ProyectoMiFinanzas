import mongoose from "mongoose";

const gastoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  detalle: {
    type: String,
    required: true,
  },
  cuentaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cuenta",
    required: true,
  },
  fecha: {
    type: Date,
  },
  montoBancario: {
    type: Number,
  },
  porcentaje: {
    type: Number,
  },
  montoReal: {
    type: Number,
    default: 0,
  },
  incluirMontoReal: {
    type: Boolean,
    default: false,
  },
  estado: {
    type: String,
    enum: ["pendiente", "creado"],
    default: "pendiente",
  },
  categoriaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Categoria",
  },
  subcategoriaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subcategoria",
  },
  factura: {
  url: {
    type: String,
    default: null
  },
  publicId: {
    type: String,
    default: null
  }
},
  origen: {
    tipo: {
      type: String,
      enum: ["manual", "tarjeta", "prestamo", "excel"],
      default: "manual",
    },
    referenciaId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
});

export default mongoose.model("Gasto", gastoSchema, "gastos");
