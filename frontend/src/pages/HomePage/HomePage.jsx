import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { obtenerCuentas, seleccionarCuenta } from "../../features/slices/cuentasSlice.js";
import { api } from "../../services/api.js";

function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const { cuentas, loading, error } = useSelector((state) => state.cuentas);

  useEffect(() => {
    api.get("/cuentas")
      .then((response) => {
        dispatch(obtenerCuentas(response.data.cuentas));
      })
      .catch((error) => {
        console.error("Error al obtener las cuentas:", error);
      });
  }, [dispatch]);

  const abrirCuenta = (event, cuenta) => {
    // Si el usuario usa Ctrl, Cmd, Shift, click del medio o click derecho,
    // dejamos que el navegador maneje el link para abrir otra pestaña.
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    dispatch(seleccionarCuenta(cuenta));
    navigate(`/cuentas/${cuenta._id}/dashboard`);
  };

  const moverCarousel = (direccion) => {
    if (!carouselRef.current) return;

    carouselRef.current.scrollBy({
      left: direccion * 300,
      behavior: "smooth",
    });
  };

  return (
    <section className="page-section home-page">
      <header className="page-header">
        <div>
          <h1>Cuentas</h1>
          <p>Elegi una cuenta para trabajar sus gastos.</p>
        </div>
      </header>

      {loading && <p>Cargando cuentas...</p>}
      {error && <p className="error-text">{error}</p>}

      <div className="account-carousel-shell">
        <button
          className="carousel-control carousel-control-left"
          type="button"
          aria-label="Ver cuentas anteriores"
          onClick={() => moverCarousel(-1)}
        >
          ‹
        </button>

        <div className="account-carousel" ref={carouselRef}>
          {cuentas.map((cuenta) => (
            <Link
              className="account-card"
              key={cuenta._id}
              to={`/cuentas/${cuenta._id}/dashboard`}
              onClick={(event) => abrirCuenta(event, cuenta)}
            >
              <span className="account-card-topline">Cuenta</span>
              <strong>{cuenta.nombreCuenta}</strong>
              <span className="account-card-meta">Moneda</span>
              <span className="account-card-currency">{cuenta.moneda || "UYU"}</span>
              <span className="account-card-action">Abrir cuenta</span>
            </Link>
          ))}
        </div>

        <button
          className="carousel-control carousel-control-right"
          type="button"
          aria-label="Ver mas cuentas"
          onClick={() => moverCarousel(1)}
        >
          ›
        </button>
      </div>
    </section>
  );
}

export default HomePage;
