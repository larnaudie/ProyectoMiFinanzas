import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { agregarGasto, actualizarGasto } from "../../features/slices/gastosSlice.js";
import { obtenerCuentas, seleccionarCuenta } from "../../features/slices/cuentasSlice.js";
import { api } from "../../services/api.js";

const fechaDeHoy = () => new Date().toISOString().slice(0, 10);

function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const { cuentas, loading, error } = useSelector((state) => state.cuentas);

  const [gastoRapido, setGastoRapido] = useState({
    cuentaId: "",
    detalle: "",
    fecha: fechaDeHoy(),
  });
  const [facturaRapida, setFacturaRapida] = useState(null);
  const [creandoRapido, setCreandoRapido] = useState(false);
  const [errorRapido, setErrorRapido] = useState("");

  useEffect(() => {
    api.get("/cuentas")
      .then((response) => {
        const cuentasRecibidas = response.data.cuentas;
        dispatch(obtenerCuentas(cuentasRecibidas));

        if (!gastoRapido.cuentaId && cuentasRecibidas.length > 0) {
          setGastoRapido((form) => ({ ...form, cuentaId: cuentasRecibidas[0]._id }));
        }
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
    navigate(`/cuentas/${cuenta._id}/gastos`);
  };

  const moverCarousel = (direccion) => {
    if (!carouselRef.current) return;

    carouselRef.current.scrollBy({
      left: direccion * 300,
      behavior: "smooth",
    });
  };

  const cambiarGastoRapido = (campo, valor) => {
    setGastoRapido({ ...gastoRapido, [campo]: valor });
    setErrorRapido("");
  };

  const crearGastoRapido = async (event) => {
    event.preventDefault();

    if (!gastoRapido.cuentaId) {
      setErrorRapido("Elegí una cuenta para guardar el gasto rápido.");
      return;
    }

    if (!gastoRapido.detalle.trim()) {
      setErrorRapido("Escribí un detalle para identificar el gasto.");
      return;
    }

    if (!gastoRapido.fecha) {
      setErrorRapido("Elegí una fecha para el gasto.");
      return;
    }

    try {
      setCreandoRapido(true);
      setErrorRapido("");

      const response = await api.post("/gastos", {
        cuentaId: gastoRapido.cuentaId,
        detalle: gastoRapido.detalle.trim(),
        fecha: gastoRapido.fecha,
        cambiarEstado: false,
      });

      let gastoCreado = response.data.gasto;
      dispatch(agregarGasto(gastoCreado));

      if (facturaRapida) {
        const formData = new FormData();
        formData.append("factura", facturaRapida);

        const facturaResponse = await api.patch(
          `/gastos/${gastoCreado._id}/factura`,
          formData,
        );

        gastoCreado = facturaResponse.data.gasto;
        dispatch(actualizarGasto(gastoCreado));
      }

      setGastoRapido({
        cuentaId: gastoRapido.cuentaId,
        detalle: "",
        fecha: fechaDeHoy(),
      });
      setFacturaRapida(null);

      navigate(`/cuentas/${gastoCreado.cuentaId}/gastos/gasto/${gastoCreado._id}`);
    } catch (error) {
      console.error("Error al crear gasto rápido:", error);
      setErrorRapido(
        error.response?.data?.message ||
          error.response?.data?.mensaje ||
          "No se pudo crear el gasto rápido.",
      );
    } finally {
      setCreandoRapido(false);
    }
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
              to={`/cuentas/${cuenta._id}/gastos`}
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

      <section className="quick-expense-panel">
        <div className="quick-expense-copy">
          <span>Crear Gasto Rapido</span>
          <h2>¿Estas apurado?</h2>
          <p>
            ¿Estas apurado y quieres crear un gasto solamente con un detalle,
            fecha y factura? Usa esta funcionalidad.
          </p>
        </div>

        <form className="quick-expense-form" onSubmit={crearGastoRapido}>
          <label>
            Cuenta
            <select
              value={gastoRapido.cuentaId}
              onChange={(event) => cambiarGastoRapido("cuentaId", event.target.value)}
            >
              <option value="">Seleccionar cuenta</option>
              {cuentas.map((cuenta) => (
                <option key={cuenta._id} value={cuenta._id}>
                  {cuenta.nombreCuenta}
                </option>
              ))}
            </select>
          </label>

          <label>
            Detalle
            <input
              type="text"
              value={gastoRapido.detalle}
              placeholder="Ej: Compra supermercado"
              onChange={(event) => cambiarGastoRapido("detalle", event.target.value)}
            />
          </label>

          <label>
            Fecha
            <input
              type="date"
              value={gastoRapido.fecha}
              onChange={(event) => cambiarGastoRapido("fecha", event.target.value)}
            />
          </label>

          <label className="quick-file-field">
            Factura
            <input
              type="file"
              accept="image/*,.pdf"
              capture="environment"
              onChange={(event) => setFacturaRapida(event.target.files?.[0] || null)}
            />
          </label>

          {errorRapido && <p className="error-text quick-expense-error">{errorRapido}</p>}

          <button type="submit" disabled={creandoRapido || cuentas.length === 0}>
            {creandoRapido ? "Creando..." : "Crear Gasto Rapido"}
          </button>
        </form>
      </section>
    </section>
  );
}

export default HomePage;


