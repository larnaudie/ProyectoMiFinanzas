import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";

function TarjetasPage() {
  const { cuentaId } = useParams();
  const [cuenta, setCuenta] = useState(null);
  const [tarjetas, setTarjetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/cuentas"), api.get(`/tarjetas?cuentaId=${cuentaId}`)])
      .then(([cuentasResponse, tarjetasResponse]) => {
        setCuenta((cuentasResponse.data.cuentas || []).find((item) => item._id === cuentaId) || null);
        setTarjetas(tarjetasResponse.data.tarjetas || []);
      })
      .catch((apiError) => {
        console.error("Error al cargar tarjetas:", apiError);
        setError(apiError.response?.data?.message || "No se pudieron cargar las tarjetas.");
      })
      .finally(() => setLoading(false));
  }, [cuentaId]);

  return (
    <section className="page-section credit-card-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tarjetas de crédito</p>
          <h1>{cuenta?.nombreCuenta || "Cuenta"}</h1>
          <p>Cada tarjeta conserva sus propios cierres y comparte esta cuenta para reflejar los gastos confirmados.</p>
        </div>
        <Link className="secondary-link" to="/manage">Administrar tarjetas</Link>
      </header>

      {loading && <p>Cargando tarjetas...</p>}
      {error && <p className="inline-error">{error}</p>}
      {!loading && !error && tarjetas.length === 0 && (
        <p className="empty-state">Esta cuenta todavía no tiene tarjetas. Podés crearlas desde Manage.</p>
      )}

      <div className="card-grid">
        {tarjetas.map((tarjeta) => (
          <Link
            className="account-card account-card-link"
            key={tarjeta._id}
            to={`/cuentas/${cuentaId}/tarjetas/${tarjeta._id}`}
          >
            <span className="eyebrow">{tarjeta.activa ? "Activa" : "Inactiva"}</span>
            <strong>{tarjeta.nombreTarjeta}</strong>
            <span>{tarjeta.ultimosDigitos ? `Terminada en ${tarjeta.ultimosDigitos}` : "Sin últimos dígitos"}</span>
            <span>{tarjeta.bancoId?.nombreBanco || "Banco sin asignar"}</span>
            <span className="account-card-action">Ver resúmenes</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default TarjetasPage;
