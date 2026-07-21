import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useRef, useState } from "react";
import {
  actualizarGasto,
  guardarGastos,
} from "../../../features/slices/gastosSlice";
import { guardarCuentas } from "../../../features/slices/cuentasSlice";
import { guardarCategorias } from "../../../features/slices/categoriasSlice";
import { guardarSubcategorias } from "../../../features/slices/subcategoriasSlice";

const obtenerId = (valor) => valor?._id || valor || "";

const fechaParaInput = (fecha) => {
  if (!fecha) return "";
  return String(fecha).slice(0, 10);
};

const esNumeroValido = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return false;
  return Number.isFinite(Number(valor));
};

const esMontoBancarioValido = (valor) => {
  return esNumeroValido(valor) && Number(valor) !== 0;
};

const esPorcentajeValido = (valor) => {
  if (!esNumeroValido(valor)) return false;
  const numero = Number(valor);
  return numero >= 0 && numero <= 100;
};

const obtenerCamposFaltantes = (gasto) => {
  const campos = [];

  if (!gasto?.detalle) campos.push("detalle");
  if (!obtenerId(gasto?.cuentaId)) campos.push("cuenta");
  if (!gasto?.fecha) campos.push("fecha");

  if (!esMontoBancarioValido(gasto?.montoBancario)) {
    campos.push("monto bancario distinto de 0");
  }

  if (!esPorcentajeValido(gasto?.porcentaje)) {
    campos.push("porcentaje entre 0 y 100");
  }

  if (!obtenerId(gasto?.subcategoriaId)) campos.push("subcategoria");

  return campos;
};

const esGastoCompleto = (gasto) => obtenerCamposFaltantes(gasto).length === 0;

const valorParaBackend = (campo, valor) => {
  if (["montoBancario", "porcentaje"].includes(campo)) {
    return valor === "" ? "" : Number(valor);
  }

  return valor;
};

