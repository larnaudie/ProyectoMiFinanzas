import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { guardarCuentas } from "../../../features/slices/cuentasSlice.js";
import { api } from "../../../services/api.js";

function ImportPage() {
  const dispatch = useDispatch();
  const cuentas = useSelector((state) => state.cuentas.cuentas);

  useEffect(() => {
    if (cuentas.length > 0) return;
    api.get("/cuentas")
      .then((response) => dispatch(guardarCuentas(response.data.cuentas || [])))
      .catch((error) => console.error("No se pudieron cargar las cuentas:", error));
  }, [cuentas.length, dispatch]);

  return (
    <section className="page-section import-landing-page">
      <header className="page-header redesigned-page-header">
        <div>
          <span className="page-eyebrow">Cargar movimientos</span>
          <h1>Importar Excel</h1>
          <p>Elegí la cuenta que corresponde al archivo bancario.</p>
        </div>
      </header>

      <div className="import-account-grid">
        {cuentas.map((cuenta) => (
          <Link
            className="import-account-card"
            key={cuenta._id}
            to={`/cuentas/${cuenta._id}/importar-excel`}
          >
            <span className="import-account-symbol" aria-hidden="true">
              {cuenta.tipoCuenta === "credito" ? "TC" : cuenta.moneda === "USD" ? "U$" : "$"}
            </span>
            <span>
              <strong>{cuenta.nombreCuenta}</strong>
              <small>{cuenta.tipoCuenta === "credito" ? "Tarjeta" : cuenta.moneda || "UYU"}</small>
            </span>
            <b>Importar →</b>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default ImportPage;
