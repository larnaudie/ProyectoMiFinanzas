import { NavLink, useParams } from "react-router-dom";

function Sidebar() {
  const { cuentaId } = useParams();

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
    </aside>
  );
}

export default Sidebar;
