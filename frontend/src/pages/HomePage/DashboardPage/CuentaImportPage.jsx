import { useOutletContext } from "react-router-dom";
import ImportExcelPage from "./ImportExcelPage.jsx";
import ImportarExcelCuentaCreditoPage from "./ImportarExcelCuentaCreditoPage.jsx";

function CuentaImportPage() {
  const {
    cuentaActual: cuenta,
    cargandoCuentaActual,
    errorCuentaActual,
  } = useOutletContext();

  if (cargandoCuentaActual || (!cuenta && !errorCuentaActual)) {
    return <section className="page-section"><p>Cargando importador...</p></section>;
  }
  if (errorCuentaActual || !cuenta) {
    return (
      <section className="page-section">
        <p className="inline-error">{errorCuentaActual || "Cuenta no encontrada"}</p>
      </section>
    );
  }

  return cuenta.tipoCuenta === "credito"
    ? <ImportarExcelCuentaCreditoPage cuenta={cuenta} />
    : <ImportExcelPage />;
}

export default CuentaImportPage;
