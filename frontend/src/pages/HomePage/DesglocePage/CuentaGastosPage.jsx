import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../../services/api.js";
import DesglocePage from "./DesglocePage.jsx";
import ResumenesCuentaCreditoPage from "./ResumenesCuentaCreditoPage.jsx";

function CuentaGastosPage() {
  const { cuentaId } = useParams();
  const [cuenta, setCuenta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/cuentas")
      .then((response) => {
        const encontrada = (response.data.cuentas || []).find(
          (item) => item._id === cuentaId,
        );
        if (!encontrada) throw new Error("Cuenta no encontrada");
        setCuenta(encontrada);
      })
      .catch((apiError) => {
        console.error("Error al identificar la cuenta:", apiError);
        setError(
          apiError.response?.data?.message
          || apiError.message
          || "No se pudo cargar la cuenta.",
        );
      })
      .finally(() => setLoading(false));
  }, [cuentaId]);

  if (loading) {
    return <section className="page-section"><p>Cargando cuenta...</p></section>;
  }
  if (error) {
    return <section className="page-section"><p className="inline-error">{error}</p></section>;
  }

  return cuenta.tipoCuenta === "credito"
    ? <ResumenesCuentaCreditoPage cuenta={cuenta} />
    : <DesglocePage />;
}

export default CuentaGastosPage;
