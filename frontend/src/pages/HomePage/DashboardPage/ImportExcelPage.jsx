import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";
import SearchableCategorySelect from "../../../components/SearchableCategorySelect.jsx";
import SearchableSubcategorySelect from "../../../components/SearchableSubcategorySelect.jsx";
import SortableTableHeader, {
  useSortableRows,
} from "../../../components/SortableTableHeader.jsx";
import { NavegacionSecciones } from "../../../components/NavegacionSecciones.jsx";
import {
  calcularMontoRealGasto as calcularMontoReal,
  esMontoDistintoDeCero as montoDistintoDeCero,
} from "../../../utils/montosGasto.js";

const obtenerId = (valor) => {
  if (!valor) return "";
  if (typeof valor === "object") return valor._id || valor.id || "";
  return valor;
};

const fechaParaInput = (fecha) => {
  if (!fecha) return "";
  return String(fecha).slice(0, 10);
};

const normalizarTexto = (texto) =>
  String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
    porcentaje: montoDistintoDeCero(movimiento.montoBancario) ? "" : 0,
    montoReal: movimiento.montoReal ?? "",
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
  const gasto = item.movimiento || item.gasto || item;
  const gastoId = obtenerId(item.gastoId || gasto.gastoId);

  const fila = {
    _id: item._id || gasto.sourceHash || gasto._id,
    sourceHash: item.sourceHash || gasto.sourceHash || item._id,
    fecha: fechaParaInput(gasto.fecha),
    detalle: gasto.detalle || "",
    montoBancario: gasto.montoBancario ?? "",
    montoReal: gasto.montoReal ?? "",
    porcentaje: gasto.porcentaje ?? "",
    categoriaId: obtenerId(gasto.categoriaId),
    subcategoriaId: obtenerId(gasto.subcategoriaId),
    nombreSubcategoria: item.nombreSubcategoria || gasto.subcategoriaId?.nombreSubcategoria || "",
    incluirMontoReal: Boolean(gasto.incluirMontoReal),
    estado: gastoId ? "creado" : gasto.estado || "previsualizado",
    gastoId,
    duplicado: Boolean(item.duplicado || gasto.duplicado),
  };

  return {
    ...fila,
    montoReal: calcularMontoReal(fila),
  };
};

const gastoCompletoParaCrear = (gasto) => {
  const tieneMontoBancario = montoDistintoDeCero(gasto.montoBancario);
  const tieneMontoReal = montoDistintoDeCero(gasto.montoReal);
  const porcentajeValido =
    Number.isFinite(Number(gasto.porcentaje)) &&
    Number(gasto.porcentaje) >= 0 &&
    Number(gasto.porcentaje) <= 100;

  return (
    gasto.detalle &&
    gasto.fecha &&
    (tieneMontoBancario || tieneMontoReal) &&
    (!tieneMontoBancario || porcentajeValido) &&
    gasto.subcategoriaId
  );
};

