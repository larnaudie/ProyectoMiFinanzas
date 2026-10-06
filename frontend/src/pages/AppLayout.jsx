import { matchPath, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { guardarCuentas } from "../features/slices/cuentasSlice.js";
import { api } from "../services/api.js";
import BackNavigationButton from "../components/BackNavigationButton.jsx";
import Navbar from "./HomePage/Navbar/NavBarPage.jsx";
import Sidebar from "./HomePage/Sidebar/SideBarPage.jsx";

function AppLayout() {
  const location = useLocation();
  const dispatch = useDispatch();
  const cuentas = useSelector((state) => state.cuentas.cuentas);
  const [menuFijado, setMenuFijado] = useState(() => window.innerWidth > 900);
  const [cargandoCuentaActual, setCargandoCuentaActual] = useState(false);
  const [errorCuentaActual, setErrorCuentaActual] = useState("");
  const menuAbierto = menuFijado;
  const coincidenciaCuenta = matchPath(
    { path: "/cuentas/:cuentaId/*" },
    location.pathname,
  );
  const cuentaId = coincidenciaCuenta?.params.cuentaId || "";
  const cuentaActual = cuentas.find((cuenta) => cuenta._id === cuentaId) || null;
  const clasesApp = [
    "app-shell",
    "navigation-v2-shell",
    menuAbierto ? "navigation-v2-menu-open" : "navigation-v2-menu-closed",
  ]
    .filter(Boolean)
    .join(" ");

  const alternarMenuFijado = () => {
    setMenuFijado((actual) => !actual);
  };

  useEffect(() => {
    if (cuentas.length > 0) {
      setCargandoCuentaActual(false);
      setErrorCuentaActual(
        cuentaId && !cuentaActual ? "No se pudo encontrar la cuenta solicitada." : "",
      );
      return undefined;
    }

    let solicitudActiva = true;
    setCargandoCuentaActual(true);
    setErrorCuentaActual("");

    api.get("/cuentas")
      .then((response) => {
        if (!solicitudActiva) return;
        dispatch(guardarCuentas(response.data.cuentas || []));
      })
      .catch((error) => {
        console.error("No se pudo identificar la cuenta actual:", error);
        if (solicitudActiva) {
          setErrorCuentaActual(
            error.response?.data?.message || "No se pudo cargar la cuenta.",
          );
        }
      })
      .finally(() => {
        if (solicitudActiva) setCargandoCuentaActual(false);
      });

    return () => {
      solicitudActiva = false;
    };
  }, [cuentaActual, cuentaId, cuentas.length, dispatch]);

  return (
    <div className={clasesApp}>
      <Sidebar abierto={menuAbierto} fijado={menuFijado} />
      <div className="navigation-v2-workspace">
        <Navbar
          alternarMenu={alternarMenuFijado}
          menuAbierto={menuAbierto}
          menuFijado={menuFijado}
          cuentaActual={cuentaActual}
          cuentas={cuentas}
          cuentaId={cuentaId}
          cargandoCuentaActual={cargandoCuentaActual}
        />
        <main className="dashboard-contenedor">
          <section className="contenido-principal">
            <BackNavigationButton />
            <Outlet
              context={{
                menuAbierto,
                cuentaActual,
                cargandoCuentaActual,
                errorCuentaActual,
              }}
            />
          </section>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
