import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../../../features/slices/authSlice.js";

const Navbar = ({
  alternarMenu,
  menuAbierto,
  menuFijado,
  alEntrarMenu,
  alSalirMenu,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const menuUsuarioRef = useRef(null);
  const disparadorRef = useRef(null);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const usuarioGuardado = localStorage.getItem("usuario");
  let usuario;

  try {
    usuario = usuarioGuardado ? JSON.parse(usuarioGuardado) : null;
  } catch {
    usuario = null;
  }

  const nombreUsuario = usuario?.username || "Usuario";
  const inicialUsuario = nombreUsuario.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    if (!menuUsuarioAbierto) return undefined;

    const cerrarAlClickearAfuera = (event) => {
      if (!menuUsuarioRef.current?.contains(event.target)) {
        setMenuUsuarioAbierto(false);
      }
    };

    const cerrarConEscape = (event) => {
      if (event.key === "Escape") {
        setMenuUsuarioAbierto(false);
        disparadorRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", cerrarAlClickearAfuera);
    document.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.removeEventListener("pointerdown", cerrarAlClickearAfuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [menuUsuarioAbierto]);

  const cerrarSesion = () => {
    setMenuUsuarioAbierto(false);
    dispatch(logout());
    navigate("/", { replace: true });
  };

  return (
    <header className="navbar">
      <div className="navbar-leading">
        <button
          type="button"
          onClick={alternarMenu}
          onMouseEnter={alEntrarMenu}
          onMouseLeave={alSalirMenu}
          className={`menu-hamburguesa${menuFijado ? " pinned" : ""}`}
          aria-label={menuFijado ? "Liberar menú" : "Fijar menú"}
          aria-expanded={menuAbierto}
          aria-pressed={menuFijado}
          title={menuFijado ? "Liberar menú" : "Fijar menú"}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <div className="app-brand">
          <span className="app-brand-mark">$</span>
          <span className="app-brand-copy">
            <strong>MiFinanzas</strong>
            <small>Control personal</small>
          </span>
        </div>
      </div>

      <div className="user-menu" ref={menuUsuarioRef}>
        <button
          ref={disparadorRef}
          type="button"
          className={`usuario-info usuario-trigger${menuUsuarioAbierto ? " open" : ""}`}
          aria-haspopup="menu"
          aria-expanded={menuUsuarioAbierto}
          onClick={() => setMenuUsuarioAbierto((abierto) => !abierto)}
        >
          <span className="usuario-copy">
            <small>Bienvenido</small>
            <strong>{nombreUsuario}</strong>
          </span>
          <span className="avatar" aria-hidden="true">{inicialUsuario}</span>
          <svg className="user-menu-chevron" aria-hidden="true" viewBox="0 0 24 24">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>

        {menuUsuarioAbierto && (
          <div className="user-dropdown" role="menu">
            <div className="user-dropdown-header">
              <span className="avatar user-dropdown-avatar" aria-hidden="true">{inicialUsuario}</span>
              <span>
                <strong>{nombreUsuario}</strong>
                <small>{usuario?.rol === "admin" ? "Administrador" : "Usuario"}</small>
              </span>
            </div>
            <div className="user-dropdown-divider" />
            <Link
              className="user-menu-item"
              role="menuitem"
              to="/perfil"
              onClick={() => setMenuUsuarioAbierto(false)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />
              </svg>
              Mi perfil
            </Link>
            <button className="user-menu-item user-menu-logout" role="menuitem" type="button" onClick={cerrarSesion}>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