const gastoValidoParaPendienteImportado = (gasto) => {
  const tieneMontoBancario = montoDistintoDeCero(gasto.montoBancario);
  const tieneMontoReal = montoDistintoDeCero(gasto.montoReal);
  const porcentaje = Number(gasto.porcentaje);

  return (
    gasto.detalle &&
    gasto.fecha &&
    (tieneMontoBancario || tieneMontoReal) &&
    (
      !tieneMontoBancario
      || (
        Number.isFinite(porcentaje)
        && porcentaje >= 0
        && porcentaje <= 100
      )
    )
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

const columnasOrdenablesImportacion = {
  fecha: { type: "date" },
  detalle: { type: "text" },
  montoBancario: { type: "number" },
  montoReal: { type: "number" },
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
  const contextoLayout = useOutletContext();
  const menuAbierto = contextoLayout?.menuAbierto || false;
  const mantenerMenuAbierto = contextoLayout?.alEntrarMenu;
  const permitirCerrarMenu = contextoLayout?.alSalirMenu;
  const { cuentaId } = useParams();

  const [file, setFile] = useState(null);
  const [archivoPersonal, setArchivoPersonal] = useState(null);
  const [hojasPersonal, setHojasPersonal] = useState([]);
  const [hojaPersonal, setHojaPersonal] = useState("");
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
    montoBancario: "",
    montoReal: "",
    porcentaje: "",
    incluirMontoReal: "",
  });
  const [aplicandoBulkBancario, setAplicandoBulkBancario] = useState(false);
  const [creandoSeleccionadosBancario, setCreandoSeleccionadosBancario] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [subcategoriasDetectadas, setSubcategoriasDetectadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [leyendoHojasPersonal, setLeyendoHojasPersonal] = useState(false);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [creandoSubcategorias, setCreandoSubcategorias] = useState(false);
  const [error, setError] = useState("");
  const [mensajePersonal, setMensajePersonal] = useState("");
  const [bulkPersonal, setBulkPersonal] = useState({
    fecha: "",
    categoriaId: "",
    subcategoriaId: "",
    montoBancario: "",
    montoReal: "",
    porcentaje: "",
    incluirMontoReal: "",
  });
  const [aplicandoBulkPersonal, setAplicandoBulkPersonal] = useState(false);
  const [creandoSeleccionadosPersonal, setCreandoSeleccionadosPersonal] = useState(false);
  const [mensajeBancario, setMensajeBancario] = useState("");
  const [mensajeSubcategorias, setMensajeSubcategorias] = useState("");
  const [modalCatalogo, setModalCatalogo] = useState("");
  const [nombreCategoria, setNombreCategoria] = useState("");
  const [formSubcategoria, setFormSubcategoria] = useState({
    nombreSubcategoria: "",
    categoria: "",
  });
  const [errorCatalogo, setErrorCatalogo] = useState("");
  const [mensajeCatalogo, setMensajeCatalogo] = useState("");
  const [guardandoCatalogo, setGuardandoCatalogo] = useState(false);

  const cargarCategorias = () => {
    return api
      .get("/categorias")
      .then((response) => {
        const categoriasActualizadas = response.data.categorias || [];
        setCategorias(categoriasActualizadas);
        return categoriasActualizadas;
      })
      .catch((apiError) => {
        console.error("Error al obtener categorias:", apiError);
        return [];
      });
  };

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
    cargarCategorias();
    cargarSubcategorias();
  // Estas funciones sólo dependen del cuentaId que dispara la recarga.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaId]);

  useEffect(() => {
    if (resultado && gastosBancarios.length === 0) {
      setResultado(null);
    }
  }, [gastosBancarios.length, resultado]);

  useEffect(() => {
    if (resultadoPersonal && gastosPersonales.length === 0) {
      setResultadoPersonal(null);
    }
  }, [gastosPersonales.length, resultadoPersonal]);

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
          .filter(
            (movimiento) =>
              movimiento
              && movimiento.estadoImportacion !== "ignorado",
          )
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
    if (!hojaPersonal) {
      setError("Selecciona la hoja del Excel personal que queres importar.");
      return;
    }

    const formData = new FormData();
    formData.append("excel", archivoPersonal);
    formData.append("nombreHoja", hojaPersonal);

    setLoadingPersonal(true);
    setError("");
    setMensajePersonal("");
    setMensajeSubcategorias("");
    setResultadoPersonal(null);
    setGastosPersonales([]);
    setGastosPersonalesSeleccionados([]);
    setSubcategoriasDetectadas([]);
    setBulkPersonal({
      fecha: "",
      categoriaId: "",
      subcategoriaId: "",
      montoBancario: "",
      montoReal: "",
      porcentaje: "",
      incluirMontoReal: "",
    });

    try {
      const { data } = await api.post(
        `/importaciones/cuentas/${cuentaId}/excel-personal`,
        formData,
      );

      const gastosImportados = (data.movimientos || []).map(gastoDesdeImportacionPersonal);
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
    } catch (apiError) {
      setError(
        obtenerMensajeError(apiError, "No se pudo importar el Excel personal."),
      );
    } finally {
      setLoadingPersonal(false);
    }
  };

  const seleccionarArchivoPersonal = async (event) => {
    const archivo = event.target.files[0] || null;
    setArchivoPersonal(archivo);
    setHojasPersonal([]);
    setHojaPersonal("");
    setError("");

    if (!archivo) return;

    const formData = new FormData();
    formData.append("excel", archivo);
    setLeyendoHojasPersonal(true);

    try {
      const { data } = await api.post(
        `/importaciones/cuentas/${cuentaId}/excel-personal/hojas`,
        formData,
      );
      const hojas = data.hojas || [];
      setHojasPersonal(hojas);
      setHojaPersonal(hojas[0] || "");

      if (hojas.length === 0) {
        setError("El archivo Excel personal no contiene hojas para importar.");
      }
    } catch (apiError) {
      setError(
        obtenerMensajeError(
          apiError,
          "No se pudieron leer las hojas del Excel personal.",
        ),
      );
    } finally {
      setLeyendoHojasPersonal(false);
    }
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
  };

  const armarPayloadGastoPersonal = (gasto) => ({
    sourceHash: gasto.sourceHash,
    detalle: gasto.detalle,
    fecha: gasto.fecha,
    montoBancario: Number(gasto.montoBancario),
    montoReal: Number(gasto.montoReal),
    porcentaje: Number(gasto.porcentaje),
    incluirMontoReal: Boolean(gasto.incluirMontoReal),
    categoriaId: gasto.categoriaId || "",
    subcategoriaId: gasto.subcategoriaId,
  });

  const crearGastoPersonal = async (gasto) => {
    if (!gastoCompletoParaCrear(gasto)) {
      setMensajePersonal(
        "Para crear el gasto faltan datos: detalle, fecha, monto bancario o real distinto de 0 y subcategoria. Si hay monto bancario, revisa también el porcentaje.",
      );
      return;
    }

    setMensajePersonal("");

    try {
      const { data } = await api.post(
        `/importaciones/cuentas/${cuentaId}/excel-personal/gastos`,
        armarPayloadGastoPersonal(gasto),
      );
      setGastosPersonales((actuales) =>
        actuales.map((item) =>
          item._id === gasto._id
            ? { ...item, estado: "creado", gastoId: data.gasto._id }
            : item,
        ),
      );
      setGastosPersonalesSeleccionados((actuales) =>
        actuales.filter((id) => id !== gasto._id),
      );
      setMensajePersonal("Gasto creado correctamente.");
    } catch (apiError) {
      setMensajePersonal(
        obtenerMensajeError(apiError, "No se pudo crear el gasto."),
      );
    }
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

    if (
      bulkBancario.montoBancario !== ""
      && bulkBancario.montoReal !== ""
    ) {
      setMensajeBancario(
        "Aplica monto bancario o monto real, no ambos al mismo tiempo.",
      );
      return;
    }

    const cambios = {};

    if (bulkBancario.fecha) cambios.fecha = bulkBancario.fecha;
    if (bulkBancario.categoriaId) cambios.categoriaId = bulkBancario.categoriaId;
    if (bulkBancario.subcategoriaId) cambios.subcategoriaId = bulkBancario.subcategoriaId;
    if (bulkBancario.montoBancario !== "") {
      cambios.montoBancario = Number(bulkBancario.montoBancario);
    }
    if (bulkBancario.montoReal !== "") {
      cambios.montoBancario = 0;
      cambios.montoReal = Number(bulkBancario.montoReal);
      cambios.porcentaje = 0;
      cambios.incluirMontoReal = true;
    }
    if (bulkBancario.porcentaje !== "" && bulkBancario.montoReal === "") {
      cambios.porcentaje = Number(bulkBancario.porcentaje);
    }
    if (
      bulkBancario.incluirMontoReal !== ""
      && bulkBancario.montoReal === ""
    ) {
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
      montoBancario: "",
      montoReal: "",
      porcentaje: "",
      incluirMontoReal: "",
    });
    setGastosBancariosSeleccionados([]);
    setAplicandoBulkBancario(false);
    setMensajeBancario("Cambios aplicados a los movimientos seleccionados.");
  };

  const eliminarMovimientosBancariosSeleccionados = async () => {
    const movimientosAEliminar = gastosBancariosSeleccionados.filter((id) => {
      const movimiento = gastosBancarios.find((gasto) => gasto._id === id);
      return movimiento && !movimiento.gastoId;
    });

    const cantidad = movimientosAEliminar.length;
    if (cantidad === 0) return;

    const confirmaEliminar = window.confirm(
      `Vas a eliminar ${cantidad} movimiento${cantidad === 1 ? "" : "s"} pendiente${cantidad === 1 ? "" : "s"} de esta vista.`,
    );

    if (!confirmaEliminar) return;

    setMensajeBancario("");

    try {
      await Promise.all(
        movimientosAEliminar.map((movimientoId) =>
          api.patch(`/importaciones/movimientos/${movimientoId}/ignorar`),
        ),
      );

      setGastosBancarios((actuales) =>
        actuales.filter((gasto) => !movimientosAEliminar.includes(gasto._id)),
      );
      setGastosBancariosSeleccionados([]);
      setMensajeBancario(
        `${cantidad} movimiento${cantidad === 1 ? "" : "s"} eliminado${cantidad === 1 ? "" : "s"} de pendientes.`,
      );
    } catch (apiError) {
      setMensajeBancario(
        obtenerMensajeError(apiError, "No se pudieron eliminar los movimientos seleccionados."),
      );
    }
  };
  const armarPayloadGastoBancario = (gasto) => {
    const payload = {
      detalle: gasto.detalle,
      fecha: gasto.fecha,
      montoBancario: Number(gasto.montoBancario || 0),
      montoReal: Number(gasto.montoReal),
      porcentaje: Number(gasto.porcentaje),
      incluirMontoReal: Boolean(gasto.incluirMontoReal),
      cambiarEstado: false,
    };

    if (gasto.categoriaId) payload.categoriaId = gasto.categoriaId;
    if (gasto.subcategoriaId) payload.subcategoriaId = gasto.subcategoriaId;

    return payload;
  };

  const crearGastoBancario = (gasto) => {
    if (!gastoValidoParaPendienteImportado(gasto)) {
      setMensajeBancario(
        "Para crear el gasto pendiente completa detalle, fecha y monto bancario o real distinto de 0. Si hay monto bancario, el porcentaje debe estar entre 0 y 100.",
      );
      return;
    }

    api
      .post(`/importaciones/movimientos/${gasto._id}/crear-gasto`, armarPayloadGastoBancario(gasto))
      .then((response) => {
        const gastoCreado = response.data.gasto;
        setGastosBancarios((actuales) =>
          actuales.map((item) =>
            item._id === gasto._id
              ? { ...item, estado: "vinculado", gastoId: gastoCreado._id }
              : item,
          ),
        );
        setMensajeBancario("Gasto pendiente creado desde el movimiento bancario.");
        setGastosBancariosSeleccionados((actuales) => actuales.filter((id) => id !== gasto._id));
      })
      .catch((apiError) => {
        setMensajeBancario(
          obtenerMensajeError(apiError, "No se pudo crear el gasto desde el movimiento."),
        );
      });
  };

  const crearGastosBancariosSeleccionados = async () => {
    const movimientosSeleccionados = gastosBancarios.filter(
      (gasto) => gastosBancariosSeleccionados.includes(gasto._id) && !gasto.gastoId,
    );

    if (movimientosSeleccionados.length === 0) {
      setMensajeBancario("Selecciona al menos un movimiento pendiente para crear.");
      return;
    }

    const movimientosInvalidos = movimientosSeleccionados.filter(
      (gasto) => !gastoValidoParaPendienteImportado(gasto),
    );

    if (movimientosInvalidos.length > 0) {
      setMensajeBancario(
        `No se pueden crear ${movimientosInvalidos.length} movimiento${movimientosInvalidos.length === 1 ? "" : "s"}: revisa detalle, fecha, monto bancario o real y porcentaje.`,
      );
      return;
    }

    setCreandoSeleccionadosBancario(true);
    setMensajeBancario("");

    try {
      const resultados = await Promise.allSettled(
        movimientosSeleccionados.map((gasto) =>
          api
            .post(`/importaciones/movimientos/${gasto._id}/crear-gasto`, armarPayloadGastoBancario(gasto))
            .then((response) => ({ movimientoId: gasto._id, gastoCreado: response.data.gasto })),
        ),
      );

      const creados = resultados
        .filter((resultado) => resultado.status === "fulfilled")
        .map((resultado) => resultado.value);
      const errores = resultados.filter((resultado) => resultado.status === "rejected");
      const mensajesErrores = [
        ...new Set(
          errores.map((resultado) =>
            obtenerMensajeError(
              resultado.reason,
              "No se pudo crear el gasto desde el movimiento.",
            ),
          ),
        ),
      ];
      const todosErroresSonDuplicados = errores.length > 0 && errores.every(
        (resultado) => {
          const mensaje = obtenerMensajeError(resultado.reason, "");
          return resultado.reason?.response?.status === 409
            && mensaje.toLowerCase().includes("ya existe");
        },
      );
      const detalleErrores = todosErroresSonDuplicados
        ? errores.length === 1
          ? "El gasto ya existe."
          : "Los gastos seleccionados ya existen."
        : mensajesErrores.join(" ");
      const creadosPorMovimiento = new Map(
        creados.map((item) => [item.movimientoId, item.gastoCreado]),
      );

      if (creados.length > 0) {
        setGastosBancarios((actuales) =>
          actuales.map((gasto) =>
            creadosPorMovimiento.has(gasto._id)
              ? {
                  ...gasto,
                  estado: "vinculado",
                  gastoId: creadosPorMovimiento.get(gasto._id)?._id,
                }
              : gasto,
          ),
        );
        setGastosBancariosSeleccionados((actuales) =>
          actuales.filter((id) => !creadosPorMovimiento.has(id)),
        );
      }

      setMensajeBancario(
        errores.length === 0
          ? `${creados.length} gasto${creados.length === 1 ? "" : "s"} pendiente${creados.length === 1 ? "" : "s"} creado${creados.length === 1 ? "" : "s"}.`
          : `${creados.length} creado${creados.length === 1 ? "" : "s"}; ${errores.length} no se pudo${errores.length === 1 ? "" : "ieron"} crear. ${detalleErrores}`,
      );
    } catch (apiError) {
      setMensajeBancario(
        obtenerMensajeError(apiError, "No se pudieron crear los gastos seleccionados."),
      );
    } finally {
      setCreandoSeleccionadosBancario(false);
    }
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

      setGastosPersonales(gastosActualizados);
      setSubcategoriasDetectadas([]);
      setMensajePersonal(
        subcategoriasNuevas.length > 0
          ? "Subcategorias nuevas creadas y aplicadas a la previsualizacion."
          : "Las subcategorias detectadas ya existian y fueron aplicadas a la previsualizacion.",
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
    const movimientosSinCrear = gastosPersonales
      .filter((gasto) => !gasto.gastoId)
      .map((gasto) => gasto._id);
    setGastosPersonalesSeleccionados(checked ? movimientosSinCrear : []);
  };

  const eliminarGastosPersonalesSeleccionados = () => {
    const cantidad = gastosPersonalesSeleccionados.length;

    if (cantidad === 0) return;

    const confirmaEliminar = window.confirm(
      `Vas a quitar ${cantidad} movimiento${cantidad === 1 ? "" : "s"} de esta previsualizacion.`,
    );

    if (!confirmaEliminar) return;

    setGastosPersonales((actuales) =>
      actuales.filter((gasto) => !gastosPersonalesSeleccionados.includes(gasto._id)),
    );
    setGastosPersonalesSeleccionados([]);
    setMensajePersonal(
      `${cantidad} movimiento${cantidad === 1 ? "" : "s"} quitado${cantidad === 1 ? "" : "s"} de la previsualizacion.`,
    );
  };

  const cambiarBulkPersonal = (campo, valor) => {
    setBulkPersonal((actual) => ({ ...actual, [campo]: valor }));
  };

  const aplicarCambiosBulkPersonal = () => {
    if (gastosPersonalesSeleccionados.length === 0) {
      setMensajePersonal("Selecciona al menos un movimiento para aplicar cambios en masa.");
      return;
    }

    if (
      bulkPersonal.montoBancario !== ""
      && bulkPersonal.montoReal !== ""
    ) {
      setMensajePersonal(
        "Aplica monto bancario o monto real, no ambos al mismo tiempo.",
      );
      return;
    }

    const payload = {};

    if (bulkPersonal.fecha) payload.fecha = bulkPersonal.fecha;
    if (bulkPersonal.categoriaId) payload.categoriaId = bulkPersonal.categoriaId;
    if (bulkPersonal.subcategoriaId) payload.subcategoriaId = bulkPersonal.subcategoriaId;
    if (bulkPersonal.montoBancario !== "") {
      payload.montoBancario = Number(bulkPersonal.montoBancario);
    }
    if (bulkPersonal.montoReal !== "") {
      payload.montoBancario = 0;
      payload.montoReal = Number(bulkPersonal.montoReal);
      payload.porcentaje = 0;
      payload.incluirMontoReal = true;
    }
    if (bulkPersonal.porcentaje !== "" && bulkPersonal.montoReal === "") {
      payload.porcentaje = Number(bulkPersonal.porcentaje);
    }
    if (
      bulkPersonal.incluirMontoReal !== ""
      && bulkPersonal.montoReal === ""
    ) {
      payload.incluirMontoReal = bulkPersonal.incluirMontoReal === "true";
    }

    if (Object.keys(payload).length === 0) {
      setMensajePersonal("Elige al menos un campo para aplicar a los seleccionados.");
      return;
    }

    setAplicandoBulkPersonal(true);
    setMensajePersonal("");

    setGastosPersonales((actuales) =>
      actuales.map((gasto) => {
        if (
          gasto.gastoId
          || !gastosPersonalesSeleccionados.includes(gasto._id)
        ) {
          return gasto;
        }

        const actualizado = { ...gasto, ...payload };
        return {
          ...actualizado,
          montoReal: calcularMontoReal(actualizado),
        };
      }),
    );

    setBulkPersonal({
      fecha: "",
      categoriaId: "",
      subcategoriaId: "",
      montoBancario: "",
      montoReal: "",
      porcentaje: "",
      incluirMontoReal: "",
    });
    setGastosPersonalesSeleccionados([]);
    setAplicandoBulkPersonal(false);
    setMensajePersonal("Cambios aplicados a la previsualizacion.");
  };

  const crearGastosPersonalesSeleccionados = async () => {
    const movimientosSeleccionados = gastosPersonales.filter(
      (gasto) =>
        gastosPersonalesSeleccionados.includes(gasto._id)
        && !gasto.gastoId,
    );

    if (movimientosSeleccionados.length === 0) {
      setMensajePersonal("Selecciona al menos un movimiento para crear.");
      return;
    }

    const movimientosInvalidos = movimientosSeleccionados.filter(
      (gasto) => !gastoCompletoParaCrear(gasto),
    );
    if (movimientosInvalidos.length > 0) {
      setMensajePersonal(
        `No se pueden crear ${movimientosInvalidos.length} movimiento${movimientosInvalidos.length === 1 ? "" : "s"}: revisa detalle, fecha, monto bancario o real, porcentaje y subcategoria.`,
      );
      return;
    }

    setCreandoSeleccionadosPersonal(true);
    setMensajePersonal("");

    try {
      const resultados = await Promise.allSettled(
        movimientosSeleccionados.map((gasto) =>
          api
            .post(
              `/importaciones/cuentas/${cuentaId}/excel-personal/gastos`,
              armarPayloadGastoPersonal(gasto),
            )
            .then((response) => ({
              movimientoId: gasto._id,
              gastoId: response.data.gasto._id,
            })),
        ),
      );
      const creados = resultados
        .filter((resultado) => resultado.status === "fulfilled")
        .map((resultado) => resultado.value);
      const fallidos = resultados.filter(
        (resultado) => resultado.status === "rejected",
      );
      const gastoIdPorMovimiento = new Map(
        creados.map((item) => [item.movimientoId, item.gastoId]),
      );

      setGastosPersonales((actuales) =>
        actuales.map((gasto) =>
          gastoIdPorMovimiento.has(gasto._id)
            ? {
                ...gasto,
                estado: "creado",
                gastoId: gastoIdPorMovimiento.get(gasto._id),
              }
            : gasto,
        ),
      );
      setGastosPersonalesSeleccionados((actuales) =>
        actuales.filter((id) => !gastoIdPorMovimiento.has(id)),
      );

      const detalleError = fallidos.length > 0
        ? obtenerMensajeError(
            fallidos[0].reason,
            "Revisa los movimientos que no se pudieron crear.",
          )
        : "";
      setMensajePersonal(
        fallidos.length === 0
          ? `${creados.length} gasto${creados.length === 1 ? "" : "s"} creado${creados.length === 1 ? "" : "s"} correctamente.`
          : `${creados.length} creado${creados.length === 1 ? "" : "s"}; ${fallidos.length} no se pudo${fallidos.length === 1 ? "" : "ieron"} crear. ${detalleError}`,
      );
    } finally {
      setCreandoSeleccionadosPersonal(false);
    }
  };

  const limpiarImportacionPersonal = () => {
    if (gastosPersonales.length === 0) return;

    const confirmaLimpiar = window.confirm(
      "Vas a limpiar esta previsualizacion. Los gastos que ya hayas creado no se eliminaran de la cuenta.",
    );
    if (!confirmaLimpiar) return;

    setResultadoPersonal(null);
    setGastosPersonales([]);
    setGastosPersonalesSeleccionados([]);
    setSubcategoriasDetectadas([]);
    setMensajePersonal("");
    setMensajeSubcategorias("");
    setBulkPersonal({
      fecha: "",
      categoriaId: "",
      subcategoriaId: "",
      montoBancario: "",
      montoReal: "",
      porcentaje: "",
      incluirMontoReal: "",
    });
  };

  const abrirModalCatalogo = (tipo) => {
    setModalCatalogo(tipo);
    setErrorCatalogo("");
    setMensajeCatalogo("");
    setNombreCategoria("");
    setFormSubcategoria({
      nombreSubcategoria: "",
      categoria: "",
    });
  };

  const cerrarModalCatalogo = () => {
    if (guardandoCatalogo) return;
    setModalCatalogo("");
    setErrorCatalogo("");
  };

  const guardarCategoria = async () => {
    const nombre = nombreCategoria.trim();
    if (!nombre) {
      setErrorCatalogo("El nombre de la categoría es obligatorio.");
      return;
    }

    setGuardandoCatalogo(true);
    setErrorCatalogo("");

    try {
      const { data } = await api.post("/categorias", {
        nombreCategoria: nombre,
      });
      const categoriaCreada = data.categoria;

      setCategorias((actuales) => [
        ...actuales.filter((categoria) => categoria._id !== categoriaCreada._id),
        categoriaCreada,
      ]);
      setModalCatalogo("");
      setNombreCategoria("");
      setMensajeCatalogo(`Categoría "${categoriaCreada.nombreCategoria}" creada.`);
    } catch (apiError) {
      setErrorCatalogo(
        obtenerMensajeError(apiError, "No se pudo crear la categoría."),
      );
    } finally {
      setGuardandoCatalogo(false);
    }
  };

  const guardarSubcategoria = async () => {
    const nombre = formSubcategoria.nombreSubcategoria.trim();
    if (!nombre) {
      setErrorCatalogo("El nombre de la subcategoría es obligatorio.");
      return;
    }

    setGuardandoCatalogo(true);
    setErrorCatalogo("");

    const payload = { nombreSubcategoria: nombre };
    if (formSubcategoria.categoria) {
      payload.categoria = formSubcategoria.categoria;
    }

    try {
      const { data } = await api.post("/subcategorias", payload);
      const subcategoriaCreada = data.subcategoria;

      setSubcategorias((actuales) =>
        combinarSubcategoriasUnicas(actuales, [subcategoriaCreada]),
      );
      setModalCatalogo("");
      setFormSubcategoria({
        nombreSubcategoria: "",
        categoria: "",
      });
      setMensajeCatalogo(
        `Subcategoría "${subcategoriaCreada.nombreSubcategoria}" creada.`,
      );
    } catch (apiError) {
      setErrorCatalogo(
        obtenerMensajeError(apiError, "No se pudo crear la subcategoría."),
      );
    } finally {
      setGuardandoCatalogo(false);
    }
  };

  return (
    <section className="page-section import-page">
      <nav
        className="import-floating-actions secondary-sidebar-actions"
        aria-label="Acciones rápidas de importación"
        onMouseEnter={
          menuAbierto && mantenerMenuAbierto
            ? mantenerMenuAbierto
            : undefined
        }
        onMouseLeave={
          menuAbierto && permitirCerrarMenu
            ? permitirCerrarMenu
            : undefined
        }
      >
        <span>Acciones rápidas</span>
        <Link className="secondary-link" to={`/cuentas/${cuentaId}/gastos`}>
          Volver a gastos
        </Link>
        <button type="button" onClick={() => abrirModalCatalogo("categoria")}>
          Crear categoría
        </button>
        <button type="button" onClick={() => abrirModalCatalogo("subcategoria")}>
          Crear subcategoría
        </button>
        <NavegacionSecciones
          secciones={[
            { id: "importar-archivos", etiqueta: "Importar archivos" },
            ...(gastosPersonales.length > 0
              ? [{
                  id: "previsualizacion-personal",
                  etiqueta: "Previsualización personal",
                }]
              : []),
            {
              id: "movimientos-pendientes-importados",
              etiqueta: "Movimientos pendientes",
            },
          ]}
        />
      </nav>

      <header className="page-header">
        <div>
          <h1>Importar Excel</h1>
          <p>
            El Excel bancario queda como movimientos pendientes para revisar. El Excel
            personal se previsualiza y no crea gastos hasta que lo confirmes.
          </p>
        </div>
      </header>

      {mensajeCatalogo && (
        <p className="detail-feedback import-message">{mensajeCatalogo}</p>
      )}
      {error && <p className="error-text import-message">{error}</p>}

      <section
        id="importar-archivos"
        className="import-actions-grid page-scroll-section"
      >
        <form className="upload-panel import-upload-panel" onSubmit={importar}>
          <div>
            <h2>Importar Excel bancario</h2>
            <p>
              Formato oficial del banco o tabla con Fecha, Detalle y Monto. En
              la tabla simple, Monto se importa como monto real directo.
              Detecta duplicados y deja movimientos para revisar.
            </p>
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
              Elegí una hoja, revisá sus movimientos y creá solamente los que quieras conservar.
            </p>
          </div>
          <label>
            Archivo Excel personal
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={seleccionarArchivoPersonal}
            />
          </label>
          <label>
            Hoja a importar
            <select
              value={hojaPersonal}
              disabled={!archivoPersonal || leyendoHojasPersonal}
              onChange={(event) => setHojaPersonal(event.target.value)}
            >
              <option value="">
                {leyendoHojasPersonal
                  ? "Leyendo hojas..."
                  : "Seleccionar hoja"}
              </option>
              {hojasPersonal.map((hoja) => (
                <option key={hoja} value={hoja}>{hoja}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={
              loadingPersonal
              || leyendoHojasPersonal
              || !archivoPersonal
              || !hojaPersonal
            }
          >
            {loadingPersonal ? "Leyendo..." : "Previsualizar Excel personal"}
          </button>
        </form>
      </section>

      {resultado && gastosBancarios.length > 0 && (
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

      {resultadoPersonal && gastosPersonales.length > 0 && (
        <section className="table-shell import-result-panel">
          <h2>Resultado de la importacion personal</h2>
          <div className="import-result-grid">
            <article>
              <span>Hoja previsualizada</span>
              <strong>{resultadoPersonal.nombreHoja}</strong>
            </article>
            <article>
              <span>Leidos</span>
              <strong>{resultadoPersonal.totalLeidos}</strong>
            </article>
            <article>
              <span>Sin crear</span>
              <strong>{gastosPersonales.filter((gasto) => !gasto.gastoId).length}</strong>
            </article>
            {resultadoPersonal.totalDuplicados > 0 && (
              <article>
                <span>Ya existentes</span>
                <strong>{resultadoPersonal.totalDuplicados}</strong>
              </article>
            )}
          </div>
        </section>
      )}

      {gastosPersonales.length > 0 && (
        <TablaGastosPersonales
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
          creandoSeleccionados={creandoSeleccionadosPersonal}
          onBulkChange={cambiarBulkPersonal}
          onAplicarBulk={aplicarCambiosBulkPersonal}
          onCrearSeleccionados={crearGastosPersonalesSeleccionados}
          onEliminarSeleccionados={eliminarGastosPersonalesSeleccionados}
          onLimpiar={limpiarImportacionPersonal}
        />
      )}

      <section
        id="movimientos-pendientes-importados"
        className="table-shell page-scroll-section"
      >
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
            creandoSeleccionados={creandoSeleccionadosBancario}
            onChange={cambiarGastoBancario}
            onCrear={crearGastoBancario}
            onToggleSeleccion={cambiarSeleccionGastoBancario}
            onToggleTodos={cambiarSeleccionTodosGastosBancarios}
            onBulkChange={cambiarBulkBancario}
            onAplicarBulk={aplicarCambiosBulkBancario}
            onCrearSeleccionados={crearGastosBancariosSeleccionados}
            onEliminarSeleccionados={eliminarMovimientosBancariosSeleccionados}
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

      {modalCatalogo === "categoria" && (
        <div className="modal-backdrop">
          <section className="edit-modal import-catalog-modal">
            <div className="edit-modal-header">
              <div>
                <h2>Crear categoría</h2>
                <p>Al crearla aparecerá inmediatamente en todos los desplegables.</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={guardandoCatalogo}
                onClick={cerrarModalCatalogo}
              >
                Cerrar
              </button>
            </div>

            <label>
              Nombre
              <input
                autoFocus
                type="text"
                value={nombreCategoria}
                onChange={(event) => setNombreCategoria(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") guardarCategoria();
                }}
              />
            </label>

            {errorCatalogo && <p className="error-text">{errorCatalogo}</p>}

            <div className="edit-modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={guardandoCatalogo}
                onClick={cerrarModalCatalogo}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoCatalogo}
                onClick={guardarCategoria}
              >
                {guardandoCatalogo ? "Creando..." : "Crear categoría"}
              </button>
            </div>
          </section>
        </div>
      )}

      {modalCatalogo === "subcategoria" && (
        <div className="modal-backdrop">
          <section className="edit-modal import-catalog-modal">
            <div className="edit-modal-header">
              <div>
                <h2>Crear subcategoría</h2>
                <p>Podés asociarla a una categoría ahora o dejarla sin categoría.</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={guardandoCatalogo}
                onClick={cerrarModalCatalogo}
              >
                Cerrar
              </button>
            </div>

            <label>
              Nombre
              <input
                autoFocus
                type="text"
                value={formSubcategoria.nombreSubcategoria}
                onChange={(event) =>
                  setFormSubcategoria((actual) => ({
                    ...actual,
                    nombreSubcategoria: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Categoría (opcional)
              <SearchableCategorySelect
                categorias={categorias}
                value={formSubcategoria.categoria}
                placeholder="Sin categoría"
                ariaLabel="Buscar categoría para la subcategoría"
                onChange={(categoriaId) =>
                  setFormSubcategoria((actual) => ({
                    ...actual,
                    categoria: categoriaId,
                  }))
                }
              />
            </label>

            {errorCatalogo && <p className="error-text">{errorCatalogo}</p>}

            <div className="edit-modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={guardandoCatalogo}
                onClick={cerrarModalCatalogo}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoCatalogo}
                onClick={guardarSubcategoria}
              >
                {guardandoCatalogo ? "Creando..." : "Crear subcategoría"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function TablaGastosPersonales({
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
  creandoSeleccionados,
  onBulkChange,
  onAplicarBulk,
  onCrearSeleccionados,
  onEliminarSeleccionados,
  onLimpiar,
}) {
  const movimientosEditables = gastos.filter((gasto) => !gasto.gastoId);
  const ordenTabla = useSortableRows(gastos, columnasOrdenablesImportacion);

  return (
    <section
      id="previsualizacion-personal"
      className="page-section page-scroll-section"
    >
      <header className="page-header">
        <div>
          <h2>Previsualización del Excel personal</h2>
          <p>
            Revisá y corregí los movimientos antes de crearlos. También podés quitar
            filas o limpiar toda la previsualización.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={onLimpiar}>
          Limpiar importación
        </button>
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
            <SearchableCategorySelect
              categorias={categorias}
              value={bulk.categoriaId}
              placeholder="Sin cambios"
              ariaLabel="Buscar categoría para aplicar a seleccionados"
              onChange={(categoriaId) =>
                onBulkChange("categoriaId", categoriaId)
              }
            />
          </label>

          <label>
            Subcategoria
            <SearchableSubcategorySelect
              subcategorias={subcategorias}
              value={bulk.subcategoriaId}
              placeholder="Sin cambios"
              ariaLabel="Buscar subcategoría para aplicar a seleccionados"
              onChange={(subcategoriaId) =>
                onBulkChange("subcategoriaId", subcategoriaId)
              }
            />
          </label>

          <label>
            Monto bancario
            <input
              className="table-input table-input-number"
              type="number"
              step="0.01"
              value={bulk.montoBancario}
              placeholder="Sin cambios"
              onChange={(event) =>
                onBulkChange("montoBancario", event.target.value)
              }
            />
          </label>

          <label>
            Monto real
            <input
              className="table-input table-input-number"
              type="number"
              step="0.01"
              value={bulk.montoReal}
              placeholder="Sin cambios"
              onChange={(event) =>
                onBulkChange("montoReal", event.target.value)
              }
            />
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
            className="selection-action"
            onClick={onCrearSeleccionados}
            disabled={creandoSeleccionados}
          >
            {creandoSeleccionados ? "Creando..." : "Crear seleccionados"}
          </button>

          <button
            type="button"
            className="selection-action delete-action"
            onClick={onEliminarSeleccionados}
            disabled={creandoSeleccionados}
          >
            Quitar seleccionados
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
                    movimientosEditables.length > 0
                    && seleccionados.length === movimientosEditables.length
                  }
                  onChange={(event) => onToggleTodos(event.target.checked)}
                />
              </th>
              <SortableTableHeader
                label="Fecha"
                sortKey="fecha"
                sortConfig={ordenTabla.sortConfig}
                onSort={ordenTabla.requestSort}
              />
              <SortableTableHeader
                label="Detalle"
                sortKey="detalle"
                sortConfig={ordenTabla.sortConfig}
                onSort={ordenTabla.requestSort}
              />
              <SortableTableHeader
                label="Bancario"
                sortKey="montoBancario"
                sortConfig={ordenTabla.sortConfig}
                onSort={ordenTabla.requestSort}
              />
              <th>%</th>
              <SortableTableHeader
                label="Real"
                sortKey="montoReal"
                sortConfig={ordenTabla.sortConfig}
                onSort={ordenTabla.requestSort}
              />
              <th>Categoria</th>
              <th>Subcategoria</th>
              <th>Incluye</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {ordenTabla.sortedRows.map((gasto) => (
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
                <td className="detail-name-cell import-detail-cell">
                  <textarea
                    className="table-input table-input-wide table-detail-textarea"
                    rows={Math.max(2, Math.ceil(String(gasto.detalle || "").length / 34))}
                    value={gasto.detalle}
                    disabled={Boolean(gasto.gastoId)}
                    onChange={(event) => onChange(gasto._id, "detalle", event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="table-input table-input-number"
                    type="number"
                    value={gasto.montoBancario}
                    disabled={Boolean(gasto.gastoId)}
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
                    disabled={
                      Boolean(gasto.gastoId)
                      || !montoDistintoDeCero(gasto.montoBancario)
                    }
                    onChange={(event) => onChange(gasto._id, "porcentaje", event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="table-input table-input-number"
                    type="number"
                    step="0.01"
                    value={gasto.montoReal}
                    disabled={
                      Boolean(gasto.gastoId)
                      || montoDistintoDeCero(gasto.montoBancario)
                    }
                    title={
                      montoDistintoDeCero(gasto.montoBancario)
                        ? "Se calcula con el monto bancario y el porcentaje"
                        : "Monto real directo"
                    }
                    onChange={(event) =>
                      onChange(gasto._id, "montoReal", event.target.value)
                    }
                  />
                </td>
                <td>
                  <SearchableCategorySelect
                    categorias={categorias}
                    value={gasto.categoriaId}
                    disabled={Boolean(gasto.gastoId)}
                    placeholder="Sin categoría"
                    ariaLabel={`Buscar categoría para ${gasto.detalle}`}
                    onChange={(categoriaId) =>
                      onChange(gasto._id, "categoriaId", categoriaId)
                    }
                  />
                </td>
                <td>
                  <SearchableSubcategorySelect
                    subcategorias={subcategorias}
                    value={obtenerSubcategoriaSeleccionada(gasto, subcategorias)}
                    disabled={Boolean(gasto.gastoId)}
                    placeholder={gasto.nombreSubcategoria || "Sin subcategoría"}
                    ariaLabel={`Buscar subcategoría para ${gasto.detalle}`}
                    onChange={(subcategoriaId) =>
                      onChange(gasto._id, "subcategoriaId", subcategoriaId)
                    }
                  />
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
                    {gasto.gastoId
                      ? gasto.duplicado ? "Ya existe" : "Creado"
                      : "Crear gasto"}
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
  creandoSeleccionados,
  onChange,
  onCrear,
  onToggleSeleccion,
  onToggleTodos,
  onBulkChange,
  onAplicarBulk,
  onCrearSeleccionados,
  onEliminarSeleccionados,
}) {
  const movimientosEditables = gastos.filter((gasto) => !gasto.gastoId);
  const ordenTabla = useSortableRows(gastos, columnasOrdenablesImportacion);

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
            <SearchableCategorySelect
              categorias={categorias}
              value={bulk.categoriaId}
              placeholder="Sin cambios"
              ariaLabel="Buscar categoría para aplicar a seleccionados"
              onChange={(categoriaId) =>
                onBulkChange("categoriaId", categoriaId)
              }
            />
          </label>

          <label>
            Subcategoria
            <SearchableSubcategorySelect
              subcategorias={subcategorias}
              value={bulk.subcategoriaId}
              placeholder="Sin cambios"
              ariaLabel="Buscar subcategoría para aplicar a seleccionados"
              onChange={(subcategoriaId) =>
                onBulkChange("subcategoriaId", subcategoriaId)
              }
            />
          </label>

          <label>
            Monto bancario
            <input
              className="table-input table-input-number"
              type="number"
              step="0.01"
              value={bulk.montoBancario}
              placeholder="Sin cambios"
              onChange={(event) =>
                onBulkChange("montoBancario", event.target.value)
              }
            />
          </label>

          <label>
            Monto real
            <input
              className="table-input table-input-number"
              type="number"
              step="0.01"
              value={bulk.montoReal}
              placeholder="Sin cambios"
              onChange={(event) =>
                onBulkChange("montoReal", event.target.value)
              }
            />
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
            className="selection-action"
            onClick={onCrearSeleccionados}
            disabled={creandoSeleccionados}
          >
            {creandoSeleccionados ? "Creando..." : "Crear seleccionados"}
          </button>
          <button
            type="button"
            className="selection-action delete-action"
            onClick={onEliminarSeleccionados}
            disabled={creandoSeleccionados}
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
                  checked={
                    movimientosEditables.length > 0 &&
                    seleccionados.length === movimientosEditables.length
                  }
                  onChange={(event) => onToggleTodos(event.target.checked)}
                />
              </th>
              <SortableTableHeader
                label="Fecha"
                sortKey="fecha"
                sortConfig={ordenTabla.sortConfig}
                onSort={ordenTabla.requestSort}
              />
              <SortableTableHeader
                label="Detalle"
                sortKey="detalle"
                sortConfig={ordenTabla.sortConfig}
                onSort={ordenTabla.requestSort}
              />
              <SortableTableHeader
                label="Bancario"
                sortKey="montoBancario"
                sortConfig={ordenTabla.sortConfig}
                onSort={ordenTabla.requestSort}
              />
              <th>%</th>
              <SortableTableHeader
                label="Real"
                sortKey="montoReal"
                sortConfig={ordenTabla.sortConfig}
                onSort={ordenTabla.requestSort}
              />
              <th>Categoria</th>
              <th>Subcategoria</th>
              <th>Incluye</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {ordenTabla.sortedRows.map((gasto) => (
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
                <td className="import-detail-cell">
                  <textarea
                    className="table-input table-input-wide table-detail-textarea"
                    rows={Math.max(2, Math.ceil(String(gasto.detalle || "").length / 34))}
                    value={gasto.detalle}
                    disabled={Boolean(gasto.gastoId)}
                    onChange={(event) => onChange(gasto._id, "detalle", event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="table-input table-input-number"
                    type="number"
                    step="0.01"
                    value={gasto.montoBancario}
                    disabled={Boolean(gasto.gastoId)}
                    title={
                      montoDistintoDeCero(gasto.montoReal)
                      && !montoDistintoDeCero(gasto.montoBancario)
                        ? "Déjalo en 0 para ingresar un monto real directo"
                        : "Monto bancario"
                    }
                    onChange={(event) =>
                      onChange(gasto._id, "montoBancario", event.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="table-input table-input-small"
                    type="number"
                    min="0"
                    max="100"
                    value={gasto.porcentaje}
                    disabled={
                      Boolean(gasto.gastoId)
                      || !montoDistintoDeCero(gasto.montoBancario)
                    }
                    onChange={(event) => onChange(gasto._id, "porcentaje", event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="table-input table-input-number"
                    type="number"
                    step="0.01"
                    value={gasto.montoReal}
                    disabled={
                      Boolean(gasto.gastoId)
                      || montoDistintoDeCero(gasto.montoBancario)
                    }
                    title={
                      montoDistintoDeCero(gasto.montoBancario)
                        ? "Se calcula con el monto bancario y el porcentaje"
                        : "Monto real directo"
                    }
                    onChange={(event) =>
                      onChange(gasto._id, "montoReal", event.target.value)
                    }
                  />
                </td>
                <td>
                  <SearchableCategorySelect
                    categorias={categorias}
                    value={gasto.categoriaId}
                    disabled={Boolean(gasto.gastoId)}
                    placeholder="Sin categoría"
                    ariaLabel={`Buscar categoría para ${gasto.detalle}`}
                    onChange={(categoriaId) =>
                      onChange(gasto._id, "categoriaId", categoriaId)
                    }
                  />
                </td>
                <td>
                  <SearchableSubcategorySelect
                    subcategorias={subcategorias}
                    value={obtenerSubcategoriaSeleccionada(gasto, subcategorias)}
                    disabled={Boolean(gasto.gastoId)}
                    placeholder="Sin subcategoría"
                    ariaLabel={`Buscar subcategoría para ${gasto.detalle}`}
                    onChange={(subcategoriaId) =>
                      onChange(gasto._id, "subcategoriaId", subcategoriaId)
                    }
                  />
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
              <SearchableCategorySelect
                categorias={categorias}
                value={item.categoria}
                placeholder="Seleccionar categoría"
                ariaLabel={`Buscar categoría para ${item.nombreSubcategoria}`}
                onChange={(categoriaId) =>
                  onChange(item.nombreSubcategoria, categoriaId)
                }
              />
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



