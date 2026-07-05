import Usuario from "../0.1-models/usuario.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const registrarUsuarioService = async (data) => {
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
      username: data.username,
      password: passwordHash,
      rol: rolFinal,
    });
  } else {
    nuevoUsuario = new Usuario({
      username: data.username,
      password: passwordHash,
      rol: rolFinal,
    });
  }

  await nuevoUsuario.save();
  // OWASP: Incluir rol en el token para verificación de permisos
  const token = jwt.sign(
    { id: nuevoUsuario._id, rol: nuevoUsuario.rol },
    process.env.SECRET_KEY,
    { expiresIn: "1d" },
  );
  return { token };
};

export const loginUsuarioService = async (username, password) => {
  const usuario = await Usuario.findOne({ username });
  if (!usuario) return { message: "Credenciales inválidas" };

  const isMatch = bcrypt.compareSync(password, usuario.password);
  if (!isMatch) return { message: "Credenciales inválidas" };

  const payload = { id: usuario._id, rol: usuario.rol };

  const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "1d" });
  return { token, id: usuario._id, rol: usuario.rol };
};
