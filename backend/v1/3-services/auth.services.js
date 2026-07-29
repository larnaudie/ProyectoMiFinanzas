import Usuario from "../0.1-models/usuario.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  crearErrorNombreUsuarioInvalido,
  crearFiltroNombreUsuario,
  limpiarNombreUsuario,
  normalizarNombreUsuario,
} from "../utils/usuario.js";

export const registrarUsuarioService = async (data) => {
  const username = limpiarNombreUsuario(data.username);
  const usuarioExistente = await Usuario.exists(crearFiltroNombreUsuario(username));
  if (usuarioExistente) {
    throw crearErrorNombreUsuarioInvalido();
  }

  const passwordHash = bcrypt.hashSync(
    data.password,
    parseInt(process.env.ROUNDS) || 10,
  );

  let rolFinal = "user";
  if (data.rol === "admin") {
    if (data.codigoAdmin !== process.env.ADMIN_CODE) {
      const error = new Error("Código de administrador inválido");
      error.status = 400;
      throw error;
    }

    rolFinal = "admin";
  }

  let nuevoUsuario;

  if (rolFinal === "user") {
    nuevoUsuario = new Usuario({
      username,
      usernameNormalizado: normalizarNombreUsuario(username),
      password: passwordHash,
      rol: rolFinal,
    });
  } else {
    nuevoUsuario = new Usuario({
      username,
      usernameNormalizado: normalizarNombreUsuario(username),
      password: passwordHash,
      rol: rolFinal,
    });
  }

  try {
    await nuevoUsuario.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw crearErrorNombreUsuarioInvalido();
    }
    throw error;
  }
  // OWASP: Incluir rol en el token para verificación de permisos
  const token = jwt.sign(
    { id: nuevoUsuario._id, rol: nuevoUsuario.rol },
    process.env.SECRET_KEY,
    { expiresIn: "1d" },
  );
  return {
    token,
    id: nuevoUsuario._id,
    rol: nuevoUsuario.rol,
    username: nuevoUsuario.username,
  };
};

export const loginUsuarioService = async (username, password) => {
  const usuario = await Usuario.findOne(crearFiltroNombreUsuario(username));
  if (!usuario) return { message: "Credenciales inválidas" };

  const isMatch = bcrypt.compareSync(password, usuario.password);
  if (!isMatch) return { message: "Credenciales inválidas" };

  const payload = { id: usuario._id, rol: usuario.rol };

  const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "1d" });
  return {
    token,
    id: usuario._id,
    rol: usuario.rol,
    username: usuario.username,
  };
};
