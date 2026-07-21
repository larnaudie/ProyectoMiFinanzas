import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../services/api";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useRef, useState } from "react";
import {
  actualizarGasto,
  agregarGasto,
  eliminarGasto,
  guardarGastos,
} from "../../../features/slices/gastosSlice";
import { guardarCuentas } from "../../../features/slices/cuentasSlice";
import { agregarCategoria, guardarCategorias } from "../../../features/slices/categoriasSlice";
import { agregarSubcategoria, guardarSubcategorias } from "../../../features/slices/subcategoriasSlice";

// Los campos populados pueden venir como objeto o como string.
// Esta funcion nos devuelve siempre el id para poder comparar y guardar.
const obtenerId = (valor) => {
  if (!valor) return "";
  if (typeof valor === "object") return valor._id || valor.id || "";
  return valor;
};

// El input type="date" solo entiende fechas con formato YYYY-MM-DD.
const fechaParaInput = (fecha) => {
  if (!fecha) return "";
  return fecha.slice(0, 10);
};

const mesesDelAnio = [
  { valor: "01", nombre: "Enero" },
  { valor: "02", nombre: "Febrero" },
  { valor: "03", nombre: "Marzo" },
  { valor: "04", nombre: "Abril" },
  { valor: "05", nombre: "Mayo" },
  { valor: "06", nombre: "Junio" },
  { valor: "07", nombre: "Julio" },
  { valor: "08", nombre: "Agosto" },
  { valor: "09", nombre: "Setiembre" },
  { valor: "10", nombre: "Octubre" },
  { valor: "11", nombre: "Noviembre" },
  { valor: "12", nombre: "Diciembre" },
];

const obtenerFechaActualParaFiltro = () => {
  const hoy = new Date();

  return {
    mes: String(hoy.getMonth() + 1).padStart(2, "0"),
    anio: String(hoy.getFullYear()),
  };
};

const obtenerNombreCategoria = (categoriaId, categorias) => {
  const id = obtenerId(categoriaId);
  return categorias.find((categoria) => categoria._id === id)?.nombreCategoria || "";
};

const obtenerNombreSubcategoria = (subcategoriaId, subcategorias) => {
  const id = obtenerId(subcategoriaId);
  return (
    subcategorias.find((subcategoria) => subcategoria._id === id)
      ?.nombreSubcategoria || ""
  );
};

const cumpleFiltroMonto = (valor, modo, monto, desde, hasta) => {
  // Si el usuario no eligio un modo, este filtro no limita la lista.
  if (!modo) return true;

  const numero = Number(valor ?? 0);

  if (modo === "monto") {
    if (monto === "") return true;
    return numero === Number(monto);
  }

  if (modo === "rango") {
    if (desde !== "" && numero < Number(desde)) return false;
    if (hasta !== "" && numero > Number(hasta)) return false;
  }

  return true;
};

const obtenerFechaActualParaInput = () => {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
};

const crearGastoInicial = () => ({
  detalle: "",
  fecha: obtenerFechaActualParaInput(),
  montoBancario: "",
  porcentaje: 100,
  incluirMontoReal: true,
  categoriaId: "",
  subcategoriaId: "",
});

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

const obtenerCamposFaltantesNuevoGasto = (gasto) => {
  const campos = [];

  if (!gasto.detalle.trim()) campos.push("detalle");
  if (!gasto.fecha) campos.push("fecha");
  if (!esMontoBancarioValido(gasto.montoBancario)) campos.push("monto bancario distinto de 0");
  if (!esPorcentajeValido(gasto.porcentaje)) campos.push("porcentaje entre 0 y 100");
  if (!gasto.subcategoriaId) campos.push("subcategoria");

  return campos;
};
const nombresCamposGasto = {
  detalle: "detalle",
  fecha: "fecha",
  montoBancario: "monto bancario distinto de 0",
  porcentaje: "porcentaje entre 0 y 100",
  cuentaId: "cuenta",
  categoriaId: "categoria",
  subcategoriaId: "subcategoria",
};

const obtenerMensajeErrorGasto = (error) => {
  const data = error.response?.data;

  // Joi devuelve un array con el detalle fino de cada campo que fallo.
  // Si existe, lo traducimos a un mensaje que el usuario pueda corregir.
  if (Array.isArray(data?.error) && data.error.length > 0) {
    const campos = data.error.map((item) => {
      const nombreCampo = item.path?.[0];
      return nombresCamposGasto[nombreCampo] || item.message;
    });

    return `No se pudo guardar. Revisa: ${campos.join(", ")}.`;
  }

  return data?.message || data?.mensaje || "No se pudo guardar el gasto.";
};

const categoriaInicial = {
  nombreCategoria: "",
};

const subcategoriaInicial = {
  nombreSubcategoria: "",
  categoria: "",
};

