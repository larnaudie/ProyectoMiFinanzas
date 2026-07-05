import mongoose from "mongoose";

const usuarioSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
  },
  bancos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Banco",
    },
  ],
  cuentas: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cuenta",
    },
  ],
  gastos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gasto",
    },
  ],
  categorias: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categoria",
    },
  ],
  subcategorias: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategoria",
    },
  ],
  tarjetas: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tarjeta",
    },
  ],
  prestamos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prestamo",
    },
  ],
  rol: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
});

export default mongoose.model("Usuario", usuarioSchema, "usuarios");
