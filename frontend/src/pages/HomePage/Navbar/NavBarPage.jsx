import { Link } from "react-router-dom";

const Navbar = ({ alternarMenu }) => {
  const usuarioGuardado = localStorage.getItem("usuario");
  const usuario = usuarioGuardado ? JSON.parse(usuarioGuardado) : null;
  const nombreUsuario = usuario?.username || "Usuario";

  return (
    <header className="navbar">
      <button type="button" onClick={alternarMenu} className="menu-hamburguesa" aria-label="Abrir o cerrar menú">☰</button>
      <div className="usuario-info">
        <span>Bienvenido {nombreUsuario}</span>
        <Link to="/perfil" className="avatar" aria-label="Perfil">👤</Link>
      </div>
    </header>
  );
};

export default Navbar;
