import mongoose from "mongoose";
import {
  limpiarNombreUsuario,
  normalizarNombreUsuario,
} from "../utils/usuario.js";

const usuarioSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  usernameNormalizado: {
    type: String,
    unique: true,
    sparse: true,
    select: false,
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

usuarioSchema.pre("validate", function normalizarUsername() {
  if (!this.isModified("username")) return;

  this.username = limpiarNombreUsuario(this.username);
  this.usernameNormalizado = normalizarNombreUsuario(this.username);
});

export default mongoose.model("Usuario", usuarioSchema, "usuarios");
