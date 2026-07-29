export const limpiarNombreUsuario = (username) =>
  String(username || "")
    .trim()
    .replace(/\s+/g, " ");

export const normalizarNombreUsuario = (username) =>
  limpiarNombreUsuario(username)
    .normalize("NFKC")
    .toLocaleLowerCase("es");

export const escaparRegex = (texto) =>
  String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const crearFiltroNombreUsuario = (username) => {
  const nombreLimpio = limpiarNombreUsuario(username);

  return {
    $or: [
      { usernameNormalizado: normalizarNombreUsuario(nombreLimpio) },
      {
        username: {
          $regex: `^${escaparRegex(nombreLimpio)}$`,
          $options: "i",
        },
      },
    ],
  };
};

export const crearErrorNombreUsuarioInvalido = () => {
  const error = new Error("Nombre de usuario inválido. Intentá con otro.");
  error.status = 400;
  return error;
};
