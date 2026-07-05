import {
    obtenerUsuarioPorIdService,
    obtenerUsuariosService,
    actualizarUsuarioService
} from "../3-services/usuario.service.js";

export const obtenerUsuarios = async (req, res) => {
    const usuariosObtenidos = await obtenerUsuariosService();
    res.json({ message: "Usuarios obtenidos", usuarios: usuariosObtenidos });
}

export const obtenerUsuarioPorId = async (req, res) => {
    const { id } = req.params;
    const usuarioObtenido = await obtenerUsuarioPorIdService(id);
    res.status(200).json({ message: `Usuario ${usuarioObtenido.id} obtenido con exito`, usuario: usuarioObtenido });
}

export const actualizarUsuario = async (req, res) => {
    const { id } = req.params;
    const usuarioActualizado = await actualizarUsuarioService(id, req.body);
    res.status(200).json({ message: `Usuario ${usuarioActualizado.id} actualizado exitosamente`, ...usuarioActualizado });
}