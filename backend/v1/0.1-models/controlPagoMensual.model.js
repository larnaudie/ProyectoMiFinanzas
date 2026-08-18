import mongoose from "mongoose";

const controlPagoMensualSchema = new mongoose.Schema(
  {
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
      index: true,
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    subcategoriaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategoria",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

controlPagoMensualSchema.index(
  { usuarioId: 1, subcategoriaId: 1 },
  { unique: true },
);

export default mongoose.model(
  "ControlPagoMensual",
  controlPagoMensualSchema,
  "controlesPagoMensual",
);
