import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { obtenerCuentas, seleccionarCuenta } from '../features/cuentas/cuentasSlice.js';

function AccountsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, loading, error } = useSelector((state) => state.cuentas);

  useEffect(() => {
    dispatch(obtenerCuentas());
  }, [dispatch]);

  const abrirCuenta = (cuenta) => {
    dispatch(seleccionarCuenta(cuenta));
    navigate(`/cuentas/${cuenta._id}`);
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Cuentas</h1>
          <p>Elegi una cuenta para trabajar sus gastos e importaciones.</p>
        </div>
      </header>
      {loading && <p>Cargando cuentas...</p>}
      {error && <p className="error-text">{error}</p>}
      <div className="card-grid">
        {items.map((cuenta) => (
          <button className="account-card" key={cuenta._id} type="button" onClick={() => abrirCuenta(cuenta)}>
            <strong>{cuenta.nombreCuenta}</strong>
            <span>{cuenta.moneda || 'UYU'}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default AccountsPage;
