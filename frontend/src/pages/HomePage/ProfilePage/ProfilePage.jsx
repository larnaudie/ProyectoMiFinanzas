import { useSelector } from "react-redux";

function ProfilePage() {
  const { id, rol, usuario } = useSelector((state) => state.auth);
  const nombreUsuario = usuario || "Usuario";
  const inicialUsuario = nombreUsuario.trim().charAt(0).toUpperCase() || "U";

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
          <div>
            <dt>Nombre de usuario</dt>
            <dd>{nombreUsuario}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{rol === "admin" ? "Administrador" : "Usuario"}</dd>
          </div>
          <div>
            <dt>Identificador</dt>
            <dd>{id || "No disponible"}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}

export default ProfilePage;
