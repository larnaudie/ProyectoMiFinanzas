import { Outlet } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Navbar from "./HomePage/Navbar/NavBarPage.jsx";
import Sidebar from "./HomePage/Sidebar/SideBarPage.jsx";

function AppLayout() {
  const [menuFijado, setMenuFijado] = useState(false);
  const [menuHover, setMenuHover] = useState(false);
  const cerrarMenuTimerRef = useRef(null);
  const menuAbierto = menuFijado || menuHover;

  const cancelarCierreMenu = () => clearTimeout(cerrarMenuTimerRef.current);

  const abrirMenuTemporal = () => {
    cancelarCierreMenu();
    if (!menuFijado) setMenuHover(true);
  };

  const cerrarMenuTemporal = () => {
    cancelarCierreMenu();
    cerrarMenuTimerRef.current = setTimeout(() => {
      if (!menuFijado) setMenuHover(false);
    }, 180);
  };

  const alternarMenuFijado = () => {
    cancelarCierreMenu();
    setMenuFijado((actual) => {
      const siguiente = !actual;
      const admiteHover = window.matchMedia?.("(hover: hover)").matches;
      setMenuHover(!siguiente && Boolean(admiteHover));
      return siguiente;
    });
  };

  useEffect(() => () => clearTimeout(cerrarMenuTimerRef.current), []);

  return (
    <div className="app-shell">
      <Navbar
        alternarMenu={alternarMenuFijado}
        menuAbierto={menuAbierto}
        menuFijado={menuFijado}
        alEntrarMenu={abrirMenuTemporal}
        alSalirMenu={cerrarMenuTemporal}
      />
      <div className="app-body">
        <div
          className={`sidebar-hover-zone${menuFijado ? " hidden" : ""}`}
          onMouseEnter={abrirMenuTemporal}
          onMouseLeave={cerrarMenuTemporal}
          aria-hidden="true"
        />
        <Sidebar
          abierto={menuAbierto}
          fijado={menuFijado}
          alEntrar={abrirMenuTemporal}
          alSalir={cerrarMenuTemporal}
        />
        <main className="dashboard-contenedor">
          <section className="contenido-principal"><Outlet /></section>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
