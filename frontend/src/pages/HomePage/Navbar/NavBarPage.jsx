import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { guardarGastos } from "../../../features/slices/gastosSlice";

const Navbar = ({ alternarMenu }) => {
  const usuarioGuardado = localStorage.getItem("usuario");
  const usuario = usuarioGuardado ? JSON.parse(usuarioGuardado) : null;
  const nombreUsuario = usuario?.username || "Usuario";

  return (
    <header className="navbar">
      <button onClick={alternarMenu} className="menu-hamburguesa">
        ☰
      </button>

      <div className="usuario-info">
        <span>Bienvenido {nombreUsuario}</span>
        <Link to="/perfil" className="avatar">
          👤
        </Link>
      </div>
    </header>
  );
};

export default Navbar;
