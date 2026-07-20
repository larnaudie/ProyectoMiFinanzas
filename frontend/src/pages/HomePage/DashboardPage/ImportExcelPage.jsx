import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";

const obtenerId = (valor) => {
  if (!valor) return "";
  if (typeof valor === "object") return valor._id || valor.id || "";
  return valor;
};

const fechaParaInput = (fecha) => {
  if (!fecha) return "";
  return String(fecha).slice(0, 10);
};

const formatearFecha = (fecha) => {
  if (!fecha) return "";
  return new Date(fecha).toLocaleDateString("es-UY");
};

const formatearMonto = (monto) => {
  if (monto === "" || monto === null || monto === undefined) return "";
  const numero = Number(monto || 0);
  return numero.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const normalizarTexto = (texto) =>
  String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const calcularMontoReal = ({ montoBancario, porcentaje, incluirMontoReal }) => {
  const monto = Number(montoBancario);
  const porcentajeNumero = Number(porcentaje);

  if (!incluirMontoReal) return 0;
  if (!Number.isFinite(monto) || !Number.isFinite(porcentajeNumero)) return 0;

  return Number(((monto * porcentajeNumero) / 100).toFixed(2));
};

const obtenerMensajeError = (error, mensajeDefault) => {
  const data = error.response?.data;

  if (Array.isArray(data?.error) && data.error.length > 0) {
    return data.error.map((item) => item.message).join(". ");
  }

  return data?.message || data?.mensaje || mensajeDefault;
};

const gastoDesdeMovimiento = (movimiento) => {
  const fila = {
    _id: movimiento._id,
    fecha: fechaParaInput(movimiento.fechaBanco),
    detalle: movimiento.detalleOriginal || "",
    montoBancario: movimiento.montoBancario ?? "",
    porcentaje: "",
    montoReal: "",
    categoriaId: "",
    subcategoriaId: "",
    incluirMontoReal: true,
    estado: movimiento.estadoImportacion || "pendiente",
    gastoId: obtenerId(movimiento.gastoId),
  };

  return {
    ...fila,
    montoReal: calcularMontoReal(fila),
  };
};

const gastoDesdeImportacionPersonal = (item) => {
  const gasto = item.gasto || item;

  return {
    _id: gasto._id,
    fecha: fechaParaInput(gasto.fecha),
    detalle: gasto.detalle || "",
    montoBancario: gasto.montoBancario ?? "",
    porcentaje: gasto.porcentaje ?? "",
    montoReal: gasto.montoReal ?? 0,
    categoriaId: obtenerId(gasto.categoriaId),
    subcategoriaId: obtenerId(gasto.subcategoriaId),
    nombreSubcategoria: item.nombreSubcategoria || gasto.subcategoriaId?.nombreSubcategoria || "",
    incluirMontoReal: Boolean(gasto.incluirMontoReal),
    estado: gasto.estado || "pendiente",
  };
};

const gastoCompletoParaCrear = (gasto) => {
  return (
    gasto.detalle &&
    gasto.fecha &&
    Number.isFinite(Number(gasto.montoBancario)) &&
    Number(gasto.montoBancario) !== 0 &&
    Number.isFinite(Number(gasto.porcentaje)) &&
    Number(gasto.porcentaje) >= 0 &&
    Number(gasto.porcentaje) <= 100 &&
    gasto.categoriaId &&
    gasto.subcategoriaId
  );
};

const obtenerNombresSubcategoriasNuevas = (gastos, subcategorias) => {
  const existentes = new Set(
    subcategorias.map((subcategoria) => normalizarTexto(subcategoria.nombreSubcategoria)),
  );

  const nombres = gastos
    .map((gasto) => gasto.nombreSubcategoria)
    .filter(Boolean)
    .filter((nombre) => !existentes.has(normalizarTexto(nombre)));

  return [...new Set(nombres.map((nombre) => nombre.trim()))];
};

const combinarSubcategoriasUnicas = (...listas) => {
  const mapa = new Map();

  listas.flat().forEach((subcategoria) => {
    if (!subcategoria?._id) return;
    mapa.set(String(subcategoria._id), subcategoria);
  });

  return [...mapa.values()];
};

const buscarSubcategoriaPorNombre = (subcategorias, nombreSubcategoria) => {
  const nombreNormalizado = normalizarTexto(nombreSubcategoria);
  if (!nombreNormalizado) return null;

  return subcategorias.find(
    (subcategoria) =>
      normalizarTexto(subcategoria.nombreSubcategoria) === nombreNormalizado,
  );
};

const obtenerSubcategoriaSeleccionada = (gasto, subcategorias) => {
  return (
    gasto.subcategoriaId ||
    buscarSubcategoriaPorNombre(subcategorias, gasto.nombreSubcategoria)?._id ||
    ""
  );
};
function ImportExcelPage() {
  const { cuentaId } = useParams();
  const timersRef = useRef({});

  const [file, setFile] = useState(null);
  const [archivoPersonal, setArchivoPersonal] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [resultadoPersonal, setResultadoPersonal] = useState(null);
  const [gastosPersonales, setGastosPersonales] = useState([]);
  const [gastosPersonalesSeleccionados, setGastosPersonalesSeleccionados] = useState([]);
  const [gastosBancarios, setGastosBancarios] = useState([]);
  const [gastosBancariosSeleccionados, setGastosBancariosSeleccionados] = useState([]);
  const [bulkBancario, setBulkBancario] = useState({
    fecha: "",
    categoriaId: "",
    subcategoriaId: "",
    porcentaje: "",
    incluirMontoReal: "",
  });
  const [aplicandoBulkBancario, setAplicandoBulkBancario] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [subcategoriasDetectadas, setSubcategoriasDetectadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [creandoSubcategorias, setCreandoSubcategorias] = useState(false);
  const [error, setError] = useState("");
  const [mensajePersonal, setMensajePersonal] = useState("");
  const [bulkPersonal, setBulkPersonal] = useState({
    fecha: "",
    categoriaId: "",
    subcategoriaId: "",
    porcentaje: "",
    incluirMontoReal: "",
  });
  const [aplicandoBulkPersonal, setAplicandoBulkPersonal] = useState(false);
  const [mensajeBancario, setMensajeBancario] = useState("");
  const [mensajeSubcategorias, setMensajeSubcategorias] = useState("");

  const cargarSubcategorias = () => {
    return api
      .get("/subcategorias")
      .then((response) => {
        const subcategoriasActualizadas = response.data.subcategorias || [];
        setSubcategorias(subcategoriasActualizadas);
        return subcategoriasActualizadas;
      })
      .catch((apiError) => {
        console.error("Error al obtener subcategorias:", apiError);
        return [];
      });
  };

  const cargarMovimientosPendientes = () => {
    setCargandoMovimientos(true);

    api
      .get(`/importaciones/cuentas/${cuentaId}/movimientos?estado=pendiente`)
      .then((response) => {
        setGastosBancariosSeleccionados([]);
        setGastosBancarios((response.data.movimientos || []).map(gastoDesdeMovimiento));
      })
      .catch((apiError) => {
        setError(
          obtenerMensajeError(
            apiError,
            "No se pudieron cargar los movimientos pendientes.",
          ),
        );
      })
      .finally(() => {
        setCargandoMovimientos(false);
      });
  };

  useEffect(() => {
    cargarMovimientosPendientes();

    api
      .get("/categorias")
      .then((response) => setCategorias(response.data.categorias || []))
      .catch((apiError) => {
        console.error("Error al obtener categorias:", apiError);
      });

    cargarSubcategorias();
  }, [cuentaId]);

  const importar = async (event) => {
    event.preventDefault();

    if (!file) {
      setError("Selecciona un archivo Excel bancario antes de importar.");
      return;
    }

    const formData = new FormData();
    formData.append("excel", file);

    setLoading(true);
    setError("");
    setMensajeBancario("");
    setResultado(null);

    try {
      const { data } = await api.post(
        `/importaciones/cuentas/${cuentaId}/excel`,
        formData,
      );

      setResultado(data);
      setGastosBancariosSeleccionados([]);
      setFile(null);

      // El import bancario devuelve objetos { estado, movimiento, posiblesDuplicados }.
      // Tomamos el movimiento y lo transformamos a una fila editable con forma de gasto.
      setGastosBancarios(
        (data.movimientos || [])
          .map((item) => item.movimiento)
          .filter(Boolean)
          .map(gastoDesdeMovimiento),
      );
    } catch (apiError) {
      setError(obtenerMensajeError(apiError, "No se pudo importar el Excel bancario."));
    } finally {
      setLoading(false);
    }
  };

  const importarPersonal = async (event) => {
    event.preventDefault();

    if (!archivoPersonal) {
      setError("Selecciona un archivo Excel personal antes de importar.");
      return;
    }

    const formData = new FormData();
    formData.append("excel", archivoPersonal);

    setLoadingPersonal(true);
    setError("");
    setMensajePersonal("");
    setMensajeSubcategorias("");
    setResultadoPersonal(null);
    setGastosPersonales([]);
    setGastosPersonalesSeleccionados([]);
    setSubcategoriasDetectadas([]);

    try {
      const { data } = await api.post(
        `/importaciones/cuentas/${cuentaId}/excel-personal`,
        formData,
      );

      const gastosImportados = (data.gastos || []).map(gastoDesdeImportacionPersonal);
      const nuevasSubcategorias = obtenerNombresSubcategoriasNuevas(
        gastosImportados,
        subcategorias,
      );

      setResultadoPersonal(data);
      setGastosPersonales(gastosImportados);
      setSubcategoriasDetectadas(
        nuevasSubcategorias.map((nombreSubcategoria) => ({
          nombreSubcategoria,
          categoria: "",
        })),
      );
      setArchivoPersonal(null);
    } catch (apiError) {
      setError(
        obtenerMensajeError(apiError, "No se pudo importar el Excel personal."),
      );
    } finally {
      setLoadingPersonal(false);
    }
  };

  const actualizarGastoLocal = (gastoActualizado) => {
    setGastosPersonales((actuales) =>
      actuales.map((gasto) =>
        gasto._id === gastoActualizado._id
          ? gastoDesdeImportacionPersonal(gastoActualizado)
          : gasto,
      ),
    );
  };

  const cambiarGastoPersonal = (gastoId, campo, valor) => {
    setMensajePersonal("");

    setGastosPersonales((actuales) =>
      actuales.map((gasto) => {
        if (gasto._id !== gastoId) return gasto;

        const actualizado = { ...gasto, [campo]: valor };
        return {
          ...actualizado,
          montoReal: calcularMontoReal(actualizado),
        };
      }),
    );

    clearTimeout(timersRef.current[`${gastoId}-${campo}`]);

    timersRef.current[`${gastoId}-${campo}`] = setTimeout(() => {
      const valorParaBackend =
        ["montoBancario", "porcentaje"].includes(campo) && valor !== ""
          ? Number(valor)
          : valor;

      api
        .patch(`/gastos/${gastoId}`, { [campo]: valorParaBackend })
        .then((response) => actualizarGastoLocal(response.data.gasto))
        .catch((apiError) => {
          setMensajePersonal(
            obtenerMensajeError(apiError, "No se pudo guardar el cambio del gasto."),
          );
        });
    }, 1000);
  };

  const crearGastoPersonal = (gasto) => {
    if (!gastoCompletoParaCrear(gasto)) {
      setMensajePersonal(
        "Para pasar a creado faltan datos: detalle, fecha, monto bancario distinto de 0, porcentaje valido, categoria y subcategoria.",
      );
      return;
    }

    api
      .patch(`/gastos/${gasto._id}`, { cambiarEstado: true })
      .then((response) => {
        actualizarGastoLocal(response.data.gasto);
        setMensajePersonal("Gasto actualizado a creado.");
      })
      .catch((apiError) => {
        setMensajePersonal(
          obtenerMensajeError(apiError, "No se pudo pasar el gasto a creado."),
        );
      });
  };

  const cambiarGastoBancario = (movimientoId, campo, valor) => {
    setMensajeBancario("");

    setGastosBancarios((actuales) =>
      actuales.map((gasto) => {
        if (gasto._id !== movimientoId) return gasto;

        const actualizado = { ...gasto, [campo]: valor };
        return {
          ...actualizado,
          montoReal: calcularMontoReal(actualizado),
        };
      }),
    );
  };


  const cambiarSeleccionGastoBancario = (movimientoId) => {
    setGastosBancariosSeleccionados((actuales) =>
      actuales.includes(movimientoId)
        ? actuales.filter((id) => id !== movimientoId)
        : [...actuales, movimientoId],
    );
  };

  const cambiarSeleccionTodosGastosBancarios = (checked) => {
    const movimientosEditables = gastosBancarios
      .filter((gasto) => !gasto.gastoId)
      .map((gasto) => gasto._id);

    setGastosBancariosSeleccionados(checked ? movimientosEditables : []);
  };

  const cambiarBulkBancario = (campo, valor) => {
    setBulkBancario((actual) => ({ ...actual, [campo]: valor }));
  };

  const aplicarCambiosBulkBancario = () => {
    if (gastosBancariosSeleccionados.length === 0) {
      setMensajeBancario("Selecciona al menos un movimiento para aplicar cambios en masa.");
      return;
    }

    const cambios = {};

    if (bulkBancario.fecha) cambios.fecha = bulkBancario.fecha;
    if (bulkBancario.categoriaId) cambios.categoriaId = bulkBancario.categoriaId;
    if (bulkBancario.subcategoriaId) cambios.subcategoriaId = bulkBancario.subcategoriaId;
    if (bulkBancario.porcentaje !== "") cambios.porcentaje = Number(bulkBancario.porcentaje);
    if (bulkBancario.incluirMontoReal !== "") {
      cambios.incluirMontoReal = bulkBancario.incluirMontoReal === "true";
    }

    if (Object.keys(cambios).length === 0) {
      setMensajeBancario("Elige al menos un campo para aplicar a los seleccionados.");
      return;
    }

    setAplicandoBulkBancario(true);
    setMensajeBancario("");

    setGastosBancarios((actuales) =>
      actuales.map((gasto) => {
        if (!gastosBancariosSeleccionados.includes(gasto._id) || gasto.gastoId) {
          return gasto;
        }

        const actualizado = { ...gasto, ...cambios };

        return {
          ...actualizado,
          montoReal: calcularMontoReal(actualizado),
        };
      }),
    );

    setBulkBancario({
      fecha: "",
      categoriaId: "",
      subcategoriaId: "",
      porcentaje: "",
      incluirMontoReal: "",
    });
    setGastosBancariosSeleccionados([]);
    setAplicandoBulkBancario(false);
    setMensajeBancario("Cambios aplicados a los movimientos seleccionados.");
  };

  const crearGastoBancario = (gasto) => {
    if (!gastoCompletoParaCrear(gasto)) {
      setMensajeBancario(
        "Para crear el gasto faltan datos: detalle, fecha, monto bancario distinto de 0, porcentaje valido, categoria y subcategoria.",
      );
      return;
    }

    api
      .post(`/importaciones/movimientos/${gasto._id}/crear-gasto`, {
        detalle: gasto.detalle,
        fecha: gasto.fecha,
        porcentaje: Number(gasto.porcentaje),
        incluirMontoReal: Boolean(gasto.incluirMontoReal),
        categoriaId: gasto.categoriaId,
        subcategoriaId: gasto.subcategoriaId,
        cambiarEstado: true,
      })
      .then((response) => {
        const gastoCreado = response.data.gasto;
        setGastosBancarios((actuales) =>
          actuales.map((item) =>
            item._id === gasto._id
              ? { ...item, estado: "vinculado", gastoId: gastoCreado._id }
              : item,
          ),
        );
        setMensajeBancario("Gasto creado desde el movimiento bancario.");
        setGastosBancariosSeleccionados((actuales) => actuales.filter((id) => id !== gasto._id));
      })
      .catch((apiError) => {
        setMensajeBancario(
          obtenerMensajeError(apiError, "No se pudo crear el gasto desde el movimiento."),
        );
      });
  };

  const cambiarCategoriaSubcategoriaDetectada = (nombreSubcategoria, categoria) => {
    setSubcategoriasDetectadas((actuales) =>
      actuales.map((item) =>
        item.nombreSubcategoria === nombreSubcategoria ? { ...item, categoria } : item,
      ),
    );
  };

  const crearSubcategoriasDetectadas = async () => {
    const subcategoriasParaCrear = subcategoriasDetectadas.filter((item) =>
      item.nombreSubcategoria.trim(),
    );

    if (subcategoriasParaCrear.length === 0) {
      setSubcategoriasDetectadas([]);
      setMensajePersonal("No habia subcategorias nuevas para crear.");
      return;
    }

    setCreandoSubcategorias(true);
    setMensajeSubcategorias("");

    try {
      // Primero pedimos la lista fresca desde Mongo. Asi evitamos crear duplicados
      // si el usuario ya habia creado alguna subcategoria en otro intento.
      const subcategoriasAntes = await cargarSubcategorias();
      const nombresExistentes = new Set(
        subcategoriasAntes.map((subcategoria) =>
          normalizarTexto(subcategoria.nombreSubcategoria),
        ),
      );

      const subcategoriasNuevas = subcategoriasParaCrear.filter(
        (item) => !nombresExistentes.has(normalizarTexto(item.nombreSubcategoria)),
      );

      const respuestasCreacion = await Promise.all(
        subcategoriasNuevas.map((item) => {
          const payload = { nombreSubcategoria: item.nombreSubcategoria };

          if (item.categoria) {
            payload.categoria = item.categoria;
          }

          return api.post("/subcategorias", payload);
        }),
      );

      const subcategoriasCreadas = respuestasCreacion
        .map(
          (response) =>
            response.data.subcategoria ||
            response.data.subcategoriaCreada ||
            response.data,
        )
        .filter((subcategoria) => subcategoria && subcategoria._id);

      // Volvemos a pedir la lista despues de crear. Esta es la fuente real
      // para repintar dropdowns y para que Manage vea lo mismo.
      const subcategoriasDespues = await cargarSubcategorias();
      const subcategoriasDisponibles = combinarSubcategoriasUnicas(
        subcategoriasAntes,
        subcategoriasCreadas,
        subcategoriasDespues,
      );

      setSubcategorias(subcategoriasDisponibles);

      const categoriaPorNombre = new Map(
        subcategoriasParaCrear.map((item) => [
          normalizarTexto(item.nombreSubcategoria),
          item.categoria,
        ]),
      );

      const gastosActualizados = gastosPersonales.map((gasto) => {
        const claveNombre = normalizarTexto(gasto.nombreSubcategoria);
        const subcategoria = buscarSubcategoriaPorNombre(
          subcategoriasDisponibles,
          gasto.nombreSubcategoria,
        );
        const categoriaId = categoriaPorNombre.get(claveNombre) || gasto.categoriaId;

        return subcategoria
          ? {
              ...gasto,
              categoriaId: categoriaId || gasto.categoriaId,
              subcategoriaId: subcategoria._id,
            }
          : gasto;
      });

      await Promise.all(
        gastosActualizados
          .filter((gasto) => gasto.subcategoriaId)
          .map((gasto) => {
            const payload = { subcategoriaId: gasto.subcategoriaId };

            if (gasto.categoriaId) {
              payload.categoriaId = gasto.categoriaId;
            }

            return api.patch(`/gastos/${gasto._id}`, payload);
          }),
      );

      setGastosPersonales(gastosActualizados);
      setSubcategoriasDetectadas([]);
      setMensajePersonal(
        subcategoriasNuevas.length > 0
          ? "Subcategorias nuevas creadas y vinculadas a los gastos importados."
          : "Las subcategorias detectadas ya existian y fueron vinculadas a los gastos importados.",
      );
    } catch (apiError) {
      setMensajeSubcategorias(
        obtenerMensajeError(apiError, "No se pudieron crear las subcategorias nuevas."),
      );
    } finally {
      setCreandoSubcategorias(false);
    }
  };

  const cambiarSeleccionGastoPersonal = (gastoId) => {
    setGastosPersonalesSeleccionados((actuales) =>
      actuales.includes(gastoId)
        ? actuales.filter((id) => id !== gastoId)
        : [...actuales, gastoId],
    );
  };

  const cambiarSeleccionTodosGastosPersonales = (checked) => {
    setGastosPersonalesSeleccionados(checked ? gastosPersonales.map((gasto) => gasto._id) : []);
  };

  const eliminarGastosPersonalesSeleccionados = async () => {
    const cantidad = gastosPersonalesSeleccionados.length;

    if (cantidad === 0) return;

    const confirmaEliminar = window.confirm(
      `Vas a eliminar ${cantidad} gasto${cantidad === 1 ? "" : "s"}. Esta accion no se puede deshacer.`,
    );

    if (!confirmaEliminar) return;

    setMensajePersonal("");

    try {
      await Promise.all(
        gastosPersonalesSeleccionados.map((gastoId) => api.delete(`/gastos/${gastoId}`)),
      );

      setGastosPersonales((actuales) =>
        actuales.filter((gasto) => !gastosPersonalesSeleccionados.includes(gasto._id)),
      );
      setGastosPersonalesSeleccionados([]);
      setMensajePersonal(`${cantidad} gasto${cantidad === 1 ? "" : "s"} eliminado${cantidad === 1 ? "" : "s"}.`);
    } catch (apiError) {
      setMensajePersonal(obtenerMensajeError(apiError, "No se pudieron eliminar los gastos seleccionados."));
    }
  };

  const cambiarBulkPersonal = (campo, valor) => {
    setBulkPersonal((actual) => ({ ...actual, [campo]: valor }));
  };

  const aplicarCambiosBulkPersonal = async () => {
    if (gastosPersonalesSeleccionados.length === 0) {
      setMensajePersonal("Selecciona al menos un gasto para aplicar cambios en masa.");
      return;
    }

    const payload = {};

    if (bulkPersonal.fecha) payload.fecha = bulkPersonal.fecha;
    if (bulkPersonal.categoriaId) payload.categoriaId = bulkPersonal.categoriaId;
    if (bulkPersonal.subcategoriaId) payload.subcategoriaId = bulkPersonal.subcategoriaId;
    if (bulkPersonal.porcentaje !== "") payload.porcentaje = Number(bulkPersonal.porcentaje);
    if (bulkPersonal.incluirMontoReal !== "") {
      payload.incluirMontoReal = bulkPersonal.incluirMontoReal === "true";
    }

    if (Object.keys(payload).length === 0) {
      setMensajePersonal("Elige al menos un campo para aplicar a los seleccionados.");
      return;
    }

    setAplicandoBulkPersonal(true);
    setMensajePersonal("");

    try {
      // Cada gasto mantiene su propio id, por eso aplicamos un PATCH por fila seleccionada.
      const respuestas = await Promise.all(
        gastosPersonalesSeleccionados.map((gastoId) => api.patch(`/gastos/${gastoId}`, payload)),
      );

      const gastosActualizados = respuestas
        .map((response) => response.data.gasto)
        .filter(Boolean)
        .map(gastoDesdeImportacionPersonal);

      setGastosPersonales((actuales) =>
        actuales.map((gasto) => {
          const actualizado = gastosActualizados.find((item) => item._id === gasto._id);
          if (!actualizado) return gasto;

          return {
            ...gasto,
            ...actualizado,
            nombreSubcategoria: actualizado.nombreSubcategoria || gasto.nombreSubcategoria,
            montoReal: calcularMontoReal(actualizado),
          };
        }),
      );

      setBulkPersonal({
        fecha: "",
        categoriaId: "",
        subcategoriaId: "",
        porcentaje: "",
        incluirMontoReal: "",
      });
      setMensajePersonal(`${gastosActualizados.length} gasto${gastosActualizados.length === 1 ? "" : "s"} actualizado${gastosActualizados.length === 1 ? "" : "s"}.`);
    } catch (apiError) {
      setMensajePersonal(obtenerMensajeError(apiError, "No se pudieron aplicar los cambios en masa."));
    } finally {
      setAplicandoBulkPersonal(false);
    }
  };
  return (
    <section className="page-section import-page">
      <header className="page-header">
        <div>
          <Link className="secondary-link compact-link" to={`/cuentas/${cuentaId}/gastos`}>
            Volver a gastos
          </Link>
          <h1>Importar Excel</h1>
          <p>
            El Excel bancario queda como movimientos pendientes para revisar. El Excel
            personal es temporal y crea gastos pendientes directamente.
          </p>
        </div>
      </header>

      {error && <p className="error-text import-message">{error}</p>}

      <section className="import-actions-grid">
        <form className="upload-panel import-upload-panel" onSubmit={importar}>
          <div>
            <h2>Importar Excel bancario</h2>
            <p>Formato oficial de banco. Detecta duplicados y deja movimientos para revisar.</p>
          </div>
          <label>
            Archivo Excel bancario
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={(event) => setFile(event.target.files[0] || null)}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Importando..." : "Importar Excel"}
          </button>
        </form>

        <form className="upload-panel import-upload-panel personal-import-panel" onSubmit={importarPersonal}>
          <div>
            <h2>Importar Excel personal</h2>
            <p>
              Herramienta temporal. Lee la primera hoja y detecta bloques con fecha, detalle,
              flujo bancario, economia real y categoria como subcategoria.
            </p>
          </div>
          <label>
            Archivo Excel personal
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={(event) => setArchivoPersonal(event.target.files[0] || null)}
            />
          </label>
          <button type="submit" disabled={loadingPersonal}>
            {loadingPersonal ? "Importando..." : "Importar Excel personal"}
          </button>
        </form>
      </section>

      {resultado && (
        <section className="table-shell import-result-panel">
          <h2>Resultado de la importacion bancaria</h2>
          <div className="import-result-grid">
            <article>
              <span>Leidos</span>
              <strong>{resultado.totalLeidos}</strong>
            </article>
            <article>
              <span>Procesados</span>
              <strong>{resultado.totalProcesados}</strong>
            </article>
          </div>
        </section>
      )}

      {resultadoPersonal && (
        <section className="table-shell import-result-panel">
          <h2>Resultado de la importacion personal</h2>
          <div className="import-result-grid">
            <article>
              <span>Leidos</span>
              <strong>{resultadoPersonal.totalLeidos}</strong>
            </article>
            <article>
              <span>Gastos creados</span>
              <strong>{resultadoPersonal.totalProcesados}</strong>
            </article>
          </div>
        </section>
      )}

      {gastosPersonales.length > 0 && (
        <TablaGastosPersonales
          cuentaId={cuentaId}
          gastos={gastosPersonales}
          categorias={categorias}
          subcategorias={subcategorias}
          mensaje={mensajePersonal}
          seleccionados={gastosPersonalesSeleccionados}
          onChange={cambiarGastoPersonal}
          onCrear={crearGastoPersonal}
          onToggleSeleccion={cambiarSeleccionGastoPersonal}
          onToggleTodos={cambiarSeleccionTodosGastosPersonales}
          bulk={bulkPersonal}
          aplicandoBulk={aplicandoBulkPersonal}
          onBulkChange={cambiarBulkPersonal}
          onAplicarBulk={aplicarCambiosBulkPersonal}
          onEliminarSeleccionados={eliminarGastosPersonalesSeleccionados}
        />
      )}

      <section className="table-shell">
        <div className="import-section-header">
          <div>
            <h2>Movimientos pendientes</h2>
            <p>
              Estos movimientos vienen del Excel bancario. Podes completarlos y crear
              cada gasto cuando esten listos.
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={cargarMovimientosPendientes}>
            Actualizar
          </button>
        </div>

        {mensajeBancario && <p className="detail-feedback">{mensajeBancario}</p>}
        {cargandoMovimientos && <p>Cargando movimientos...</p>}

        {!cargandoMovimientos && gastosBancarios.length === 0 && (
          <p>No hay movimientos pendientes para esta cuenta.</p>
        )}

        {!cargandoMovimientos && gastosBancarios.length > 0 && (
          <TablaGastosBancarios
            gastos={gastosBancarios}
            categorias={categorias}
            subcategorias={subcategorias}
            seleccionados={gastosBancariosSeleccionados}
            bulk={bulkBancario}
            aplicandoBulk={aplicandoBulkBancario}
            onChange={cambiarGastoBancario}
            onCrear={crearGastoBancario}
            onToggleSeleccion={cambiarSeleccionGastoBancario}
            onToggleTodos={cambiarSeleccionTodosGastosBancarios}
            onBulkChange={cambiarBulkBancario}
            onAplicarBulk={aplicarCambiosBulkBancario}
          />
        )}
      </section>

      {subcategoriasDetectadas.length > 0 && (
        <ModalSubcategoriasDetectadas
          subcategoriasDetectadas={subcategoriasDetectadas}
          categorias={categorias}
          mensaje={mensajeSubcategorias}
          loading={creandoSubcategorias}
          onChange={cambiarCategoriaSubcategoriaDetectada}
          onConfirmar={crearSubcategoriasDetectadas}
          onCerrar={() => setSubcategoriasDetectadas([])}
        />
      )}
    </section>
  );
}

function TablaGastosPersonales({
  cuentaId,
  gastos,
  categorias,
  subcategorias,
  mensaje,
  seleccionados,
  onChange,
  onCrear,
  onToggleSeleccion,
  onToggleTodos,
  bulk,
  aplicandoBulk,
  onBulkChange,
  onAplicarBulk,
  onEliminarSeleccionados,
}) {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h2>Gastos creados desde Excel personal</h2>
          <p>
            Quedaron pendientes. Podes corregirlos aca o abrir el detalle de cada gasto.
          </p>
        </div>
      </header>

      {mensaje && <p className="detail-feedback">{mensaje}</p>}

      {seleccionados.length > 0 && (
        <div className="selection-actions import-selection-actions import-bulk-panel">
          <strong>{seleccionados.length} seleccionado{seleccionados.length === 1 ? "" : "s"}</strong>

          <label>
            Fecha
            <input
              className="table-input"
              type="date"
              value={bulk.fecha}
              onChange={(event) => onBulkChange("fecha", event.target.value)}
            />
          </label>

          <label>
            Categoria
            <select
              className="table-select"
              value={bulk.categoriaId}
              onChange={(event) => onBulkChange("categoriaId", event.target.value)}
            >
              <option value="">Sin cambios</option>
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
              className="table-select"
              value={bulk.subcategoriaId}
              onChange={(event) => onBulkChange("subcategoriaId", event.target.value)}
            >
              <option value="">Sin cambios</option>
              {subcategorias.map((subcategoria) => (
                <option key={subcategoria._id} value={subcategoria._id}>
                  {subcategoria.nombreSubcategoria}
                </option>
              ))}
            </select>
          </label>

          <label>
            Porcentaje
            <input
              className="table-input table-input-small"
              type="number"
              min="0"
              max="100"
              value={bulk.porcentaje}
              placeholder="Sin cambios"
              onChange={(event) => onBulkChange("porcentaje", event.target.value)}
            />
          </label>

          <label>
            Incluir
            <select
              className="table-select"
              value={bulk.incluirMontoReal}
              onChange={(event) => onBulkChange("incluirMontoReal", event.target.value)}
            >
              <option value="">Sin cambios</option>
              <option value="true">Si</option>
              <option value="false">No</option>
            </select>
          </label>

          <button
            type="button"
            className="selection-action"
            onClick={onAplicarBulk}
            disabled={aplicandoBulk}
          >
            {aplicandoBulk ? "Aplicando..." : "Aplicar a seleccionados"}
          </button>

          <button
            type="button"
            className="selection-action delete-action"
            onClick={onEliminarSeleccionados}
          >
            Eliminar seleccionados
          </button>
        </div>
      )}

      <div className="table-shell expenses-table-shell import-expenses-table">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={gastos.length > 0 && seleccionados.length === gastos.length}
                  onChange={(event) => onToggleTodos(event.target.checked)}
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
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((gasto) => (
              <tr key={gasto._id}>
                <td>
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(gasto._id)}
                    onChange={() => onToggleSeleccion(gasto._id)}
                  />
                </td>
                <td>
                  <input
                    className="table-input"
                    type="date"
                    value={gasto.fecha}
                    onChange={(event) => onChange(gasto._id, "fecha", event.target.value)}
                  />
                </td>
                <td className="detail-name-cell">
                  <Link
                    className="detail-name-text detail-name-link"
                    to={`/cuentas/${cuentaId}/gastos/gasto/${gasto._id}`}
                  >
                    {gasto.detalle || "Sin detalle"}
                  </Link>
                  <input
                    className="table-input table-input-wide"
                    type="text"
                    value={gasto.detalle}
                    onChange={(event) => onChange(gasto._id, "detalle", event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="table-input table-input-number"
                    type="number"
                    value={gasto.montoBancario}
                    onChange={(event) => onChange(gasto._id, "montoBancario", event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="table-input table-input-small"
                    type="number"
                    min="0"
                    max="100"
                    value={gasto.porcentaje}
                    onChange={(event) => onChange(gasto._id, "porcentaje", event.target.value)}
                  />
                </td>
                <td>{formatearMonto(gasto.montoReal)}</td>
                <td>
                  <select
                    className="table-select"
                    value={gasto.categoriaId}
                    onChange={(event) => onChange(gasto._id, "categoriaId", event.target.value)}
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
                    value={obtenerSubcategoriaSeleccionada(gasto, subcategorias)}
                    onChange={(event) => onChange(gasto._id, "subcategoriaId", event.target.value)}
                  >
                    <option value="">{gasto.nombreSubcategoria || "Sin subcategoria"}</option>
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
                    checked={Boolean(gasto.incluirMontoReal)}
                    onChange={(event) => onChange(gasto._id, "incluirMontoReal", event.target.checked)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={gasto.estado === "creado"}
                    onClick={() => onCrear(gasto)}
                  >
                    {gasto.estado === "creado" ? "Creado" : "Actualizar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TablaGastosBancarios({
  gastos,
  categorias,
  subcategorias,
  seleccionados,
  bulk,
  aplicandoBulk,
  onChange,
  onCrear,
  onToggleSeleccion,
  onToggleTodos,
  onBulkChange,
  onAplicarBulk,
}) {
  const movimientosEditables = gastos.filter((gasto) => !gasto.gastoId);

  return (
    <>
      {seleccionados.length > 0 && (
        <div className="selection-actions import-selection-actions import-bulk-panel">
          <strong>{seleccionados.length} seleccionado{seleccionados.length === 1 ? "" : "s"}</strong>

          <label>
            Fecha
            <input
              className="table-input"
              type="date"
              value={bulk.fecha}
              onChange={(event) => onBulkChange("fecha", event.target.value)}
            />
          </label>

          <label>
            Categoria
            <select
              className="table-select"
              value={bulk.categoriaId}
              onChange={(event) => onBulkChange("categoriaId", event.target.value)}
            >
              <option value="">Sin cambios</option>
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
              className="table-select"
              value={bulk.subcategoriaId}
              onChange={(event) => onBulkChange("subcategoriaId", event.target.value)}
            >
              <option value="">Sin cambios</option>
              {subcategorias.map((subcategoria) => (
                <option key={subcategoria._id} value={subcategoria._id}>
                  {subcategoria.nombreSubcategoria}
                </option>
              ))}
            </select>
          </label>

          <label>
            Porcentaje
            <input
              className="table-input table-input-small"
              type="number"
              min="0"
              max="100"
              value={bulk.porcentaje}
              placeholder="Sin cambios"
              onChange={(event) => onBulkChange("porcentaje", event.target.value)}
            />
          </label>

          <label>
            Incluir
            <select
              className="table-select"
              value={bulk.incluirMontoReal}
              onChange={(event) => onBulkChange("incluirMontoReal", event.target.value)}
            >
              <option value="">Sin cambios</option>
              <option value="true">Si</option>
              <option value="false">No</option>
            </select>
          </label>

          <button
            type="button"
            className="selection-action"
            onClick={onAplicarBulk}
            disabled={aplicandoBulk}
          >
            {aplicandoBulk ? "Aplicando..." : "Aplicar a seleccionados"}
          </button>
        </div>
      )}

      <div className="table-shell expenses-table-shell import-expenses-table">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={
                    movimientosEditables.length > 0 &&
                    seleccionados.length === movimientosEditables.length
                  }
                  onChange={(event) => onToggleTodos(event.target.checked)}
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
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((gasto) => (
              <tr key={gasto._id}>
                <td>
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(gasto._id)}
                    disabled={Boolean(gasto.gastoId)}
                    onChange={() => onToggleSeleccion(gasto._id)}
                  />
                </td>
                <td>
                  <input
                    className="table-input"
                    type="date"
                    value={gasto.fecha}
                    disabled={Boolean(gasto.gastoId)}
                    onChange={(event) => onChange(gasto._id, "fecha", event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="table-input table-input-wide"
                    type="text"
                    value={gasto.detalle}
                    disabled={Boolean(gasto.gastoId)}
                    onChange={(event) => onChange(gasto._id, "detalle", event.target.value)}
                  />
                </td>
                <td>{formatearMonto(gasto.montoBancario)}</td>
                <td>
                  <input
                    className="table-input table-input-small"
                    type="number"
                    min="0"
                    max="100"
                    value={gasto.porcentaje}
                    disabled={Boolean(gasto.gastoId)}
                    onChange={(event) => onChange(gasto._id, "porcentaje", event.target.value)}
                  />
                </td>
                <td>{formatearMonto(gasto.montoReal)}</td>
                <td>
                  <select
                    className="table-select"
                    value={gasto.categoriaId}
                    disabled={Boolean(gasto.gastoId)}
                    onChange={(event) => onChange(gasto._id, "categoriaId", event.target.value)}
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
                    value={obtenerSubcategoriaSeleccionada(gasto, subcategorias)}
                    disabled={Boolean(gasto.gastoId)}
                    onChange={(event) => onChange(gasto._id, "subcategoriaId", event.target.value)}
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
                    checked={Boolean(gasto.incluirMontoReal)}
                    disabled={Boolean(gasto.gastoId)}
                    onChange={(event) => onChange(gasto._id, "incluirMontoReal", event.target.checked)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={Boolean(gasto.gastoId)}
                    onClick={() => onCrear(gasto)}
                  >
                    {gasto.gastoId ? "Creado" : "Crear gasto"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function ModalSubcategoriasDetectadas({
  subcategoriasDetectadas,
  categorias,
  mensaje,
  loading,
  onChange,
  onConfirmar,
  onCerrar,
}) {
  return (
    <div className="modal-backdrop">
      <section className="modal-card import-subcategory-modal">
        <header className="modal-header">
          <div>
            <h2>Subcategorias nuevas detectadas</h2>
            <p>
              El Excel personal trajo nombres que no existen en tu base. Podes crearlos
              sin categoria, o elegir una categoria si ya sabes donde van.
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={onCerrar}>
            Cerrar
          </button>
        </header>

        {mensaje && <p className="error-text">{mensaje}</p>}

        <div className="detected-subcategory-list">
          {subcategoriasDetectadas.map((item) => (
            <label key={item.nombreSubcategoria}>
              <span>{item.nombreSubcategoria}</span>
              <select
                value={item.categoria}
                onChange={(event) => onChange(item.nombreSubcategoria, event.target.value)}
              >
                <option value="">Seleccionar categoria</option>
                {categorias.map((categoria) => (
                  <option key={categoria._id} value={categoria._id}>
                    {categoria.nombreCategoria}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCerrar}>
            No crear ahora
          </button>
          <button type="button" onClick={onConfirmar} disabled={loading}>
            {loading ? "Creando..." : "Crear detectadas"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ImportExcelPage;


