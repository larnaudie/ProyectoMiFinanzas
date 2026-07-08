import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import React, { useState } from "react";
import { logout } from "../features/slices/authSlice.js";
import Navbar from "./HomePage/Navbar/NavBarPage.jsx";
import Sidebar from "./HomePage/Sidebar/SideBarPage.jsx";

function AppLayout() {
  const [menuAbierto, setMenuAbierto] = useState(true);

  const alternarMenu = () => {
    setMenuAbierto(!menuAbierto);
  };

  return (
    <div className="app-shell">
      {/* El Navbar va solo, arriba de todo */}
      <Navbar alternarMenu={alternarMenu} />
      <div className="app-body">
        <Sidebar abierto={menuAbierto} />
        {/* El contenedor principal envuelve el Sidebar y el Contenido */}
        <main className="dashboard-contenedor">
          <section className="contenido-principal">
            <Outlet />
          </section>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
