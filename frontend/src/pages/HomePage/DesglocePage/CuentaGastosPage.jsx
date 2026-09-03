import { useOutletContext } from "react-router-dom";
import DesglocePage from "./DesglocePage.jsx";
import ResumenesCuentaCreditoPage from "./ResumenesCuentaCreditoPage.jsx";

function CuentaGastosPage() {
  const {
    cuentaActual: cuenta,
    cargandoCuentaActual,
    errorCuentaActual,
  } = useOutletContext();

  if (cargandoCuentaActual || (!cuenta && !errorCuentaActual)) {
    return <section className="page-section"><p>Cargando cuenta...</p></section>;
  }
  if (errorCuentaActual || !cuenta) {
    return (
      <section className="page-section">
        <p className="inline-error">{errorCuentaActual || "Cuenta no encontrada"}</p>
      </section>
    );
  }

  return cuenta.tipoCuenta === "credito"
    ? <ResumenesCuentaCreditoPage cuenta={cuenta} />
    : <DesglocePage />;
}

export default CuentaGastosPage;
