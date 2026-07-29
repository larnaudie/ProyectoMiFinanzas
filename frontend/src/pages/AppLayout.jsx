import { matchPath, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { guardarCuentas } from "../features/slices/cuentasSlice.js";
import { api } from "../services/api.js";
import Navbar from "./HomePage/Navbar/NavBarPage.jsx";
import Sidebar from "./HomePage/Sidebar/SideBarPage.jsx";

function AppLayout() {
  const location = useLocation();
  const dispatch = useDispatch();
  const cuentas = useSelector((state) => state.cuentas.cuentas);
  const [menuFijado, setMenuFijado] = useState(false);
  const [menuHover, setMenuHover] = useState(false);
  const [cargandoCuentaActual, setCargandoCuentaActual] = useState(false);
  const cerrarMenuTimerRef = useRef(null);
  const menuAbierto = menuFijado || menuHover;
  const coincidenciaCuenta = matchPath(
    { path: "/cuentas/:cuentaId/*" },
    location.pathname,
  );
  const cuentaId = coincidenciaCuenta?.params.cuentaId || "";
  const cuentaActual = cuentas.find((cuenta) => cuenta._id === cuentaId) || null;
  const clasesAppBody = [
    "app-body",
    menuAbierto ? "sidebar-layout-open" : "",
    menuFijado ? "sidebar-layout-pinned" : "",
  ]
    .filter(Boolean)
    .join(" ");

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

  useEffect(() => {
    if (!cuentaId || cuentaActual) {
      setCargandoCuentaActual(false);
      return undefined;
    }

    let solicitudActiva = true;
    setCargandoCuentaActual(true);

    api.get("/cuentas")
      .then((response) => {
        if (!solicitudActiva) return;
        dispatch(guardarCuentas(response.data.cuentas || []));
      })
      .catch((error) => {
        console.error("No se pudo identificar la cuenta actual:", error);
      })
      .finally(() => {
        if (solicitudActiva) setCargandoCuentaActual(false);
      });

    return () => {
      solicitudActiva = false;
    };
  }, [cuentaActual, cuentaId, dispatch]);

  return (
    <div className="app-shell">
      <Navbar
        alternarMenu={alternarMenuFijado}
        menuAbierto={menuAbierto}
        menuFijado={menuFijado}
        alEntrarMenu={abrirMenuTemporal}
        alSalirMenu={cerrarMenuTemporal}
        cuentaActual={cuentaActual}
        cuentaId={cuentaId}
        cargandoCuentaActual={cargandoCuentaActual}
      />
      <div className={clasesAppBody}>
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
          <section className="contenido-principal">
            <Outlet
              context={{
                menuAbierto,
                alEntrarMenu: abrirMenuTemporal,
                alSalirMenu: cerrarMenuTemporal,
              }}
            />
          </section>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
