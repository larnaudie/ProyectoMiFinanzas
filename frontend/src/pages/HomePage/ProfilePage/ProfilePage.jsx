import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { actualizarNombreUsuario } from "../../../features/slices/authSlice.js";
import { api } from "../../../services/api.js";

function ProfilePage() {
  const dispatch = useDispatch();
  const { id, rol, usuario } = useSelector((state) => state.auth);
  const nombreUsuario = usuario || "Usuario";
  const inicialUsuario = nombreUsuario.trim().charAt(0).toUpperCase() || "U";
  const [username, setUsername] = useState(nombreUsuario);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setUsername(nombreUsuario);
  }, [nombreUsuario]);

  const usernameLimpio = useMemo(
    () => username.trim().replace(/\s+/g, " "),
    [username],
  );
  const usernameValido = usernameLimpio.length >= 3 && usernameLimpio.length <= 30;
  const nombreSinCambios = usernameLimpio === nombreUsuario;

  const guardarNombreUsuario = async (event) => {
    event.preventDefault();
    if (!usernameValido || nombreSinCambios || guardando) return;

    setGuardando(true);
    setMensaje("");
    setError("");

    try {
      const { data } = await api.patch("/usuarios/me", {
        username: usernameLimpio,
      });
      const nombreActualizado = data.usuario.username;
      const usuarioGuardado = localStorage.getItem("usuario");
      let sesionGuardada = {};

      try {
        sesionGuardada = usuarioGuardado ? JSON.parse(usuarioGuardado) : {};
      } catch {
        sesionGuardada = {};
      }

      localStorage.setItem("usuario", JSON.stringify({
        ...sesionGuardada,
        id: data.usuario.id || id,
        rol: data.usuario.rol || rol,
        username: nombreActualizado,
      }));
      dispatch(actualizarNombreUsuario(nombreActualizado));
      setMensaje("Nombre de usuario actualizado correctamente.");
    } catch (apiError) {
      const mensajeValidacion = apiError.response?.data?.error?.[0]?.message;
      setError(
        apiError.response?.data?.message
        || mensajeValidacion
        || "No se pudo actualizar el nombre de usuario.",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="page-section profile-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Mi cuenta</p>
          <h1>Mi perfil</h1>
          <p>Información básica de tu sesión actual.</p>
        </div>
      </header>

      <article className="profile-card">
        <header className="profile-card-header">
          <span className="profile-avatar" aria-hidden="true">{inicialUsuario}</span>
          <div>
            <h2>{nombreUsuario}</h2>
            <p>{rol === "admin" ? "Administrador" : "Usuario"}</p>
          </div>
        </header>

        <dl className="profile-details">
          <div className="profile-username-row">
            <dt>Nombre de usuario</dt>
            <dd>
              <form className="profile-username-form" onSubmit={guardarNombreUsuario}>
                <input
                  aria-label="Nombre de usuario"
                  autoComplete="username"
                  maxLength={30}
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setMensaje("");
                    setError("");
                  }}
                />
                <button
                  type="submit"
                  disabled={!usernameValido || nombreSinCambios || guardando}
                >
                  {guardando ? "Guardando..." : "Guardar nombre"}
                </button>
              </form>
              <small className="profile-field-help">
                Usá entre 3 y 30 caracteres.
              </small>
              {mensaje && <p className="profile-message success-text" role="status">{mensaje}</p>}
              {error && <p className="profile-message error-text" role="alert">{error}</p>}
            </dd>
          </div>
          <div className="profile-role-row">
            <dt>Rol</dt>
            <dd>{rol === "admin" ? "Administrador" : "Usuario"}</dd>
          </div>
          <div className="profile-id-row">
            <dt>Identificador</dt>
            <dd>{id || "No disponible"}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}

export default ProfilePage;
