import { NavLink, useLocation, useParams } from "react-router-dom";

function Sidebar() {
  const { cuentaId, tarjetaId } = useParams();
  const location = useLocation();
  const estaEnTarjeta = location.pathname.includes("/tarjetas/");

  return (
    <aside className="sidebar">
      <NavLink to="/home">Home</NavLink>
      <NavLink to="/manage">Manage</NavLink>

      {cuentaId && (
        <>
          <NavLink to={`/cuentas/${cuentaId}/dashboard`}>Dashboard</NavLink>
          <NavLink to={`/cuentas/${cuentaId}/gastos`}>Desgloce</NavLink>
          <NavLink to={`/cuentas/${cuentaId}/tarjetas`}>Tarjetas</NavLink>
          <NavLink to={`/cuentas/${cuentaId}/prestamos`}>Prestamos</NavLink>
        </>
      )}

      {cuentaId && tarjetaId && estaEnTarjeta && (
        <>
          <NavLink to={`/cuentas/${cuentaId}/tarjetas/${tarjetaId}`}>Resúmenes</NavLink>
          <NavLink to={`/cuentas/${cuentaId}/tarjetas/${tarjetaId}/importar-excel`}>Importar resumen</NavLink>
        </>
      )}
    </aside>
  );
}

export default Sidebar;
