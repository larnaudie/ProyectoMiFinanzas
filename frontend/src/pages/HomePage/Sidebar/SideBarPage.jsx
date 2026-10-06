import { NavLink, useParams } from "react-router-dom";

const iconos = {
  home: <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9Z" />,
  movimientos: <path d="M4 6h16M4 12h16M4 18h10M7 3v6M17 9v6M11 15v6" />,
  analisis: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2M17 4l2 2 3-3" />,
  manage: <path d="M4 5h10M18 5h2M4 12h3M11 12h9M4 19h10M18 19h2M14 3v4M7 10v4M14 17v4" />,
  prestamos: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h4" />,
  dashboard: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  desglose: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  importar: <path d="M12 3v12M7 8l5-5 5 5M4 15v5h16v-5" />,
  configuracion: <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 12l2-1-2-3-2 .5-1.5-1L15 5h-6l-.5 2.5-1.5 1L5 8l-2 3 2 1v2l-2 1 2 3 2-.5 1.5 1L9 21h6l.5-2.5 1.5-1 2 .5 2-3-2-1v-2Z" />,
};

function NavIcon({ nombre }) {
  return (
    <svg className="sidebar-icon" aria-hidden="true" viewBox="0 0 24 24">
      {iconos[nombre]}
    </svg>
  );
}

const claseLink = ({ isActive }) => `sidebar-link${isActive ? " active" : ""}`;

function Sidebar({ abierto, fijado }) {
  const { cuentaId } = useParams();

  return (
    <aside
      className={`sidebar ${abierto ? "sidebar-open" : "sidebar-collapsed"}${fijado ? " sidebar-pinned" : ""}`}
    >
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">$</span>
        <span className="sidebar-brand-copy">
          <strong>MiFinanzas</strong>
          <small>Control personal</small>
        </span>
      </div>
      <nav className="sidebar-nav" aria-label="Navegación principal">
        <span className="sidebar-section-label">Navegación principal</span>
        <NavLink className={claseLink} to="/home" title="Inicio" aria-label="Inicio" end>
          <NavIcon nombre="home" />
          <span>Inicio</span>
        </NavLink>
        <NavLink className={claseLink} to={cuentaId ? `/cuentas/${cuentaId}/dashboard` : "/dashboard"} title="Dashboard" aria-label="Dashboard">
          <NavIcon nombre="dashboard" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink className={claseLink} to={cuentaId ? `/cuentas/${cuentaId}/gastos` : "/movimientos"} title="Movimientos" aria-label="Movimientos">
          <NavIcon nombre="movimientos" />
          <span>Movimientos</span>
        </NavLink>
        <NavLink className={claseLink} to={cuentaId ? `/cuentas/${cuentaId}/importar-excel` : "/importar"} title="Importar Excel" aria-label="Importar Excel">
          <NavIcon nombre="importar" />
          <span>Importar</span>
        </NavLink>
        <NavLink className={claseLink} to="/analisis" title="Checklist mensual" aria-label="Checklist de pagos mensuales">
          <NavIcon nombre="analisis" />
          <span>Pagos mensuales</span>
        </NavLink>
        <NavLink className={claseLink} to="/prestamos" title="Deudas y préstamos" aria-label="Deudas y préstamos">
          <NavIcon nombre="prestamos" />
          <span>Deudas y préstamos</span>
        </NavLink>
        <NavLink className={claseLink} to="/manage" title="Administrar" aria-label="Administrar">
          <NavIcon nombre="manage" />
          <span>Administrar</span>
        </NavLink>
        <NavLink className={claseLink} to="/perfil" title="Configuración" aria-label="Configuración">
          <NavIcon nombre="configuracion" />
          <span>Configuración</span>
        </NavLink>
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
