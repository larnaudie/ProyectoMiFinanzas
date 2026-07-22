import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { guardarCuentas } from "../../../features/slices/cuentasSlice.js";

function DashboardPage() {
  const { cuentaId } = useParams();
  const cuentas = useSelector((state) => state.cuentas.cuentas);
  const cuentaActual = cuentas.find((cuenta) => cuenta._id === cuentaId);

  const dispatch = useDispatch();

  useEffect(() => {
    /**
       * Si entrás desde Home, seguramente funciona. Pero si recargás directamente en:
        /cuentas/123/gastos
        Redux puede arrancar vacío, entonces cuentaActual va a ser undefined.
        Para resolver eso después, DesglocePage debería cargar las cuentas si todavía no están cargadas:
       */
    if (cuentas.length === 0) {
      api.get("/cuentas").then((response) => {
        dispatch(guardarCuentas(response.data.cuentas));
      });
    }
  }, [cuentas.length, dispatch]);

  return (
    <section className="page-section">
      <div>
        <h1>{cuentaActual?.nombreCuenta || ""}</h1>
      </div>
      <br></br>
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Resumen inicial de la cuenta seleccionada.</p>
        </div>
      </header>
      <div className="action-row">
        <Link className="primary-link" to={`/cuentas/${cuentaId}/gastos`}>
          Ver gastos
        </Link>
        <Link className="secondary-link" to={`/cuentas/${cuentaId}/importar`}>
          Importar Excel
        </Link>
      </div>
      <div className="summary-grid">
        <article>
          <span>Gasto bancario</span>
          <strong>$ 0</strong>
        </article>
        <article>
          <span>Gasto real</span>
          <strong>$ 0</strong>
        </article>
        <article>
          <span>Pendientes</span>
          <strong>0</strong>
        </article>
      </div>
    </section>
  );
}

export default DashboardPage;
