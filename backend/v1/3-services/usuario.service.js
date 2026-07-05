import Usuario from "../0.1-models/usuario.model.js";

export const obtenerUsuariosService = async () => {
    const usuarios = await Usuario.find();
    return usuarios;
}

export const obtenerUsuarioPorIdService = async (id) => {
    const usuario = await Usuario.findById(id);
    return usuario;
}

export const actualizarUsuarioService = async (id, data) => {
    const usuarioActualizado = await Usuario.findByIdAndUpdate(id, data, { returnDocument: "after" });
    return usuarioActualizado;
}
