import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { obtenerCuentas, seleccionarCuenta } from "../../features/slices/cuentasSlice.js";
import { api } from "../../services/api.js";

function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { cuentas, loading, error } = useSelector((state) => state.cuentas);

  useEffect(() => {
    api.get('/cuentas')
      .then((response) => {
        dispatch(obtenerCuentas(response.data.cuentas));
      })
      .catch((error) => {
        console.error('Error al obtener las cuentas:', error);
      });
  }, [dispatch]);

  const abrirCuenta = (cuenta) => {
    dispatch(seleccionarCuenta(cuenta));
    navigate(`/cuentas/${cuenta._id}/dashboard`);
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Cuentas</h1>
          <p>Elegi una cuenta para trabajar sus gastos.</p>
        </div>
      </header>
      {loading && <p>Cargando cuentas...</p>}
      {error && <p className="error-text">{error}</p>}
      <div className="card-grid">
        {cuentas.map((cuenta) => (
          <button
            className="account-card"
            key={cuenta._id}
            type="button"
            onClick={() => abrirCuenta(cuenta)}
          >
            <strong>{cuenta.nombreCuenta}</strong>
            <span>{cuenta.moneda || "UYU"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default HomePage;
