import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../../../features/slices/authSlice.js";

const Navbar = ({
  alternarMenu,
  menuAbierto,
  menuFijado,
  alEntrarMenu,
  alSalirMenu,
  cuentaActual,
  cuentas = [],
  cuentaId,
}) => {
  const dispatch = useDispatch();
  const {
    usuario: nombreUsuarioEstado,
    rol: rolUsuarioEstado,
  } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();
  const menuUsuarioRef = useRef(null);
  const menuCrearRef = useRef(null);
  const disparadorRef = useRef(null);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [menuCrearAbierto, setMenuCrearAbierto] = useState(false);
  const usuarioGuardado = localStorage.getItem("usuario");
  let usuario;

  try {
    usuario = usuarioGuardado ? JSON.parse(usuarioGuardado) : null;
  } catch {
    usuario = null;
  }

  const nombreUsuario = nombreUsuarioEstado || usuario?.username || "Usuario";
  const rolUsuario = rolUsuarioEstado || usuario?.rol;
  const inicialUsuario = nombreUsuario.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    if (!menuUsuarioAbierto && !menuCrearAbierto) return undefined;

    const cerrarAlClickearAfuera = (event) => {
      if (!menuUsuarioRef.current?.contains(event.target)) {
        setMenuUsuarioAbierto(false);
      }
      if (!menuCrearRef.current?.contains(event.target)) {
        setMenuCrearAbierto(false);
      }
    };

    const cerrarConEscape = (event) => {
      if (event.key === "Escape") {
        setMenuUsuarioAbierto(false);
        setMenuCrearAbierto(false);
        disparadorRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", cerrarAlClickearAfuera);
    document.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.removeEventListener("pointerdown", cerrarAlClickearAfuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [menuCrearAbierto, menuUsuarioAbierto]);

  useEffect(() => {
    setMenuCrearAbierto(false);
    setMenuUsuarioAbierto(false);
  }, [location.pathname, location.search]);

  const cambiarCuenta = (event) => {
    const nuevaCuentaId = event.target.value;
    if (!nuevaCuentaId) {
      navigate(location.pathname.includes("dashboard") ? "/dashboard" : "/movimientos");
      return;
    }

    if (location.pathname.includes("dashboard")) {
      navigate(`/cuentas/${nuevaCuentaId}/dashboard`);
      return;
    }
    if (location.pathname.includes("importar")) {
      navigate(`/cuentas/${nuevaCuentaId}/importar-excel`);
      return;
    }
    navigate(`/cuentas/${nuevaCuentaId}/gastos`);
  };

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

      <div className="navbar-account-slot">
        <label className="navbar-account-context" title={cuentaActual?.nombreCuenta || "Todas las cuentas"}>
            <span className="navbar-account-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 7h16v12H4zM7 7V5h10v2M8 12h8M8 16h5" />
              </svg>
            </span>
            <span className="navbar-account-copy">
              <small>Cuenta de trabajo</small>
              <select
                aria-label="Seleccionar cuenta de trabajo"
                value={cuentaId || ""}
                onChange={cambiarCuenta}
              >
                <option value="">Todas las cuentas</option>
                {cuentas.map((cuenta) => (
                  <option key={cuenta._id} value={cuenta._id}>{cuenta.nombreCuenta}</option>
                ))}
              </select>
            </span>
        </label>
      </div>

      <div className="navbar-actions">
        <div className="navbar-create" ref={menuCrearRef}>
          <button
            className="navbar-create-button"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuCrearAbierto}
            onClick={() => setMenuCrearAbierto((abierto) => !abierto)}
          >
            + Crear
          </button>
          {menuCrearAbierto && (
            <div className="navbar-create-menu" role="menu">
              <Link to={cuentaId ? `/cuentas/${cuentaId}/gastos?crear=gasto` : "/home#crear-rapido"}>Nuevo gasto</Link>
              <Link to={cuentaId ? `/cuentas/${cuentaId}/importar-excel` : "/importar"}>Importar Excel</Link>
              <Link to="/prestamos#deudas-cobrar">Nueva deuda</Link>
              <Link to="/manage?crear=categorias">Nueva categoría</Link>
              <Link to="/manage?crear=subcategorias">Nueva subcategoría</Link>
              <Link to="/manage?crear=bancos">Nuevo banco</Link>
              <Link to="/manage?crear=cuentas">Nueva cuenta</Link>
            </div>
          )}
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
                <small>{rolUsuario === "admin" ? "Administrador" : "Usuario"}</small>
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
      </div>
    </header>
  );
};

export default Navbar;
