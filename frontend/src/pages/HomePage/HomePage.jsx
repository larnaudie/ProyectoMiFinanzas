import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { agregarGasto, actualizarGasto } from "../../features/slices/gastosSlice.js";
import { guardarCuentas, obtenerCuentas, seleccionarCuenta } from "../../features/slices/cuentasSlice.js";
import { api } from "../../services/api.js";

const fechaDeHoy = () => new Date().toISOString().slice(0, 10);

const moverCuenta = (cuentas, idOrigen, idDestino) => {
  const origenIndex = cuentas.findIndex((cuenta) => cuenta._id === idOrigen);
  const destinoIndex = cuentas.findIndex((cuenta) => cuenta._id === idDestino);

  if (origenIndex === -1 || destinoIndex === -1 || origenIndex === destinoIndex) {
    return cuentas;
  }

  const cuentasOrdenadas = [...cuentas];
  const [cuentaMovida] = cuentasOrdenadas.splice(origenIndex, 1);
  cuentasOrdenadas.splice(destinoIndex, 0, cuentaMovida);

  return cuentasOrdenadas;
};

const obtenerRutaCuenta = (cuenta) => `/cuentas/${cuenta._id}/gastos`;

function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const { cuentas, loading, error } = useSelector((state) => state.cuentas);

  const [cuentaArrastradaId, setCuentaArrastradaId] = useState(null);
  const [cuentaDestinoId, setCuentaDestinoId] = useState(null);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [errorOrden, setErrorOrden] = useState("");

  const [gastoRapido, setGastoRapido] = useState({
    cuentaId: "",
    detalle: "",
    fecha: fechaDeHoy(),
  });
  const [facturaRapida, setFacturaRapida] = useState(null);
  const [creandoRapido, setCreandoRapido] = useState(false);
  const [errorRapido, setErrorRapido] = useState("");
  const cuentasParaGastoRapido = cuentas;

  useEffect(() => {
    api
      .get("/cuentas")
      .then((response) => {
        const cuentasRecibidas = response.data.cuentas;
        dispatch(obtenerCuentas(cuentasRecibidas));

        setGastoRapido((form) =>
          !form.cuentaId && cuentasRecibidas.length > 0
            ? { ...form, cuentaId: cuentasRecibidas[0]._id }
            : form,
        );
      })
      .catch((error) => {
        console.error("Error al obtener las cuentas:", error);
      });
  }, [dispatch]);

  const abrirCuenta = (event, cuenta) => {
    // Si el usuario usa Ctrl, Cmd, Shift, Alt o click del medio,
    // dejamos que el navegador maneje el link para abrir otra pestana.
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
    navigate(obtenerRutaCuenta(cuenta));
  };

  const empezarArrastreCuenta = (event, cuentaId) => {
    setCuentaArrastradaId(cuentaId);
    setCuentaDestinoId(null);
    setErrorOrden("");

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", cuentaId);
  };

  const pasarSobreCuenta = (event, cuentaId) => {
    event.preventDefault();

    if (cuentaArrastradaId && cuentaArrastradaId !== cuentaId) {
      setCuentaDestinoId(cuentaId);
    }
  };

  const soltarCuenta = async (event, cuentaDestino) => {
    event.preventDefault();

    const idOrigen = event.dataTransfer.getData("text/plain") || cuentaArrastradaId;
    const idDestino = cuentaDestino._id;

    setCuentaArrastradaId(null);
    setCuentaDestinoId(null);

    if (!idOrigen || idOrigen === idDestino) return;

    const ordenAnterior = cuentas;
    const nuevoOrden = moverCuenta(cuentas, idOrigen, idDestino);

    if (nuevoOrden === cuentas) return;

    dispatch(guardarCuentas(nuevoOrden));

    try {
      setGuardandoOrden(true);
      const response = await api.patch("/cuentas/orden", {
        cuentas: nuevoOrden.map((cuenta, index) => ({
          id: cuenta._id,
          orden: index,
        })),
      });

      dispatch(guardarCuentas(response.data.cuentas));
    } catch (error) {
      console.error("Error al guardar el orden de cuentas:", error);
      dispatch(guardarCuentas(ordenAnterior));
      setErrorOrden("No se pudo guardar el nuevo orden. Se volvio al orden anterior.");
    } finally {
      setGuardandoOrden(false);
    }
  };

  const terminarArrastreCuenta = () => {
    setCuentaArrastradaId(null);
    setCuentaDestinoId(null);
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
      setErrorRapido("Elegi una cuenta para guardar el gasto rapido.");
      return;
    }

    if (!gastoRapido.detalle.trim()) {
      setErrorRapido("Escribi un detalle para identificar el gasto.");
      return;
    }

    if (!gastoRapido.fecha) {
      setErrorRapido("Elegi una fecha para el gasto.");
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
      console.error("Error al crear gasto rapido:", error);
      setErrorRapido(
        error.response?.data?.message ||
          error.response?.data?.mensaje ||
          "No se pudo crear el gasto rapido.",
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
      {errorOrden && <p className="error-text">{errorOrden}</p>}
      {guardandoOrden && <p className="order-saving-text">Guardando orden...</p>}

      <div className="account-carousel-shell">
        <button
          className="carousel-control carousel-control-left"
          type="button"
          aria-label="Ver cuentas anteriores"
          onClick={() => moverCarousel(-1)}
        >
          &lt;
        </button>

        <div className="account-carousel" ref={carouselRef}>
          {cuentas.map((cuenta) => (
            <article
              className={`account-card${cuentaArrastradaId === cuenta._id ? " account-card-dragging" : ""}${cuentaDestinoId === cuenta._id ? " account-card-drop-target" : ""}`}
              key={cuenta._id}
              onDragOver={(event) => pasarSobreCuenta(event, cuenta._id)}
              onDrop={(event) => soltarCuenta(event, cuenta)}
            >
              <button
                className="account-drag-handle"
                type="button"
                draggable="true"
                aria-label={`Mover ${cuenta.nombreCuenta}`}
                title="Arrastrar para ordenar"
                onDragStart={(event) => empezarArrastreCuenta(event, cuenta._id)}
                onDragEnd={terminarArrastreCuenta}
              >
                ::
              </button>

              <Link
                className="account-card-link"
                to={obtenerRutaCuenta(cuenta)}
                onClick={(event) => abrirCuenta(event, cuenta)}
              >
                <span className="account-card-topline">
                  {cuenta.tipoCuenta === "credito" ? "Tarjeta de crédito" : "Cuenta"}
                </span>
                <strong>{cuenta.nombreCuenta}</strong>
                <span className="account-card-meta">Moneda</span>
                <span className="account-card-currency">{cuenta.moneda || "UYU"}</span>
              </Link>
              <div className="account-card-actions">
                <Link
                  className="account-card-action"
                  to={obtenerRutaCuenta(cuenta)}
                  onClick={(event) => abrirCuenta(event, cuenta)}
                >
                  {cuenta.tipoCuenta === "credito" ? "Abrir tarjeta" : "Abrir cuenta"}
                </Link>
                <Link
                  className="account-card-dashboard-link"
                  to={`/cuentas/${cuenta._id}/dashboard`}
                >
                  Ver dashboard
                </Link>
              </div>
            </article>
          ))}
        </div>

        <button
          className="carousel-control carousel-control-right"
          type="button"
          aria-label="Ver mas cuentas"
          onClick={() => moverCarousel(1)}
        >
          &gt;
        </button>
      </div>

      <section className="quick-expense-panel">
        <div className="quick-expense-copy">
          <span>Crear Gasto Rapido</span>
          <h2>Estas apurado?</h2>
          <p>
            Estas apurado y queres crear un gasto solamente con un detalle,
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
              {cuentasParaGastoRapido.map((cuenta) => (
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

          <button type="submit" disabled={creandoRapido || cuentasParaGastoRapido.length === 0}>
            {creandoRapido ? "Creando..." : "Crear Gasto Rapido"}
          </button>
        </form>
      </section>
    </section>
  );
}

export default HomePage;