const DetalleGastoPage = () => {
  const { cuentaId, gastoId } = useParams();
  const dispatch = useDispatch();

  const gastos = useSelector((state) => state.gastos.gastos);
  const cuentas = useSelector((state) => state.cuentas.cuentas);
  const categorias = useSelector((state) => state.categorias.categorias);
  const subcategorias = useSelector(
    (state) => state.subcategorias.subcategorias,
  );

  const gastoActual = gastos.find((gasto) => gasto._id === gastoId);
  const cuentaActual = cuentas.find((cuenta) => cuenta._id === cuentaId);

  const [form, setForm] = useState(null);
  const [archivoFactura, setArchivoFactura] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFactura, setSubiendoFactura] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [errorActualizar, setErrorActualizar] = useState("");
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [gastosRes, cuentasRes, categoriasRes, subcategoriasRes] =
          await Promise.all([
            api.get("/gastos"),
            api.get("/cuentas"),
            api.get("/categorias"),
            api.get("/subcategorias"),
          ]);

        dispatch(guardarGastos(gastosRes.data.gastos));
        dispatch(guardarCuentas(cuentasRes.data.cuentas));
        dispatch(guardarCategorias(categoriasRes.data.categorias));
        dispatch(guardarSubcategorias(subcategoriasRes.data.subcategorias));
      } catch (err) {
        console.error("Error al cargar el detalle del gasto:", err);
        setError("No se pudieron cargar los datos del gasto.");
      }
    };

    cargarDatos();
  }, [dispatch]);

  useEffect(() => {
    if (gastoActual) {
      setForm(gastoActual);
    }
  }, [gastoActual]);

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      detenerCamara();
    };
  }, []);

  const guardarCampo = (campo, valor) => {
    clearTimeout(timerRef.current);
    setGuardando(true);
    setMensaje("");
    setError("");

    timerRef.current = setTimeout(async () => {
      try {
        const valorNormalizado = valorParaBackend(campo, valor);
        const response = await api.patch(`/gastos/${gastoId}`, {
          [campo]: valorNormalizado,
        });

        dispatch(actualizarGasto(response.data.gasto));
        setForm(response.data.gasto);
        setMensaje("Cambio guardado.");
      } catch (err) {
        console.error("Error al actualizar gasto:", err);
        setError(
          err.response?.data?.message ||
            "No se pudo guardar el cambio. Revisá si el gasto creado quedó incompleto.",
        );
      } finally {
        setGuardando(false);
      }
    }, 1000);
  };

  const handleChange = (campo, valor) => {
    const nuevoForm = {
      ...form,
      [campo]: valor,
    };

    setForm(nuevoForm);
    guardarCampo(campo, valor);
  };

  const actualizarEstado = async () => {
    const camposFaltantes = obtenerCamposFaltantes(form);

    if (camposFaltantes.length > 0) {
      setMensaje("");
      setError("");
      setErrorActualizar(
        `No se puede actualizar a creado: falta completar ${camposFaltantes.join(", ")}.`,
      );
      return;
    }

    try {
      setGuardando(true);
      setMensaje("");
      setError("");
      setErrorActualizar("");

      const response = await api.patch(`/gastos/${gastoId}`, {
        cambiarEstado: true,
      });

      dispatch(actualizarGasto(response.data.gasto));
      setForm(response.data.gasto);
      setMensaje("");
    } catch (err) {
      console.error("Error al actualizar estado del gasto:", err);
      setErrorActualizar(
        err.response?.data?.message ||
          "No se pudo actualizar a creado. Revisá los campos requeridos.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCamaraActiva(false);
  };

  const iniciarCamara = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });

      streamRef.current = stream;
      setCamaraActiva(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 0);
    } catch (err) {
      console.error("Error al abrir la camara:", err);
      setError("No se pudo abrir la camara. Podes seleccionar una imagen desde archivo.");
    }
  };

  const sacarFoto = () => {
    const video = videoRef.current;

    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) {
        setError("No se pudo capturar la foto.");
        return;
      }

      const archivo = new File([blob], `factura-${Date.now()}.jpg`, { type: "image/jpeg" });
      setArchivoFactura(archivo);
      detenerCamara();
    }, "image/jpeg", 0.9);
  };

  const subirFactura = async () => {
    if (!archivoFactura) {
      setError("Seleccioná una factura antes de subirla.");
      return;
    }

    try {
      setSubiendoFactura(true);
      setMensaje("");
      setError("");

      const formData = new FormData();
      formData.append("factura", archivoFactura);

      const response = await api.patch(`/gastos/${gastoId}/factura`, formData);

      dispatch(actualizarGasto(response.data.gasto));
      setForm(response.data.gasto);
      setArchivoFactura(null);
      setMensaje("Factura subida correctamente.");
    } catch (err) {
      console.error("Error al subir factura:", err);
      setError(err.response?.data?.message || "No se pudo subir la factura.");
    } finally {
      setSubiendoFactura(false);
    }
  };

  if (!form) {
    return <p>Cargando detalle del gasto...</p>;
  }

  const categoriaSeleccionada = obtenerId(form.categoriaId);
  const subcategoriaSeleccionada = obtenerId(form.subcategoriaId);
  const facturaUrl = form.factura?.url;
  const completo = esGastoCompleto(form);
  const estaCreado = form.estado === "creado";

  return (
    <section className="page-section detail-page">
      <header className="page-header detail-header">
        <div>
          <Link className="secondary-link compact-link" to={`/cuentas/${cuentaId}/gastos`}>
            Volver a gastos
          </Link>
          <h1>Detalle del gasto</h1>
          <p>{cuentaActual?.nombreCuenta || form.cuentaId?.nombreCuenta || "Cuenta seleccionada"}</p>
        </div>

        <div className="detail-status-group">
          <span className={`status-badge ${estaCreado ? "status-created" : "status-pending"}`}>
            {estaCreado ? "CREADO" : "PENDIENTE"}
          </span>
          {!estaCreado && (
            <div className="update-action">
              <button type="button" disabled={guardando} onClick={actualizarEstado}>
                Actualizar
              </button>
              {errorActualizar && <p className="inline-error">{errorActualizar}</p>}
            </div>
          )}
        </div>
      </header>

      {(mensaje || guardando || error) && (
        <div className="detail-feedback">
          {guardando && <p>Guardando cambios...</p>}
          {mensaje && <p>{mensaje}</p>}
          {error && <p className="error-text">{error}</p>}
        </div>
      )}

      <div className="detail-grid">
        <form className="detail-card detail-form">
          <h2>Datos del gasto</h2>

          <label>
            Detalle
            <input
              type="text"
              value={form.detalle || ""}
              onChange={(event) => handleChange("detalle", event.target.value)}
            />
          </label>

          <label>
            Fecha
            <input
              type="date"
              value={fechaParaInput(form.fecha)}
              onChange={(event) => handleChange("fecha", event.target.value)}
            />
          </label>

          <label>
            Monto bancario
            <input
              type="number"
              value={form.montoBancario ?? ""}
              onChange={(event) => handleChange("montoBancario", event.target.value)}
            />
          </label>

          <label>
            Porcentaje
            <input
              type="number"
              value={form.porcentaje ?? ""}
              onChange={(event) => handleChange("porcentaje", event.target.value)}
            />
          </label>

          <label>
            Categoria
            <select
              value={categoriaSeleccionada}
              onChange={(event) => handleChange("categoriaId", event.target.value)}
            >
              <option value="">Seleccione categoria</option>
              {categorias.map((categoria) => (
                <option key={categoria._id} value={categoria._id}>
                  {categoria.nombreCategoria}
                </option>
              ))}
            </select>
          </label>

          <label>
            Subcategoria
            <select
              value={subcategoriaSeleccionada}
              onChange={(event) => handleChange("subcategoriaId", event.target.value)}
            >
              <option value="">Seleccione subcategoria</option>
              {subcategorias.map((subcategoria) => (
                <option key={subcategoria._id} value={subcategoria._id}>
                  {subcategoria.nombreSubcategoria}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-row detail-checkbox">
            <input
              type="checkbox"
              checked={Boolean(form.incluirMontoReal)}
              onChange={(event) =>
                handleChange("incluirMontoReal", event.target.checked)
              }
            />
            Incluir en monto real
          </label>
        </form>

        <aside className="detail-card detail-summary">
          <h2>Resumen</h2>
          <dl>
            <div>
              <dt>Monto bancario</dt>
              <dd>$ {form.montoBancario ?? 0}</dd>
            </div>
            <div>
              <dt>Monto real</dt>
              <dd>$ {form.montoReal ?? 0}</dd>
            </div>
            <div>
              <dt>Origen</dt>
              <dd>{form.origen?.tipo || "manual"}</dd>
            </div>
            <div>
              <dt>Factura</dt>
              <dd>{facturaUrl ? "Cargada" : "Sin factura"}</dd>
            </div>
          </dl>
        </aside>

        <section className="detail-card detail-factura">
          <h2>Factura</h2>
          {facturaUrl ? (
            <div className="factura-preview">
              <img src={facturaUrl} alt="Factura del gasto" />
              <a className="secondary-link" href={facturaUrl} target="_blank" rel="noreferrer">
                Ver factura
              </a>
            </div>
          ) : (
            <p>Este gasto todavía no tiene una factura asociada.</p>
          )}

          <div className="factura-upload-row">
            <label className="file-action-button">
              Elegir archivo
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => setArchivoFactura(event.target.files?.[0] || null)}
              />
            </label>

            <button type="button" className="file-action-button" onClick={iniciarCamara}>
              Sacar foto
            </button>

            {archivoFactura && <span className="selected-file-name">{archivoFactura.name}</span>}

            <button type="button" disabled={subiendoFactura} onClick={subirFactura}>
              {subiendoFactura ? "Subiendo..." : "Subir factura"}
            </button>
          </div>

          {camaraActiva && (
            <div className="camera-panel">
              <video ref={videoRef} autoPlay playsInline />
              <div className="camera-actions">
                <button type="button" onClick={sacarFoto}>
                  Usar foto
                </button>
                <button type="button" className="secondary-button" onClick={detenerCamara}>
                  Cancelar camara
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
};

export default DetalleGastoPage;





