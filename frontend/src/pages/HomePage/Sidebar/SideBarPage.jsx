import { NavLink, useParams } from "react-router-dom";

const iconos = {
  home: <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9Z" />,
  movimientos: <path d="M4 6h16M4 12h16M4 18h10M7 3v6M17 9v6M11 15v6" />,
  analisis: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2M17 4l2 2 3-3" />,
  manage: <path d="M4 5h10M18 5h2M4 12h3M11 12h9M4 19h10M18 19h2M14 3v4M7 10v4M14 17v4" />,
  prestamos: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h4" />,
  dashboard: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  desglose: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
};

function NavIcon({ nombre }) {
  return (
    <svg className="sidebar-icon" aria-hidden="true" viewBox="0 0 24 24">
      {iconos[nombre]}
    </svg>
  );
}

const claseLink = ({ isActive }) => `sidebar-link${isActive ? " active" : ""}`;

function Sidebar({ abierto, fijado, alEntrar, alSalir }) {
  const { cuentaId } = useParams();

  return (
    <aside
      className={`sidebar ${abierto ? "sidebar-open" : "sidebar-collapsed"}${fijado ? " sidebar-pinned" : ""}`}
      onMouseEnter={alEntrar}
      onMouseLeave={alSalir}
    >
      <nav className="sidebar-nav" aria-label="Navegación principal">
        <span className="sidebar-section-label">General</span>
        <NavLink className={claseLink} to="/home" title="Inicio" aria-label="Inicio" end>
          <NavIcon nombre="home" />
          <span>Inicio</span>
        </NavLink>
        <NavLink className={claseLink} to="/movimientos" title="Movimientos" aria-label="Movimientos">
          <NavIcon nombre="movimientos" />
          <span>Movimientos</span>
        </NavLink>
        <NavLink className={claseLink} to="/analisis" title="Checklist mensual" aria-label="Checklist de pagos mensuales">
          <NavIcon nombre="analisis" />
          <span>Checklist</span>
        </NavLink>
        <NavLink className={claseLink} to="/manage" title="Administrar" aria-label="Administrar">
          <NavIcon nombre="manage" />
          <span>Administrar</span>
        </NavLink>
        <NavLink className={claseLink} to="/prestamos" title="Deudas y préstamos" aria-label="Deudas y préstamos">
          <NavIcon nombre="prestamos" />
          <span>Deudas</span>
        </NavLink>

        {cuentaId && (
          <div className="sidebar-account-links">
            <span className="sidebar-section-label">Cuenta actual</span>
            <NavLink
              className={claseLink}
              to={`/cuentas/${cuentaId}/dashboard`}
              title="Dashboard de la cuenta"
              aria-label="Dashboard de la cuenta"
            >
              <NavIcon nombre="dashboard" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink
              className={claseLink}
              to={`/cuentas/${cuentaId}/gastos`}
              title="Desglose de la cuenta"
              aria-label="Desglose de la cuenta"
            >
              <NavIcon nombre="desglose" />
              <span>Desglose</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="sidebar-security">
        <span className="sidebar-security-dot" />
        <span>
          <strong>Datos privados</strong>
          <small>Tu información está protegida</small>
        </span>
      </div>
    </aside>
  );
}

export default Sidebar;
