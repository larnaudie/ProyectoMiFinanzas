import mongoose from "mongoose";

const TODOS_LOS_MESES = Array.from({ length: 12 }, (_, indice) => indice + 1);

const periodoSchema = new mongoose.Schema(
  {
    anio: { type: Number, required: true, min: 2000, max: 2200 },
    mes: { type: Number, required: true, min: 1, max: 12 },
    creadoEn: { type: Date, default: Date.now },
  },
  { _id: false },
);

const pagoAsignadoSchema = new mongoose.Schema(
  {
    anio: { type: Number, required: true, min: 2000, max: 2200 },
    mes: { type: Number, required: true, min: 1, max: 12 },
    gastoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gasto",
      required: true,
    },
    asignadoEn: { type: Date, default: Date.now },
  },
  { _id: false },
);

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
    mesesActivos: {
      type: [Number],
      default: () => [...TODOS_LOS_MESES],
      validate: {
        validator: (meses) => (
          Array.isArray(meses)
          && meses.length > 0
          && meses.every((mes) => Number.isInteger(mes) && mes >= 1 && mes <= 12)
        ),
        message: "Seleccioná al menos un mes válido",
      },
    },
    excepciones: {
      type: [periodoSchema],
      default: [],
    },
    pagosAsignados: {
      type: [pagoAsignadoSchema],
      default: [],
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
