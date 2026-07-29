import Usuario from "../0.1-models/usuario.model.js";
import {
    crearErrorNombreUsuarioInvalido,
    crearFiltroNombreUsuario,
    limpiarNombreUsuario,
    normalizarNombreUsuario,
} from "../utils/usuario.js";

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

const presentarPerfil = (usuario) => ({
    id: usuario._id,
    username: usuario.username,
    rol: usuario.rol,
});

export const obtenerPerfilService = async (usuarioId) => {
    const usuario = await Usuario.findById(usuarioId).select("_id username rol");
    if (!usuario) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
    }

    return presentarPerfil(usuario);
};

export const actualizarPerfilService = async (usuarioId, username) => {
    const nombreLimpio = limpiarNombreUsuario(username);
    const usuarioOcupandoNombre = await Usuario.exists({
        _id: { $ne: usuarioId },
        ...crearFiltroNombreUsuario(nombreLimpio),
    });

    if (usuarioOcupandoNombre) {
        throw crearErrorNombreUsuarioInvalido();
    }

    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
    }

    usuario.username = nombreLimpio;
    usuario.usernameNormalizado = normalizarNombreUsuario(nombreLimpio);

    try {
        await usuario.save();
    } catch (error) {
        if (error?.code === 11000) {
            throw crearErrorNombreUsuarioInvalido();
        }
        throw error;
    }

    return presentarPerfil(usuario);
};
