import { Outlet } from "react-router-dom";
import { useState } from "react";
import Navbar from "./HomePage/Navbar/NavBarPage.jsx";
import Sidebar from "./HomePage/Sidebar/SideBarPage.jsx";

function AppLayout() {
  const [menuAbierto, setMenuAbierto] = useState(true);

  return (
    <div className="app-shell">
      <Navbar alternarMenu={() => setMenuAbierto((abierto) => !abierto)} />
      <div className="app-body">
        <Sidebar abierto={menuAbierto} />
        <main className="dashboard-contenedor">
          <section className="contenido-principal"><Outlet /></section>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
