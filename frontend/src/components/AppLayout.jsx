import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { BarChart3, CreditCard, FileSpreadsheet, Home, LogOut, WalletCards } from 'lucide-react';
import { logout } from '../features/auth/authSlice.js';

function AppLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cuentaActual = useSelector((state) => state.cuentas.cuentaActual);

  const cuentaPath = cuentaActual?._id ? `/cuentas/${cuentaActual._id}` : '/cuentas';

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <WalletCards size={24} />
          <span>MiFinanzas</span>
        </div>
        <nav className="nav-list">
          <NavLink to="/cuentas"><Home size={18} />Cuentas</NavLink>
          <NavLink to={cuentaPath}><BarChart3 size={18} />Dashboard</NavLink>
          <NavLink to={`${cuentaPath}/gastos`}><CreditCard size={18} />Gastos</NavLink>
          <NavLink to={`${cuentaPath}/importar`}><FileSpreadsheet size={18} />Importar Excel</NavLink>
        </nav>
        <button className="ghost-button" type="button" onClick={handleLogout}>
          <LogOut size={18} /> Salir
        </button>
      </aside>
      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