function DesglocePage() {
  const { cuentaId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const gastos = useSelector((state) => state.gastos.gastos);
  const cuentas = useSelector((state) => state.cuentas.cuentas);
  const categorias = useSelector((state) => state.categorias.categorias);
  const subcategorias = useSelector(
    (state) => state.subcategorias.subcategorias,
  );

  const cuentaActual = cuentas.find((cuenta) => cuenta._id === cuentaId);

  const [filtros, setFiltros] = useState({
    detalle: "",
    categoriaId: "",
    subcategoriaId: "",
    fechaModo: "",
    fechaMes: "",
    fechaDesde: "",
    fechaHasta: "",
    montoBancarioModo: "",
    montoBancario: "",
    montoBancarioDesde: "",
    montoBancarioHasta: "",
    montoRealModo: "",
    montoReal: "",
    montoRealDesde: "",
    montoRealHasta: "",
  });

  const [seleccionados, setSeleccionados] = useState([]);
  const [bulk, setBulk] = useState({
    categoriaId: "",
    subcategoriaId: "",
    incluirMontoReal: "",
    cambiarEstado: false,
  });

  const [modalActivo, setModalActivo] = useState(null);
  const [formGasto, setFormGasto] = useState(crearGastoInicial);
  const [formCategoria, setFormCategoria] = useState(categoriaInicial);
  const [formSubcategoria, setFormSubcategoria] = useState(subcategoriaInicial);
  const [errorModal, setErrorModal] = useState("");
  const [resultadoBulk, setResultadoBulk] = useState("");

  // edicionesRapidas guarda lo que el usuario esta escribiendo antes de que llegue la respuesta del backend.
  const [edicionesRapidas, setEdicionesRapidas] = useState({});
  const [detalleEnEdicion, setDetalleEnEdicion] = useState(null);

  // timersRef guarda un timer por gasto/campo para poder hacer debounce.
  const timersRef = useRef({});

  useEffect(() => {
    // Cargamos todo lo que la tabla editable necesita para funcionar.
    api
      .get("/gastos")
      .then((response) => {
        dispatch(guardarGastos(response.data.gastos));
      })
      .catch((error) => {
        console.error("Error al obtener los gastos:", error);
      });

    api
      .get("/cuentas")
      .then((response) => {
        dispatch(guardarCuentas(response.data.cuentas));
      })
      .catch((error) => {
        console.error("Error al obtener las cuentas:", error);
      });

    api
      .get("/categorias")
      .then((response) => {
        dispatch(guardarCategorias(response.data.categorias));
      })
      .catch((error) => {
        console.error("Error al obtener las categorias:", error);
      });

    api
      .get("/subcategorias")
      .then((response) => {
        dispatch(guardarSubcategorias(response.data.subcategorias));
      })
      .catch((error) => {
        console.error("Error al obtener las subcategorias:", error);
      });
  }, [dispatch]);

  // Paso 1: nos quedamos solo con gastos de la cuenta actual.
  const gastosDeLaCuenta = gastos.filter((gasto) => {
    return obtenerId(gasto.cuentaId) === cuentaId;
  });

  // Los meses son fijos; los anios salen de los gastos cargados y siempre suman el anio actual.
  const anioActual = String(new Date().getFullYear());
  const aniosDisponibles = [
    ...new Set([
      anioActual,
      ...gastosDeLaCuenta
        .map((gasto) => fechaParaInput(gasto.fecha).slice(0, 4))
        .filter(Boolean),
    ]),
  ].sort().reverse();

  // Paso 2: aplicamos filtros de pantalla sobre los gastos de la cuenta.
  const gastosFiltrados = gastosDeLaCuenta.filter((gasto) => {
    const detalle = (gasto.detalle || "").toLowerCase();
    const textoBuscado = filtros.detalle.toLowerCase();
    const fecha = fechaParaInput(gasto.fecha);

    const coincideDetalle = detalle.includes(textoBuscado);
    const coincideCategoria =
      !filtros.categoriaId || obtenerId(gasto.categoriaId) === filtros.categoriaId;
    const coincideSubcategoria =
      !filtros.subcategoriaId ||
      obtenerId(gasto.subcategoriaId) === filtros.subcategoriaId;

    let coincideFecha = true;
    if (filtros.fechaModo === "mes") {
      const mes = fecha.slice(5, 7);
      const anio = fecha.slice(0, 4);

      coincideFecha =
        (!filtros.fechaMes || mes === filtros.fechaMes) &&
        (!filtros.fechaAnio || anio === filtros.fechaAnio);
    }
    if (filtros.fechaModo === "rango") {
      coincideFecha =
        (!filtros.fechaDesde || fecha >= filtros.fechaDesde) &&
        (!filtros.fechaHasta || fecha <= filtros.fechaHasta);
    }

    const coincideMontoBancario = cumpleFiltroMonto(
      gasto.montoBancario,
      filtros.montoBancarioModo,
      filtros.montoBancario,
      filtros.montoBancarioDesde,
      filtros.montoBancarioHasta,
    );

    const coincideMontoReal = cumpleFiltroMonto(
      gasto.montoReal,
      filtros.montoRealModo,
      filtros.montoReal,
      filtros.montoRealDesde,
      filtros.montoRealHasta,
    );

    return (
      coincideDetalle &&
      coincideCategoria &&
      coincideSubcategoria &&
      coincideFecha &&
      coincideMontoBancario &&
      coincideMontoReal
    );
  });

  const gastosPendientes = gastosFiltrados.filter(
    (gasto) => gasto.estado === "pendiente",
  );

  const gastosCreados = gastosFiltrados.filter(
    (gasto) => gasto.estado === "creado",
  );

  const cambiarFiltro = (campo, valor) => {
    if (campo === "fechaModo" && valor === "mes") {
      const fechaActual = obtenerFechaActualParaFiltro();

      setFiltros({
        ...filtros,
        fechaModo: valor,
        fechaMes: filtros.fechaMes || fechaActual.mes,
        fechaAnio: filtros.fechaAnio || fechaActual.anio,
      });
      return;
    }

    setFiltros({
      ...filtros,
      [campo]: valor,
    });
  };

  const cambiarBulk = (campo, valor) => {
    setBulk({
      ...bulk,
      [campo]: valor,
    });
  };

  const abrirModal = (modal) => {
    setModalActivo(modal);
    setErrorModal("");
  };

  const cerrarModal = () => {
    setModalActivo(null);
    setErrorModal("");
    setFormGasto(crearGastoInicial());
    setFormCategoria(categoriaInicial);
    setFormSubcategoria(subcategoriaInicial);
  };

  const cambiarFormGasto = (campo, valor) => {
    setFormGasto({
      ...formGasto,
      [campo]: valor,
    });
  };

  const camposFaltantesGasto = obtenerCamposFaltantesNuevoGasto(formGasto);
  const gastoCompleto = camposFaltantesGasto.length === 0;

  const guardarNuevoGasto = (crearCompleto) => {
    if (!formGasto.detalle.trim()) {
      setErrorModal("El detalle es obligatorio para guardar el gasto.");
      return;
    }

    if (crearCompleto && !gastoCompleto) {
      setErrorModal(`Para crear el gasto, falta completar: ${camposFaltantesGasto.join(", ")}.`);
      return;
    }

    const payload = {
      ...formGasto,
      cuentaId,
      cambiarEstado: crearCompleto,
      montoBancario:
        formGasto.montoBancario === "" ? "" : Number(formGasto.montoBancario),
      porcentaje: formGasto.porcentaje === "" ? "" : Number(formGasto.porcentaje),
    };

    api
      .post("/gastos", payload)
      .then((response) => {
        dispatch(agregarGasto(response.data.gasto));
        cerrarModal();
      })
      .catch((error) => {
        setErrorModal(obtenerMensajeErrorGasto(error));
      });
  };

  const guardarNuevaCategoria = () => {
    if (!formCategoria.nombreCategoria.trim()) {
      setErrorModal("El nombre de la categoria es obligatorio.");
      return;
    }

    api
      .post("/categorias", formCategoria)
      .then((response) => {
        dispatch(agregarCategoria(response.data.categoria));
        cerrarModal();
      })
      .catch((error) => {
        setErrorModal(
          error.response?.data?.message ||
            error.response?.data?.mensaje ||
            "No se pudo crear la categoria.",
        );
      });
  };

  const guardarNuevaSubcategoria = () => {
    if (!formSubcategoria.nombreSubcategoria.trim()) {
      setErrorModal("El nombre de la subcategoria es obligatorio.");
      return;
    }

    const payload = {
      nombreSubcategoria: formSubcategoria.nombreSubcategoria.trim(),
    };

    if (formSubcategoria.categoria) {
      payload.categoria = formSubcategoria.categoria;
    }

    api
      .post("/subcategorias", payload)
      .then((response) => {
        dispatch(agregarSubcategoria(response.data.subcategoria));
        cerrarModal();
      })
      .catch((error) => {
        setErrorModal(
          error.response?.data?.message ||
            error.response?.data?.mensaje ||
            "No se pudo crear la subcategoria.",
        );
      });
  };

  const obtenerValorVisible = (gasto, campo) => {
    // Si hay una edicion local pendiente, mostramos esa.
    if (edicionesRapidas[gasto._id]?.[campo] !== undefined) {
      return edicionesRapidas[gasto._id][campo];
    }

    if (campo === "fecha") return fechaParaInput(gasto.fecha);
    if (campo === "categoriaId") return obtenerId(gasto.categoriaId);
    if (campo === "subcategoriaId") return obtenerId(gasto.subcategoriaId);

    return gasto[campo] ?? "";
  };

  const limpiarEdicionLocal = (gastoId, campo) => {
    setEdicionesRapidas((prev) => {
      const siguiente = { ...prev };
      const fila = { ...(siguiente[gastoId] || {}) };

      delete fila[campo];

      if (Object.keys(fila).length === 0) {
        delete siguiente[gastoId];
      } else {
        siguiente[gastoId] = fila;
      }

      return siguiente;
    });
  };

  const abrirEditorDetalle = (gasto) => {
    setDetalleEnEdicion({
      gastoId: gasto._id,
      valor: gasto.detalle || "",
    });
  };

  const cancelarEditorDetalle = () => {
    setDetalleEnEdicion(null);
  };

  const confirmarEditorDetalle = () => {
    if (!detalleEnEdicion?.valor.trim()) {
      alert("El detalle no puede quedar vacio.");
      return;
    }

    api
      .patch(`/gastos/${detalleEnEdicion.gastoId}`, {
        detalle: detalleEnEdicion.valor.trim(),
      })
      .then((response) => {
        dispatch(actualizarGasto(response.data.gasto));
        setDetalleEnEdicion(null);
      })
      .catch((error) => {
        console.error("Error al editar el detalle:", error);
        alert("No se pudo editar el detalle.");
      });
  };

  const guardarCambioRapido = (gasto, campo, valor) => {
    const gastoId = gasto._id;
    const timerId = `${gastoId}-${campo}`;

    // Primero actualizamos la pantalla inmediatamente.
    setEdicionesRapidas((prev) => ({
      ...prev,
      [gastoId]: {
        ...(prev[gastoId] || {}),
        [campo]: valor,
      },
    }));

    // Si el usuario sigue escribiendo, cancelamos el guardado anterior.
    clearTimeout(timersRef.current[timerId]);

    timersRef.current[timerId] = setTimeout(() => {
      const valorParaBackend =
        (campo === "montoBancario" || campo === "porcentaje") && valor !== ""
          ? Number(valor)
          : valor;

      api
        .patch(`/gastos/${gastoId}`, {
          [campo]: valorParaBackend,
        })
        .then((response) => {
          dispatch(actualizarGasto(response.data.gasto));
          limpiarEdicionLocal(gastoId, campo);
        })
        .catch((error) => {
          console.error("Error al guardar cambio rapido:", error);
        });
    }, 1000);
  };

  const eliminarGastosSeleccionados = (gastosSeleccionadosVisibles) => {
    const cantidad = gastosSeleccionadosVisibles.length;
    const confirmar = window.confirm(
      `Estas seguro de que queres eliminar ${cantidad} gasto${cantidad === 1 ? "" : "s"}?`,
    );

    if (!confirmar) return;

    const idsAEliminar = gastosSeleccionadosVisibles.map((gasto) => gasto._id);

    Promise.allSettled(idsAEliminar.map((gastoId) => api.delete(`/gastos/${gastoId}`)))
      .then((resultados) => {
        resultados.forEach((resultado, index) => {
          if (resultado.status === "fulfilled") {
            dispatch(eliminarGasto(idsAEliminar[index]));
          }
        });

        setSeleccionados((ids) => ids.filter((id) => !idsAEliminar.includes(id)));

        const fallidos = resultados.filter((resultado) => resultado.status === "rejected");
        if (fallidos.length > 0) {
          alert(`No se pudieron eliminar ${fallidos.length} gasto${fallidos.length === 1 ? "" : "s"}.`);
        }
      });
  };

  const clonarGastoSeleccionado = (gasto) => {
    const payload = {
      detalle: gasto.detalle,
      cuentaId,
      fecha: fechaParaInput(gasto.fecha),
      montoBancario: Number(gasto.montoBancario || 0),
      porcentaje: Number(gasto.porcentaje || 100),
      incluirMontoReal: Boolean(gasto.incluirMontoReal),
      categoriaId: obtenerId(gasto.categoriaId),
      subcategoriaId: obtenerId(gasto.subcategoriaId),
      cambiarEstado: false,
    };

    api
      .post("/gastos", payload)
      .then((response) => {
        const gastoClonado = response.data.gasto;
        dispatch(agregarGasto(gastoClonado));
        setSeleccionados([]);
        navigate(`/cuentas/${cuentaId}/gastos/gasto/${gastoClonado._id}`);
      })
      .catch((error) => {
        console.error("Error al clonar el gasto:", error);
        alert("No se pudo clonar el gasto.");
      });
  };

  const estaSeleccionado = (gastoId) => seleccionados.includes(gastoId);

  const cambiarSeleccion = (gastoId) => {
    if (estaSeleccionado(gastoId)) {
      setSeleccionados(seleccionados.filter((id) => id !== gastoId));
    } else {
      setSeleccionados([...seleccionados, gastoId]);
    }
  };

  const cambiarSeleccionTodos = (gastosVisibles) => {
    const idsVisibles = gastosVisibles.map((gasto) => gasto._id);
    const todosVisiblesSeleccionados = idsVisibles.every((id) =>
      seleccionados.includes(id),
    );

    if (todosVisiblesSeleccionados) {
      setSeleccionados(seleccionados.filter((id) => !idsVisibles.includes(id)));
    } else {
      setSeleccionados([...new Set([...seleccionados, ...idsVisibles])]);
    }
  };


  const calcularTotal = (gastosVisibles, campo) => {
    return gastosVisibles.reduce((total, gasto) => total + Number(gasto[campo] || 0), 0);
  };

  const formatearMonto = (monto) => {
    return monto.toLocaleString("es-UY", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const renderTablaGastos = (titulo, gastosVisibles, mostrarTotales = false) => {
    const totalMontoBancario = calcularTotal(gastosVisibles, "montoBancario");
    const totalMontoReal = calcularTotal(gastosVisibles, "montoReal");
    const gastosSeleccionadosVisibles = gastosVisibles.filter((gasto) =>
      seleccionados.includes(gasto._id),
    );

    return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h2>{titulo}</h2>
          <p>{gastosVisibles.length} gastos en esta lista.</p>
        </div>
      </header>

      {mostrarTotales && (
        <div className="totals-row">
          <article>
            <span>Cantidad</span>
            <strong>{gastosVisibles.length}</strong>
          </article>
          <article>
            <span>Total monto bancario</span>
            <strong>$ {formatearMonto(totalMontoBancario)}</strong>
          </article>
          <article>
            <span>Total monto real</span>
            <strong>$ {formatearMonto(totalMontoReal)}</strong>
          </article>
        </div>
      )}

      {gastosSeleccionadosVisibles.length > 0 && (
        <div className="selection-actions">
          <span>
            {gastosSeleccionadosVisibles.length} seleccionado
            {gastosSeleccionadosVisibles.length === 1 ? "" : "s"}
          </span>
          <button
            className="selection-action delete-action"
            type="button"
            onClick={() => eliminarGastosSeleccionados(gastosSeleccionadosVisibles)}
          >
            Eliminar
          </button>
          {gastosSeleccionadosVisibles.length === 1 && (
            <button
              className="selection-action"
              type="button"
              onClick={() => clonarGastoSeleccionado(gastosSeleccionadosVisibles[0])}
            >
              Clonar
            </button>
          )}
        </div>
      )}

      {gastosVisibles.length === 0 ? (
        <p className="empty-state">No hay gastos para mostrar.</p>
      ) : (
        <div className="table-shell expenses-table-shell">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={
                    gastosVisibles.length > 0 &&
                    gastosVisibles.every((gasto) =>
                      seleccionados.includes(gasto._id),
                    )
                  }
                  onChange={() => cambiarSeleccionTodos(gastosVisibles)}
                />
              </th>
              <th>Fecha</th>
              <th>Detalle</th>
              <th>Bancario</th>
              <th>%</th>
              <th>Real</th>
              <th>Categoria</th>
              <th>Subcategoria</th>
              <th>Incluye</th>
            </tr>
          </thead>
          <tbody>
            {gastosVisibles.map((gasto) => {
              const categoriaActual = obtenerValorVisible(gasto, "categoriaId");
              const subcategoriaActual = obtenerValorVisible(
                gasto,
                "subcategoriaId",
              );

              return (
                <tr key={gasto._id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={estaSeleccionado(gasto._id)}
                      onChange={() => cambiarSeleccion(gasto._id)}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      type="date"
                      value={obtenerValorVisible(gasto, "fecha")}
                      onChange={(event) =>
                        guardarCambioRapido(gasto, "fecha", event.target.value)
                      }
                    />
                  </td>
                  <td className="detail-name-cell">
                    <div className="detail-name-wrap">
                      <Link
                        className="detail-name-text detail-name-link"
                        to={`/cuentas/${cuentaId}/gastos/gasto/${gasto._id}`}
                      >
                        {gasto.detalle}
                      </Link>
                      <button
                        className="edit-detail-button"
                        type="button"
                        title="Editar detalle"
                        aria-label={`Editar detalle ${gasto.detalle}`}
                        onClick={() => abrirEditorDetalle(gasto)}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          focusable="false"
                        >
                          <path d="M4 20h12a4 4 0 0 0 4-4v-5h-3v5a1 1 0 0 1-1 1H5V6h7V3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                          <path d="m9 14 1-4 7.7-7.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4L15 14l-4 1a1.2 1.2 0 0 1-1.4-1.4Z" />
                        </svg>
                      </button>

                      {detalleEnEdicion?.gastoId === gasto._id && (
                        <div className="detail-popover">
                          <label>
                            Detalle
                            <input
                              type="text"
                              value={detalleEnEdicion.valor}
                              onChange={(event) =>
                                setDetalleEnEdicion({
                                  ...detalleEnEdicion,
                                  valor: event.target.value,
                                })
                              }
                            />
                          </label>
                          <div className="detail-popover-actions">
                            <button
                              className="detail-cancel-button"
                              type="button"
                              onClick={cancelarEditorDetalle}
                            >
                              Cancelar
                            </button>
                            <button type="button" onClick={confirmarEditorDetalle}>
                              Confirmar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      className="table-input table-input-number"
                      type="number"
                      value={obtenerValorVisible(gasto, "montoBancario")}
                      onChange={(event) =>
                        guardarCambioRapido(
                          gasto,
                          "montoBancario",
                          event.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="table-input table-input-small"
                      type="number"
                      min="0"
                      max="100"
                      value={obtenerValorVisible(gasto, "porcentaje")}
                      onChange={(event) =>
                        guardarCambioRapido(
                          gasto,
                          "porcentaje",
                          event.target.value,
                        )
                      }
                    />
                  </td>
                  <td>{gasto.montoReal}</td>
                  <td>
                    <select
                      className="table-select"
                      value={categoriaActual}
                      title={obtenerNombreCategoria(categoriaActual, categorias)}
                      onChange={(event) =>
                        guardarCambioRapido(
                          gasto,
                          "categoriaId",
                          event.target.value,
                        )
                      }
                    >
                      <option value="">Sin categoria</option>
                      {categorias.map((categoria) => (
                        <option key={categoria._id} value={categoria._id}>
                          {categoria.nombreCategoria}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="table-select"
                      value={subcategoriaActual}
                      title={obtenerNombreSubcategoria(
                        subcategoriaActual,
                        subcategorias,
                      )}
                      onChange={(event) =>
                        guardarCambioRapido(
                          gasto,
                          "subcategoriaId",
                          event.target.value,
                        )
                      }
                    >
                      <option value="">Sin subcategoria</option>
                      {subcategorias.map((subcategoria) => (
                        <option key={subcategoria._id} value={subcategoria._id}>
                          {subcategoria.nombreSubcategoria}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(
                        obtenerValorVisible(gasto, "incluirMontoReal"),
                      )}
                      onChange={(event) =>
                        guardarCambioRapido(
                          gasto,
                          "incluirMontoReal",
                          event.target.checked,
                        )
                      }
                    />
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </section>
    );
  };
  const aplicarCambiosMasivos = () => {
    if (seleccionados.length === 0) {
      alert("Selecciona al menos un gasto.");
      return;
    }

    const payload = {};

    if (bulk.categoriaId) payload.categoriaId = bulk.categoriaId;
    if (bulk.subcategoriaId) payload.subcategoriaId = bulk.subcategoriaId;
    if (bulk.incluirMontoReal !== "") {
      payload.incluirMontoReal = bulk.incluirMontoReal === "true";
    }
    if (bulk.cambiarEstado) payload.cambiarEstado = true;

    if (Object.keys(payload).length === 0) {
      alert("Elige algun cambio para aplicar.");
      return;
    }

    setResultadoBulk("Aplicando cambios...");

    // allSettled permite que un gasto falle sin cancelar los demas.
    Promise.allSettled(
      seleccionados.map((gastoId) => api.patch(`/gastos/${gastoId}`, payload)),
    ).then((resultados) => {
      const exitosos = resultados.filter(
        (resultado) => resultado.status === "fulfilled",
      );
      const fallidos = resultados.filter(
        (resultado) => resultado.status === "rejected",
      );

      exitosos.forEach((resultado) => {
        dispatch(actualizarGasto(resultado.value.data.gasto));
      });

      const idsActualizados = exitosos.map(
        (resultado) => resultado.value.data.gasto._id,
      );

      setSeleccionados(
        seleccionados.filter((gastoId) => !idsActualizados.includes(gastoId)),
      );

      setBulk({
        categoriaId: "",
        subcategoriaId: "",
        incluirMontoReal: "",
        cambiarEstado: false,
      });

      if (fallidos.length === 0) {
        setResultadoBulk(`${exitosos.length} gastos actualizados correctamente.`);
        return;
      }

      setResultadoBulk(
        `${exitosos.length} actualizados. ${fallidos.length} no se pudieron actualizar. Si intentaste pasar a creado, revisa que tengan todos los campos completos.`,
      );
    });
  };

  return (
    <section className="page-section">
      <div>
        <h1>{cuentaActual?.nombreCuenta || ""}</h1>
      </div>

      <div className="action-row">
        <button type="button" onClick={() => abrirModal("gasto")}>
          Crear gasto
        </button>
        <button type="button" onClick={() => abrirModal("subcategoria")}>
          Crear subcategoria
        </button>
        <button type="button" onClick={() => abrirModal("categoria")}>
          Crear categoria
        </button>
        <Link className="primary-link" to={`/cuentas/${cuentaId}/importar-excel`}>
          Importar Excel
        </Link>
      </div>

      {modalActivo === "gasto" && (
        <div className="modal-backdrop">
          <section className="edit-modal">
            <div className="edit-modal-header">
              <h2>Crear gasto</h2>
              <button className="secondary-button" type="button" onClick={cerrarModal}>
                Cerrar
              </button>
            </div>

            <label>
              Detalle
              <input
                type="text"
                value={formGasto.detalle}
                onChange={(event) => cambiarFormGasto("detalle", event.target.value)}
              />
            </label>

            <label>
              Fecha
              <input
                type="date"
                value={formGasto.fecha}
                onChange={(event) => cambiarFormGasto("fecha", event.target.value)}
              />
            </label>

            <label>
              Monto bancario
              <input
                type="number"
                value={formGasto.montoBancario}
                onChange={(event) =>
                  cambiarFormGasto("montoBancario", event.target.value)
                }
              />
            </label>

            <label>
              Porcentaje
              <input
                type="number"
                min="0"
                max="100"
                value={formGasto.porcentaje}
                onChange={(event) => cambiarFormGasto("porcentaje", event.target.value)}
              />
            </label>

            <label>
              Categoria
              <select
                value={formGasto.categoriaId}
                onChange={(event) => cambiarFormGasto("categoriaId", event.target.value)}
              >
                <option value="">Sin categoria</option>
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
                value={formGasto.subcategoriaId}
                onChange={(event) =>
                  cambiarFormGasto("subcategoriaId", event.target.value)
                }
              >
                <option value="">Seleccionar subcategoria</option>
                {subcategorias.map((subcategoria) => (
                  <option key={subcategoria._id} value={subcategoria._id}>
                    {subcategoria.nombreSubcategoria}
                  </option>
                ))}
              </select>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formGasto.incluirMontoReal}
                onChange={(event) =>
                  cambiarFormGasto("incluirMontoReal", event.target.checked)
                }
              />
              Incluir en monto real
            </label>

            {errorModal && <p className="error-text">{errorModal}</p>}

            <div className="edit-modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => guardarNuevoGasto(false)}
              >
                Guardar pendiente
              </button>
              <button
                type="button"
                disabled={!gastoCompleto}
                onClick={() => guardarNuevoGasto(true)}
              >
                Crear
              </button>
            </div>
          </section>
        </div>
      )}

      {modalActivo === "categoria" && (
        <div className="modal-backdrop">
          <section className="edit-modal">
            <div className="edit-modal-header">
              <h2>Crear categoria</h2>
              <button className="secondary-button" type="button" onClick={cerrarModal}>
                Cerrar
              </button>
            </div>

            <label>
              Nombre
              <input
                type="text"
                value={formCategoria.nombreCategoria}
                onChange={(event) =>
                  setFormCategoria({ nombreCategoria: event.target.value })
                }
              />
            </label>

            {errorModal && <p className="error-text">{errorModal}</p>}

            <div className="edit-modal-actions">
              <button className="secondary-button" type="button" onClick={cerrarModal}>
                Cancelar
              </button>
              <button type="button" onClick={guardarNuevaCategoria}>
                Crear
              </button>
            </div>
          </section>
        </div>
      )}

      {modalActivo === "subcategoria" && (
        <div className="modal-backdrop">
          <section className="edit-modal">
            <div className="edit-modal-header">
              <h2>Crear subcategoria</h2>
              <button className="secondary-button" type="button" onClick={cerrarModal}>
                Cerrar
              </button>
            </div>

            <label>
              Nombre
              <input
                type="text"
                value={formSubcategoria.nombreSubcategoria}
                onChange={(event) =>
                  setFormSubcategoria({
                    ...formSubcategoria,
                    nombreSubcategoria: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Categoria (opcional)
              <select
                value={formSubcategoria.categoria}
                onChange={(event) =>
                  setFormSubcategoria({
                    ...formSubcategoria,
                    categoria: event.target.value,
                  })
                }
              >
                <option value="">Sin categoria</option>
                {categorias.map((categoria) => (
                  <option key={categoria._id} value={categoria._id}>
                    {categoria.nombreCategoria}
                  </option>
                ))}
              </select>
            </label>

            {errorModal && <p className="error-text">{errorModal}</p>}

            <div className="edit-modal-actions">
              <button className="secondary-button" type="button" onClick={cerrarModal}>
                Cancelar
              </button>
              <button type="button" onClick={guardarNuevaSubcategoria}>
                Crear
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="filters-panel">
        <h3>Filtros</h3>

        <label>
          Detalle
          <input
            type="text"
            value={filtros.detalle}
            onChange={(event) => cambiarFiltro("detalle", event.target.value)}
            placeholder="Buscar detalle"
          />
        </label>

        <label>
          Categoria
          <select
            value={filtros.categoriaId}
            onChange={(event) => cambiarFiltro("categoriaId", event.target.value)}
          >
            <option value="">Todas</option>
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
            value={filtros.subcategoriaId}
            onChange={(event) =>
              cambiarFiltro("subcategoriaId", event.target.value)
            }
          >
            <option value="">Todas</option>
            {subcategorias.map((subcategoria) => (
              <option key={subcategoria._id} value={subcategoria._id}>
                {subcategoria.nombreSubcategoria}
              </option>
            ))}
          </select>
        </label>
<label>
          Fecha
          <select
            value={filtros.fechaModo}
            onChange={(event) => cambiarFiltro("fechaModo", event.target.value)}
          >
            <option value="">Sin filtro</option>
            <option value="mes">Por mes</option>
            <option value="rango">Por rango</option>
          </select>
        </label>

        {filtros.fechaModo === "mes" && (
          <>
            <label>
              Mes
              <select
                value={filtros.fechaMes}
                onChange={(event) => cambiarFiltro("fechaMes", event.target.value)}
              >
                <option value="">Todos los meses</option>
                {mesesDelAnio.map((mes) => (
                  <option key={mes.valor} value={mes.valor}>
                    {mes.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Año
              <select
                value={filtros.fechaAnio}
                onChange={(event) => cambiarFiltro("fechaAnio", event.target.value)}
              >
                <option value="">Todos los años</option>
                {aniosDisponibles.map((anio) => (
                  <option key={anio} value={anio}>
                    {anio}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {filtros.fechaModo === "rango" && (
          <>
            <label>
              Desde
              <input
                type="date"
                value={filtros.fechaDesde}
                onChange={(event) => cambiarFiltro("fechaDesde", event.target.value)}
              />
            </label>

            <label>
              Hasta
              <input
                type="date"
                value={filtros.fechaHasta}
                onChange={(event) => cambiarFiltro("fechaHasta", event.target.value)}
              />
            </label>
          </>
        )}

        <label>
          Monto bancario
          <select
            value={filtros.montoBancarioModo}
            onChange={(event) =>
              cambiarFiltro("montoBancarioModo", event.target.value)
            }
          >
            <option value="">Sin filtro</option>
            <option value="monto">Monto exacto</option>
            <option value="rango">Por rango</option>
          </select>
        </label>

        {filtros.montoBancarioModo === "monto" && (
          <label>
            Monto bancario exacto
            <input
              type="number"
              value={filtros.montoBancario}
              onChange={(event) =>
                cambiarFiltro("montoBancario", event.target.value)
              }
            />
          </label>
        )}

        {filtros.montoBancarioModo === "rango" && (
          <>
            <label>
              Bancario desde
              <input
                type="number"
                value={filtros.montoBancarioDesde}
                onChange={(event) =>
                  cambiarFiltro("montoBancarioDesde", event.target.value)
                }
              />
            </label>

            <label>
              Bancario hasta
              <input
                type="number"
                value={filtros.montoBancarioHasta}
                onChange={(event) =>
                  cambiarFiltro("montoBancarioHasta", event.target.value)
                }
              />
            </label>
          </>
        )}

        <label>
          Monto real
          <select
            value={filtros.montoRealModo}
            onChange={(event) => cambiarFiltro("montoRealModo", event.target.value)}
          >
            <option value="">Sin filtro</option>
            <option value="monto">Monto exacto</option>
            <option value="rango">Por rango</option>
          </select>
        </label>

        {filtros.montoRealModo === "monto" && (
          <label>
            Monto real exacto
            <input
              type="number"
              value={filtros.montoReal}
              onChange={(event) => cambiarFiltro("montoReal", event.target.value)}
            />
          </label>
        )}

        {filtros.montoRealModo === "rango" && (
          <>
            <label>
              Real desde
              <input
                type="number"
                value={filtros.montoRealDesde}
                onChange={(event) =>
                  cambiarFiltro("montoRealDesde", event.target.value)
                }
              />
            </label>

            <label>
              Real hasta
              <input
                type="number"
                value={filtros.montoRealHasta}
                onChange={(event) =>
                  cambiarFiltro("montoRealHasta", event.target.value)
                }
              />
            </label>
          </>
        )}
      </section>

      <section className="bulk-panel">
        <strong>{seleccionados.length} seleccionados</strong>

        <select
          value={bulk.categoriaId}
          onChange={(event) => cambiarBulk("categoriaId", event.target.value)}
        >
          <option value="">Categoria sin cambios</option>
          {categorias.map((categoria) => (
            <option key={categoria._id} value={categoria._id}>
              {categoria.nombreCategoria}
            </option>
          ))}
        </select>

        <select
          value={bulk.subcategoriaId}
          onChange={(event) => cambiarBulk("subcategoriaId", event.target.value)}
        >
          <option value="">Subcategoria sin cambios</option>
          {subcategorias.map((subcategoria) => (
            <option key={subcategoria._id} value={subcategoria._id}>
              {subcategoria.nombreSubcategoria}
            </option>
          ))}
        </select>

        <select
          value={bulk.incluirMontoReal}
          onChange={(event) =>
            cambiarBulk("incluirMontoReal", event.target.value)
          }
        >
          <option value="">Monto real sin cambios</option>
          <option value="true">Incluir en monto real</option>
          <option value="false">No incluir en monto real</option>
        </select>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={bulk.cambiarEstado}
            onChange={(event) => cambiarBulk("cambiarEstado", event.target.checked)}
          />
          Pasar a creado
        </label>

        <button type="button" onClick={aplicarCambiosMasivos}>
          Aplicar cambios
        </button>

        {resultadoBulk && <p className="bulk-message">{resultadoBulk}</p>}
      </section>
      <header className="page-header">
        <div>
          <h1>Lista de Gastos</h1>
          <p>Edicion rapida con guardado automatico despues de 1 segundo.</p>
        </div>
      </header>

      {gastosPendientes.length > 0 && renderTablaGastos("Gastos pendientes", gastosPendientes)}
      {renderTablaGastos("Gastos creados", gastosCreados, true)}
    </section>
  );
}

export default DesglocePage;
















