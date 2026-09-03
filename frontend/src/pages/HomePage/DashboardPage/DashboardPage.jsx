import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../../services/api.js";
import { DashboardLoadingState } from "../../../components/DashboardLoadingState.jsx";
import {
  formatearMontoMoneda,
  MONEDAS_SOPORTADAS,
  obtenerMonedaMovimiento,
  obtenerMonedasCuenta,
} from "../../../utils/monedas.js";
import {
  EquivalenciaMontoUi,
  UiExchangeReference,
} from "../../../components/UiExchangeReference.jsx";
import { useCotizacionUi } from "../../../hooks/useCotizacionUi.js";
import { PlanesCuotasTarjeta } from "../../../components/PlanesCuotasTarjeta.jsx";
import { RegistroSubcategorias } from "../../../components/RegistroSubcategorias.jsx";
import { MovimientosPendientesDashboard } from "../../../components/MovimientosPendientesDashboard.jsx";
import { NavegacionSecciones } from "../../../components/NavegacionSecciones.jsx";
import { calcularDisponibleOperativoTarjeta } from "../../../utils/disponibleTarjeta.js";
import { construirRegistroGastosPorSubcategoria } from "../../../utils/registroSubcategorias.js";
import {
  calcularResultadoTarjetaGasto,
  esPagoTarjeta,
} from "../../../utils/resultadoEconomico.js";
import {
  esCuentaFuentePresupuesto,
  esSubcategoriaTransferencia,
  resumirPresupuestoMensualPorTransferencias,
} from "../../../utils/presupuestoMensual.js";

const MESES_DEL_ANIO = [
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

const obtenerId = (valor) => {
  if (!valor) return "";
  return typeof valor === "object" ? valor._id || valor.id || "" : valor;
};

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const crearMesesDelAnio = (anio) =>
  MESES_DEL_ANIO.map((mes) => `${anio}-${mes.valor}`);

const formatearMes = (clave) => {
  const fecha = new Date(`${clave}-01T00:00:00.000Z`);
  const texto = fecha.toLocaleDateString("es-UY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const formatearMonto = (monto, moneda) =>
  formatearMontoMoneda(numeroFinito(monto), moneda);

const formatearFecha = (fecha) => (
  fecha
    ? new Date(fecha).toLocaleDateString("es-UY", { timeZone: "UTC" })
    : "Sin fecha"
);

const cantidadMovimientosResumen = (totales = {}) => (
  Object.values(totales).reduce(
    (cantidad, total) => cantidad + numeroFinito(total?.cantidad),
    0,
  )
);

const cantidadPendientesResumen = (totales = {}) => (
  Object.values(totales).reduce(
    (cantidad, total) => cantidad + numeroFinito(total?.pendientes),
    0,
  )
);

const impactoConsumo = (gasto, campo) => {
  if (campo === "montoReal" && gasto.incluirMontoReal !== true) {
    return 0;
  }

  const monto = numeroFinito(gasto[campo]);
  if (gasto.tipoMovimiento === "reintegro") return -Math.abs(monto);
  return monto < 0 ? Math.abs(monto) : 0;
};

const impactoSaldoTarjeta = (gasto) => {
  const monto = Math.abs(numeroFinito(gasto.montoBancario));
  return ["pago", "reintegro"].includes(gasto.tipoMovimiento)
    ? -monto
    : monto;
};

const pagoOReintegroTarjeta = (gasto) => (
  ["pago", "reintegro"].includes(gasto.tipoMovimiento)
    ? Math.abs(numeroFinito(gasto.montoBancario))
    : 0
);

const crearAcumuladoMensual = (clave) => ({
  clave,
  montoBancario: 0,
  montoReal: 0,
  presupuesto: 0,
  variacion: 0,
  pagosTarjeta: 0,
  saldoTarjeta: 0,
  cantidad: 0,
  pendientes: 0,
});

function DashboardPage({ embedded = false }) {
  const { cuentaId } = useParams();
  const contextoLayout = useOutletContext() || {};
  const {
    menuAbierto,
    alEntrarMenu: mantenerMenuAbierto,
    alSalirMenu: permitirCerrarMenu,
    cuentaActual: cuentaActualLayout,
    cargandoCuentaActual,
    errorCuentaActual,
  } = contextoLayout;
  const cuentaSeleccionada = cuentaId || "todas";
  const anioActual = String(new Date().getFullYear());
  const cuentas = useSelector((state) => state.cuentas.cuentas);
  const [gastos, setGastos] = useState([]);
  const [resumenesTarjeta, setResumenesTarjeta] = useState([]);
  const [fechaModo, setFechaModo] = useState("mes");
  const [fechaMes, setFechaMes] = useState("");
  const [fechaAnio, setFechaAnio] = useState(anioActual);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comparacionesContraidas, setComparacionesContraidas] = useState(false);
  const [resumenesContraidos, setResumenesContraidos] = useState({});
  const [panelCategoriasContraido, setPanelCategoriasContraido] = useState(false);
  const [panelResumenesContraido, setPanelResumenesContraido] = useState(false);
  const cuentaActual = cuentaActualLayout?._id === cuentaId
    ? cuentaActualLayout
    : cuentas.find((cuenta) => cuenta._id === cuentaSeleccionada);
  const esCuentaCredito = cuentaActual?.tipoCuenta === "credito";
  const idsCuentasDashboard = useMemo(() => {
    if (!cuentaId) return "";

    const ids = new Set([cuentaId]);
    cuentas
      .filter(esCuentaFuentePresupuesto)
      .forEach((cuenta) => ids.add(cuenta._id));
    return [...ids].join(",");
  }, [cuentaId, cuentas]);

  useEffect(() => {
    if (cuentaId && (cargandoCuentaActual || !cuentaActual)) {
      if (errorCuentaActual || (!cargandoCuentaActual && cuentas.length > 0)) {
        setError(errorCuentaActual || "No se encontró la cuenta solicitada.");
        setLoading(false);
      }
      return undefined;
    }

    let activo = true;

    setLoading(true);
    setError("");
    setResumenesTarjeta([]);
    setComparacionesContraidas(false);
    setResumenesContraidos({});
    setPanelCategoriasContraido(false);
    setPanelResumenesContraido(false);

    const cargarDashboard = async () => {
      try {
        const resumenesRequest = esCuentaCredito
          ? api.get(
            `/importaciones/cuentas/${cuentaId}/resumenes-tarjeta`,
          )
          : Promise.resolve({ data: { resumenes: [] } });
        const [gastosResponse, resumenesResponse] = await Promise.all([
          api.get("/gastos", {
            params: {
              vista: "dashboard",
              ...(idsCuentasDashboard ? { cuentaIds: idsCuentasDashboard } : {}),
            },
          }),
          resumenesRequest,
        ]);

        if (!activo) return;
        setGastos(gastosResponse.data.gastos || []);
        setResumenesTarjeta(resumenesResponse.data.resumenes || []);
      } catch (apiError) {
        if (!activo) return;
        console.error("Error al cargar el dashboard:", apiError);
        setError(
          apiError.response?.data?.message ||
            "No se pudieron cargar los datos del dashboard.",
        );
      } finally {
        if (activo) setLoading(false);
      }
    };

    cargarDashboard();

    return () => {
      activo = false;
    };
  }, [
    cuentaActual,
    cargandoCuentaActual,
    cuentaId,
    cuentas.length,
    errorCuentaActual,
    esCuentaCredito,
    idsCuentasDashboard,
  ]);

  const gastosDelDashboard = useMemo(
    () =>
      gastos.filter(
        (gasto) =>
          cuentaSeleccionada === "todas" ||
          obtenerId(gasto.cuentaId) === cuentaSeleccionada,
      ),
    [cuentaSeleccionada, gastos],
  );

  const aniosDisponibles = useMemo(
    () =>
      [
        ...new Set([
          anioActual,
          ...gastosDelDashboard
            .map((gasto) =>
              gasto.fecha ? String(gasto.fecha).slice(0, 4) : "",
            )
            .filter(Boolean),
        ]),
      ].sort((a, b) => b.localeCompare(a)),
    [anioActual, gastosDelDashboard],
  );

  const clavesMensualesDisponibles = useMemo(
    () =>
      [
        ...new Set(
          gastosDelDashboard
            .map((gasto) =>
              gasto.fecha ? String(gasto.fecha).slice(0, 7) : "",
            )
            .filter((clave) => /^\d{4}-\d{2}$/.test(clave)),
        ),
      ].sort(),
    [gastosDelDashboard],
  );

  const meses = useMemo(() => {
    if (fechaModo !== "mes") {
      return clavesMensualesDisponibles.length > 0
        ? clavesMensualesDisponibles
        : crearMesesDelAnio(anioActual);
    }

    if (fechaAnio) {
      return fechaMes
        ? [`${fechaAnio}-${fechaMes}`]
        : crearMesesDelAnio(fechaAnio);
    }

    const mesesFiltrados = fechaMes
      ? clavesMensualesDisponibles.filter(
          (clave) => clave.slice(5, 7) === fechaMes,
        )
      : clavesMensualesDisponibles;

    return mesesFiltrados.length > 0
      ? mesesFiltrados
      : crearMesesDelAnio(anioActual);
  }, [
    anioActual,
    clavesMensualesDisponibles,
    fechaAnio,
    fechaMes,
    fechaModo,
  ]);

  const monedasDashboard = useMemo(() => {
    if (cuentaActual) {
      return obtenerMonedasCuenta(cuentaActual);
    }

    const monedasEncontradas = new Set([
      ...cuentas.flatMap((cuenta) => obtenerMonedasCuenta(cuenta)),
      ...gastosDelDashboard.map((gasto) => {
        const cuentaGasto = cuentas.find(
          (cuenta) => cuenta._id === obtenerId(gasto.cuentaId),
        );
        return obtenerMonedaMovimiento(cuentaGasto, gasto.moneda);
      }),
    ]);
    const monedas = MONEDAS_SOPORTADAS.filter((moneda) =>
      monedasEncontradas.has(moneda),
    );

    return monedas.length > 0 ? monedas : ["UYU"];
  }, [cuentaActual, cuentas, gastosDelDashboard]);
  const manejaUi = monedasDashboard.includes("UI");
  const requiereCotizacionCredito = esCuentaCredito
    && monedasDashboard.includes("UYU")
    && monedasDashboard.includes("USD");
  const cotizacionUi = useCotizacionUi(
    manejaUi || requiereCotizacionCredito,
  );

  const resumenesFiltrados = useMemo(() => {
    if (!esCuentaCredito) return [];

    return resumenesTarjeta.filter((resumen) => {
      const claveCierre = resumen.cierre
        ? String(resumen.cierre).slice(0, 7)
        : "";
      if (fechaModo !== "mes") return true;
      if (fechaAnio && claveCierre.slice(0, 4) !== fechaAnio) return false;
      if (fechaMes && claveCierre.slice(5, 7) !== fechaMes) return false;
      return true;
    });
  }, [
    esCuentaCredito,
    fechaAnio,
    fechaMes,
    fechaModo,
    resumenesTarjeta,
  ]);

  const gastosPorResumen = useMemo(() => {
    const agrupados = new Map();

    gastosDelDashboard.forEach((gasto) => {
      const resumenId = obtenerId(gasto.resumenTarjetaId);
      if (!resumenId) return;
      const movimientos = agrupados.get(resumenId) || [];
      movimientos.push(gasto);
      agrupados.set(resumenId, movimientos);
    });

    agrupados.forEach((movimientos) => {
      movimientos.sort(
        (a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0),
      );
    });

    return agrupados;
  }, [gastosDelDashboard]);

  const datosMensualesPorMoneda = useMemo(() => {
    const cuentasPorId = new Map(
      cuentas.map((cuenta) => [cuenta._id, cuenta]),
    );
    const gastosPorId = new Map(
      gastosDelDashboard.map((gasto) => [obtenerId(gasto._id), gasto]),
    );
    const clavesPermitidas = new Set(meses);
    const movimientosInternosVinculados = new Set();

    gastosDelDashboard.forEach((gasto) => {
      const referenciaPoblada = gasto.origen?.referenciaId;
      if (!referenciaPoblada || typeof referenciaPoblada !== "object") return;

      const referenciaId = obtenerId(referenciaPoblada);
      if (!referenciaId) return;
      const gastoId = obtenerId(gasto._id);
      const referencia = gastosPorId.get(referenciaId) || referenciaPoblada;
      if (esPagoTarjeta(gasto) || esPagoTarjeta(referencia)) return;
      movimientosInternosVinculados.add(gastoId);
      movimientosInternosVinculados.add(referenciaId);
    });

    const acumuladosPorMoneda = Object.fromEntries(
      monedasDashboard.map((moneda) => [
        moneda,
        new Map(
          meses.map((clave) => [clave, crearAcumuladoMensual(clave)]),
        ),
      ]),
    );

    gastosDelDashboard.forEach((gasto) => {
      const clave = gasto.fecha ? String(gasto.fecha).slice(0, 7) : "";
      const gastoCuentaId = obtenerId(gasto.cuentaId);
      const cuentaGasto = cuentasPorId.get(gastoCuentaId);
      const monedaGasto = obtenerMonedaMovimiento(
        cuentaGasto,
        gasto.moneda,
      );
      const acumulado =
        acumuladosPorMoneda[monedaGasto]?.get(clave);

      if (!clavesPermitidas.has(clave) || !acumulado) return;

      if (gasto.estado === "pendiente") {
        acumulado.pendientes += 1;
        return;
      }
      if (gasto.estado !== "creado") return;

      const esMovimientoInterno =
        movimientosInternosVinculados.has(obtenerId(gasto._id))
        || esSubcategoriaTransferencia(gasto);
      if (!esMovimientoInterno) {
        acumulado.montoBancario += impactoConsumo(
          gasto,
          "montoBancario",
        );
        if (cuentaGasto?.tipoCuenta === "credito") {
          acumulado.pagosTarjeta += pagoOReintegroTarjeta(gasto);
          acumulado.saldoTarjeta += impactoSaldoTarjeta(gasto);
        } else {
          acumulado.montoReal += impactoConsumo(gasto, "montoReal");
        }
      }

      if (cuentaGasto?.tipoCuenta === "credito") {
        acumulado.variacion += calcularResultadoTarjetaGasto(gasto);
      }
      acumulado.cantidad += 1;
    });

    return Object.fromEntries(
      monedasDashboard.map((moneda) => [
        moneda,
        meses.map((clave) =>
          acumuladosPorMoneda[moneda].get(clave),
        ),
      ]),
    );
  }, [
    cuentas,
    gastosDelDashboard,
    meses,
    monedasDashboard,
  ]);

  const presupuestoPorMes = useMemo(
    () => new Map(
      meses.map((clave) => [
        clave,
        resumirPresupuestoMensualPorTransferencias({
          gastos,
          cuentas,
          periodo: clave,
        }),
      ]),
    ),
    [cuentas, gastos, meses],
  );

  const presupuestoDelPeriodo = useMemo(() => {
    const resumenesDisponibles = [...presupuestoPorMes.values()]
      .filter((resumen) => resumen.disponible);

    return {
      disponible: resumenesDisponibles.length > 0,
      presupuestoUsd: resumenesDisponibles.reduce(
        (total, resumen) => total + resumen.presupuestoUsd,
        0,
      ),
      transferidoUsd: resumenesDisponibles.reduce(
        (total, resumen) => total + resumen.transferidoUsd,
        0,
      ),
      resultadoUsd: resumenesDisponibles.reduce(
        (total, resumen) => total + resumen.resultadoUsd,
        0,
      ),
    };
  }, [presupuestoPorMes]);

  const totalesPorMoneda = useMemo(
    () =>
      Object.fromEntries(
        monedasDashboard.map((moneda) => [
          moneda,
          datosMensualesPorMoneda[moneda].reduce(
            (resultado, mes) => ({
              montoBancario:
                resultado.montoBancario + mes.montoBancario,
              montoReal: resultado.montoReal + mes.montoReal,
              presupuesto:
                resultado.presupuesto + mes.presupuesto,
              variacion: resultado.variacion + mes.variacion,
              pagosTarjeta:
                resultado.pagosTarjeta + mes.pagosTarjeta,
              saldoTarjeta:
                resultado.saldoTarjeta + mes.saldoTarjeta,
              pendientes: resultado.pendientes + mes.pendientes,
            }),
            {
              montoBancario: 0,
              montoReal: 0,
              presupuesto: 0,
              variacion: 0,
              pagosTarjeta: 0,
              saldoTarjeta: 0,
              pendientes: 0,
            },
          ),
        ]),
      ),
    [datosMensualesPorMoneda, monedasDashboard],
  );

  const maximosComparacionPorMoneda = useMemo(
    () => Object.fromEntries(
      monedasDashboard.map((moneda) => [
        moneda,
        Math.max(
          1,
          ...datosMensualesPorMoneda[moneda].flatMap((mes) => [
            mes.montoBancario,
            esCuentaCredito ? mes.pagosTarjeta : mes.montoReal,
          ]),
        ),
      ]),
    ),
    [datosMensualesPorMoneda, esCuentaCredito, monedasDashboard],
  );

  const ultimoResumenFiltrado = useMemo(
    () => [...resumenesFiltrados].sort(
      (a, b) => new Date(b.cierre || 0) - new Date(a.cierre || 0),
    )[0] || null,
    [resumenesFiltrados],
  );

  const disponibleOperativoTarjeta = useMemo(
    () => (
      esCuentaCredito && ultimoResumenFiltrado
        ? calcularDisponibleOperativoTarjeta(
          ultimoResumenFiltrado,
          cotizacionUi.cotizacion,
        )
        : null
    ),
    [
      cotizacionUi.cotizacion,
      esCuentaCredito,
      ultimoResumenFiltrado,
    ],
  );

  const desgloseCategoriasTarjeta = useMemo(() => {
    if (!esCuentaCredito) return [];

    const mesesPermitidos = new Set(meses);
    const agrupados = new Map();

    gastosDelDashboard.forEach((gasto) => {
      const claveMes = gasto.fecha ? String(gasto.fecha).slice(0, 7) : "";
      if (
        gasto.estado !== "creado"
        || !mesesPermitidos.has(claveMes)
        || gasto.tipoMovimiento === "pago"
      ) {
        return;
      }

      const categoria =
        gasto.categoriaId?.nombreCategoria || "Sin categoría";
      const subcategoria =
        gasto.subcategoriaId?.nombreSubcategoria || "Sin subcategoría";
      const moneda = obtenerMonedaMovimiento(cuentaActual, gasto.moneda);
      const clave = `${categoria}|${subcategoria}`;
      const fila = agrupados.get(clave) || {
        categoria,
        subcategoria,
        montos: {},
      };

      fila.montos[moneda] = numeroFinito(fila.montos[moneda])
        + impactoSaldoTarjeta(gasto);
      agrupados.set(clave, fila);
    });

    return [...agrupados.values()].sort((a, b) => {
      const totalA = Object.values(a.montos)
        .reduce((total, monto) => total + Math.abs(numeroFinito(monto)), 0);
      const totalB = Object.values(b.montos)
        .reduce((total, monto) => total + Math.abs(numeroFinito(monto)), 0);
      return totalB - totalA;
    });
  }, [
    cuentaActual,
    esCuentaCredito,
    gastosDelDashboard,
    meses,
  ]);

  const registroGastosSubcategorias = useMemo(
    () => construirRegistroGastosPorSubcategoria({
      gastos: gastosDelDashboard,
      cuentas,
      meses,
    }),
    [cuentas, gastosDelDashboard, meses],
  );

  const movimientosPendientesFiltrados = useMemo(() => {
    const mesesPermitidos = new Set(meses);

    return gastosDelDashboard
      .filter((gasto) => {
        const claveMes = gasto.fecha ? String(gasto.fecha).slice(0, 7) : "";
        return gasto.estado === "pendiente" && mesesPermitidos.has(claveMes);
      })
      .sort((a, b) => (
        new Date(b.fecha || 0) - new Date(a.fecha || 0)
        || String(a.detalle || "").localeCompare(String(b.detalle || ""), "es")
      ));
  }, [gastosDelDashboard, meses]);

  const pendientesTotales = monedasDashboard.reduce(
    (total, moneda) => total + totalesPorMoneda[moneda].pendientes,
    0,
  );
  const tituloCuenta = cuentaActual?.nombreCuenta || "Todas las cuentas";
  const nombreMesSeleccionado =
    MESES_DEL_ANIO.find((mes) => mes.valor === fechaMes)?.nombre || "";
  const periodoSeleccionado =
    fechaModo !== "mes"
      ? "Todos los períodos"
      : [
          nombreMesSeleccionado || "Todos los meses",
          fechaAnio ? `de ${fechaAnio}` : "de todos los años",
        ].join(" ");

  const seccionesDashboard = [
    { id: "dashboard-resumen", etiqueta: "Resumen mensual" },
    ...(pendientesTotales > 0
      ? [{
          id: "dashboard-movimientos-pendientes",
          etiqueta: "Movimientos pendientes",
        }]
      : []),
    ...(esCuentaCredito && disponibleOperativoTarjeta
      ? [{
          id: "dashboard-conciliacion",
          etiqueta: "Conciliación del límite",
        }]
      : []),
    ...(!esCuentaCredito
      ? [{
          id: "dashboard-registro-subcategorias",
          etiqueta: "Registro por subcategoría",
        }]
      : []),
    { id: "dashboard-comparaciones", etiqueta: "Comparaciones" },
    ...(esCuentaCredito
      ? [
          {
            id: "dashboard-categorias",
            etiqueta: "Categorías y subcategorías",
          },
          { id: "dashboard-resumenes", etiqueta: "Resúmenes del período" },
        ]
      : []),
  ];

  const cambiarModoFecha = (valor) => {
    setFechaModo(valor);
    if (valor === "mes" && !fechaAnio) setFechaAnio(anioActual);
  };

  const alternarComparacion = () => {
    setComparacionesContraidas((estadoActual) => !estadoActual);
  };

  const alternarResumen = (resumenId) => {
    setResumenesContraidos((estadoActual) => ({
      ...estadoActual,
      [resumenId]: !estadoActual[resumenId],
    }));
  };

  if (loading) {
    return (
      <section
        className={embedded ? "dashboard-page dashboard-page-embedded" : "page-section"}
      >
        <DashboardLoadingState nombreCuenta={cuentaActual?.nombreCuenta} />
      </section>
    );
  }

  return (
    <section
      className={`${embedded ? "" : "page-section "}dashboard-page${embedded ? " dashboard-page-embedded" : ""}`}
    >
      <nav
        className="expense-floating-actions secondary-sidebar-actions section-navigation-only"
        aria-label="Navegación de secciones del dashboard"
        onMouseEnter={menuAbierto ? mantenerMenuAbierto : undefined}
        onMouseLeave={menuAbierto ? permitirCerrarMenu : undefined}
      >
        <NavegacionSecciones secciones={seccionesDashboard} />
      </nav>

      {!embedded && cuentas.length > 0 && (
        <nav
          className="dashboard-account-shortcuts dashboard-account-shortcuts-top"
          aria-label="Cambiar dashboard de cuenta"
        >
          <span>Tus cuentas</span>
          <div>
            <Link
              className={cuentaSeleccionada === "todas" ? "is-active" : ""}
              aria-current={
                cuentaSeleccionada === "todas" ? "page" : undefined
              }
              to="/home#dashboard-general"
            >
              Todas las cuentas
            </Link>
            {cuentas.map((cuenta) => {
              const activa = cuentaSeleccionada === cuenta._id;

              return (
                <Link
                  key={cuenta._id}
                  className={activa ? "is-active" : ""}
                  aria-current={activa ? "page" : undefined}
                  to={`/cuentas/${cuenta._id}/dashboard`}
                >
                  {cuenta.nombreCuenta}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <header className="page-header dashboard-header">
        <div>
          <p className="eyebrow">Visión mensual</p>
          <h1>
            {cuentaActual
              ? `Dashboard · ${cuentaActual.nombreCuenta}`
              : "Dashboard general"}
          </h1>
          <p>
            {esCuentaCredito
              ? "Analizá consumos bancarios, categorías y deuda de la tarjeta por mes y por resumen."
              : cuentaActual
                ? "Analizá el monto bancario, el monto real y el ahorro de esta cuenta mes a mes."
                : "Compará todas tus cuentas por mes, con los importes separados por moneda."}
          </p>
        </div>
        {cuentaActual && (
          <div className="action-row">
            <Link
              className="primary-link"
              to={`/cuentas/${cuentaActual._id}/gastos`}
            >
              Ver movimientos
            </Link>
          </div>
        )}
      </header>

      {error && <p className="inline-error">{error}</p>}

      {manejaUi && (
        <UiExchangeReference
          cotizacion={cotizacionUi.cotizacion}
          cargando={cotizacionUi.cargando}
          error={cotizacionUi.error}
          onActualizar={cotizacionUi.actualizar}
        />
      )}

      <section
        id="dashboard-resumen"
        className="dashboard-filters page-scroll-section"
        aria-label="Filtros del dashboard"
      >
        <label>
          Fecha
          <select
            value={fechaModo}
            onChange={(event) => cambiarModoFecha(event.target.value)}
          >
            <option value="">Sin filtro</option>
            <option value="mes">Por mes</option>
          </select>
        </label>

        {fechaModo === "mes" && (
          <>
            <label>
              Mes
              <select
                value={fechaMes}
                onChange={(event) => setFechaMes(event.target.value)}
              >
                <option value="">Todos los meses</option>
                {MESES_DEL_ANIO.map((mes) => (
                  <option key={mes.valor} value={mes.valor}>
                    {mes.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Año
              <select
                value={fechaAnio}
                onChange={(event) => setFechaAnio(event.target.value)}
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

        <div className="dashboard-filter-context">
          <span>Analizando</span>
          <strong>
            {tituloCuenta} · {periodoSeleccionado}
          </strong>
        </div>
      </section>

      <section className="dashboard-kpis">
        <article>
          <span>{esCuentaCredito ? "Consumos de tarjeta" : "Monto bancario"}</span>
          {monedasDashboard.map((moneda) => (
            <div className="dashboard-kpi-value" key={moneda}>
              <strong>
                {formatearMonto(
                  totalesPorMoneda[moneda].montoBancario,
                  moneda,
                )}
              </strong>
              {moneda === "UI" && (
                <EquivalenciaMontoUi
                  monto={totalesPorMoneda[moneda].montoBancario}
                  cotizacion={cotizacionUi.cotizacion}
                />
              )}
            </div>
          ))}
          <small>
            {esCuentaCredito
              ? "Compras y cuotas de los meses filtrados"
              : "Consumo acumulado de los meses filtrados"}
          </small>
        </article>
        <article>
          <span>{esCuentaCredito ? "Pagos y reintegros" : "Monto real"}</span>
          {monedasDashboard.map((moneda) => (
            <div className="dashboard-kpi-value" key={moneda}>
              <strong>
                {formatearMonto(
                  esCuentaCredito
                    ? totalesPorMoneda[moneda].pagosTarjeta
                    : totalesPorMoneda[moneda].montoReal,
                  moneda,
                )}
              </strong>
              {moneda === "UI" && (
                <EquivalenciaMontoUi
                  monto={
                    esCuentaCredito
                      ? totalesPorMoneda[moneda].pagosTarjeta
                      : totalesPorMoneda[moneda].montoReal
                  }
                  cotizacion={cotizacionUi.cotizacion}
                />
              )}
            </div>
          ))}
          <small>
            {esCuentaCredito
              ? "Reducen la deuda; no generan impacto económico en la tarjeta"
              : "Impacto personal acumulado de los meses filtrados"}
          </small>
        </article>
        <article>
          <span>
            {esCuentaCredito
              ? "Deuda al último cierre"
              : "Resultado del sueldo"}
          </span>
          {esCuentaCredito ? (
            monedasDashboard.map((moneda) => {
              const totalCierre = ultimoResumenFiltrado?.totales?.[moneda];
              const resultado = numeroFinito(totalCierre?.deuda);
              return (
              <div className="dashboard-kpi-value" key={moneda}>
                <strong
                  className={
                    totalCierre?.excesoLimite > 0
                      ? "dashboard-value-negative"
                      : resultado < 0
                      ? "dashboard-value-negative"
                      : "dashboard-value-positive"
                  }
                >
                  {formatearMonto(resultado, moneda)}
                </strong>
                {moneda === "UI" && (
                  <EquivalenciaMontoUi
                    monto={resultado}
                    cotizacion={cotizacionUi.cotizacion}
                  />
                )}
                {totalCierre && (
                  <span className="dashboard-kpi-context">
                    {totalCierre.excesoLimite > 0
                      ? `Excede el límite en ${formatearMonto(totalCierre.excesoLimite, moneda)}`
                      : `Disponible operativo ${formatearMonto(totalCierre.disponible, moneda)}`}
                  </span>
                )}
              </div>
              );
            })
          ) : (
            <div className="dashboard-kpi-value">
              <strong
                className={
                  presupuestoDelPeriodo.resultadoUsd < 0
                    ? "dashboard-value-negative"
                    : "dashboard-value-positive"
                }
              >
                {presupuestoDelPeriodo.disponible
                  ? `${presupuestoDelPeriodo.resultadoUsd < 0
                    ? "Déficit"
                    : presupuestoDelPeriodo.resultadoUsd > 0
                      ? "Ahorro"
                      : "Sin diferencia"}: ${formatearMonto(
                    presupuestoDelPeriodo.resultadoUsd,
                    "USD",
                  )}`
                  : "Sin datos del período"}
              </strong>
              {presupuestoDelPeriodo.disponible && (
                <span className="dashboard-kpi-context">
                  Presupuesto {formatearMonto(
                    presupuestoDelPeriodo.presupuestoUsd,
                    "USD",
                  )}
                  {" · "}
                  Transferido {formatearMonto(
                    presupuestoDelPeriodo.transferidoUsd,
                    "USD",
                  )}
                </span>
              )}
            </div>
          )}
          <small>
            {esCuentaCredito
              ? ultimoResumenFiltrado
                ? `Cierre ${formatearFecha(ultimoResumenFiltrado.cierre)}; sin monto real`
                : "Todavía no hay un resumen dentro del período"
              : "US$ 4.000 mensuales menos transferencias salientes desde CA USD"}
          </small>
        </article>
        <article
          className={pendientesTotales > 0 ? "dashboard-pending-kpi is-clickable" : "dashboard-pending-kpi"}
        >
          {pendientesTotales > 0 && (
            <a
              className="dashboard-kpi-overlay-link"
              href="#dashboard-movimientos-pendientes"
              aria-label={`Ver ${pendientesTotales} movimientos pendientes`}
            />
          )}
          <span>Movimientos pendientes</span>
          <strong>{pendientesTotales}</strong>
          <small>
            {pendientesTotales > 0
              ? "Ver lista dentro del período filtrado →"
              : "Dentro de los meses filtrados"}
          </small>
        </article>
      </section>

      {pendientesTotales > 0 && (
        <MovimientosPendientesDashboard
          movimientos={movimientosPendientesFiltrados}
          cuentas={cuentas}
          mostrarCuenta={cuentaSeleccionada === "todas"}
        />
      )}

      {esCuentaCredito && disponibleOperativoTarjeta && (
        <section
          id="dashboard-conciliacion"
          className="credit-operational-reconciliation page-scroll-section"
        >
          <header>
            <div>
              <span>Conciliación del límite</span>
              <h2>Disponible operativo estimado</h2>
            </div>
            <strong>
              {disponibleOperativoTarjeta.disponible === null
                ? (cotizacionUi.error
                  ? "Cotización no disponible"
                  : "Consultando cotización...")
                : formatearMonto(
                  disponibleOperativoTarjeta.disponible,
                  disponibleOperativoTarjeta.moneda,
                )}
            </strong>
          </header>
          <div className="credit-operational-formula">
            <div>
              <span>Límite</span>
              <strong>
                {formatearMonto(
                  disponibleOperativoTarjeta.limite,
                  disponibleOperativoTarjeta.moneda,
                )}
              </strong>
            </div>
            <div>
              <span>
                {disponibleOperativoTarjeta.saldoFinal <= 0
                  ? "Saldo a favor"
                  : "Deuda del cierre"}
              </span>
              <strong>
                {formatearMonto(
                  Math.abs(disponibleOperativoTarjeta.saldoFinal),
                  disponibleOperativoTarjeta.moneda,
                )}
              </strong>
            </div>
            <div>
              <span>Cuotas futuras</span>
              <strong>
                -{formatearMonto(
                  disponibleOperativoTarjeta.cuotasFuturas,
                  disponibleOperativoTarjeta.moneda,
                )}
              </strong>
            </div>
            {disponibleOperativoTarjeta.ajustesMoneda.map((ajuste) => (
              <div key={ajuste.moneda}>
                <span>Ajuste por saldo {ajuste.moneda}</span>
                <strong>
                  {ajuste.ajuste >= 0 ? "+" : ""}
                  {formatearMonto(
                    ajuste.ajuste,
                    disponibleOperativoTarjeta.moneda,
                  )}
                </strong>
              </div>
            ))}
          </div>
          <p>
            Se toma el último cierre, se descuentan las cuotas todavía no
            facturadas y, cuando el límite es compartido, se convierten los
            saldos de otras monedas con la referencia BCU disponible.
          </p>
        </section>
      )}

      {!esCuentaCredito && (
        <RegistroSubcategorias
          registros={registroGastosSubcategorias}
          mostrarCuentas={cuentaSeleccionada === "todas"}
        />
      )}

      <section
        id="dashboard-comparaciones"
        className="monthly-comparison-card monthly-comparisons-card page-scroll-section"
      >
        <header className="monthly-comparison-header">
          <div>
            <h2>Comparaciones</h2>
            <p>
              Cada mes reúne UYU, USD y UI en ese orden. Los importes y las
              escalas permanecen separados por moneda.
            </p>
          </div>
          <button
            type="button"
            className="monthly-comparison-toggle"
            onClick={alternarComparacion}
            aria-expanded={!comparacionesContraidas}
            aria-controls="comparaciones-mensuales-dashboard"
            aria-label={
              comparacionesContraidas
                ? "Desplegar comparaciones"
                : "Contraer comparaciones"
            }
            title={
              comparacionesContraidas
                ? "Desplegar comparaciones"
                : "Contraer comparaciones"
            }
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className={comparacionesContraidas ? "is-collapsed" : ""}
            >
              <path d="M5.5 7.5 10 12l4.5-4.5" />
            </svg>
          </button>
        </header>

        <div
          id="comparaciones-mensuales-dashboard"
          hidden={comparacionesContraidas}
        >
          <div className="monthly-combined-legend">
            <div className="dashboard-legend" aria-label="Leyenda">
              <span>
                <i className="banking-dot" />
                {esCuentaCredito ? "Consumos" : "Monto bancario"}
              </span>
              <span>
                <i className="real-dot" />
                {esCuentaCredito ? "Pagos y reintegros" : "Monto real"}
              </span>
            </div>
          </div>

          <div className="monthly-periods-list">
            {meses.map((claveMes, indiceMes) => {
              const cantidadMovimientos = monedasDashboard.reduce(
                (total, moneda) =>
                  total
                  + (datosMensualesPorMoneda[moneda][indiceMes]?.cantidad || 0),
                0,
              );
              const presupuestoMes = presupuestoPorMes.get(claveMes);
              const resultadoPresupuestoMes = numeroFinito(
                presupuestoMes?.resultadoUsd,
              );
              const etiquetaPresupuestoMes = resultadoPresupuestoMes < 0
                ? "Déficit"
                : resultadoPresupuestoMes > 0
                  ? "Ahorro"
                  : "Sin diferencia";

              return (
                <article className="monthly-period-group" key={claveMes}>
                  <header className="monthly-period-header">
                    <strong>{formatearMes(claveMes)}</strong>
                    <div className="monthly-period-meta">
                      <span>{cantidadMovimientos} movimientos</span>
                      {!esCuentaCredito && presupuestoMes?.disponible && (
                        <small
                          className={
                            resultadoPresupuestoMes < 0
                              ? "monthly-saving-negative"
                              : "monthly-saving-positive"
                          }
                        >
                          {etiquetaPresupuestoMes}: {formatearMonto(
                            resultadoPresupuestoMes,
                            "USD",
                          )}
                        </small>
                      )}
                    </div>
                  </header>

                  <div className="monthly-period-currencies">
                    {monedasDashboard.map((moneda) => {
                      const mes = datosMensualesPorMoneda[moneda][indiceMes];
                      const segundoMonto = esCuentaCredito
                        ? mes.pagosTarjeta
                        : mes.montoReal;
                      const resultadoTarjeta = mes.saldoTarjeta;
                      const resultadoTarjetaPositivo = resultadoTarjeta < 0;
                      const tarjetaSinVariacion = resultadoTarjeta === 0;
                      const etiquetaResultadoTarjeta = tarjetaSinVariacion
                        ? "Sin variación"
                        : resultadoTarjetaPositivo
                          ? "Redujo deuda"
                          : "Aumentó deuda";
                      const maximoBarras = maximosComparacionPorMoneda[moneda];

                      return (
                        <section
                          className="monthly-currency-comparison"
                          key={`${claveMes}-${moneda}`}
                        >
                          <div className="monthly-currency-summary">
                            <strong>{moneda}</strong>
                            <span>{mes.cantidad} movimientos</span>
                            {esCuentaCredito ? (
                              <small
                                className={
                                  resultadoTarjetaPositivo || tarjetaSinVariacion
                                    ? "monthly-saving-positive"
                                    : "monthly-saving-negative"
                                }
                              >
                                {etiquetaResultadoTarjeta}: {formatearMonto(
                                  Math.abs(resultadoTarjeta),
                                  moneda,
                                )}
                              </small>
                            ) : (
                              <small className="monthly-budget-context">
                                Gasto real {formatearMonto(mes.montoReal, moneda)}
                              </small>
                            )}
                          </div>

                          <div className="monthly-bars">
                            <div className="monthly-bar-line">
                              <span className="monthly-bar-name">
                                {esCuentaCredito ? "Consumos" : "Bancario"}
                              </span>
                              <span className="monthly-bar-amount">
                                <strong>
                                  {formatearMonto(mes.montoBancario, moneda)}
                                </strong>
                                {moneda === "UI" && (
                                  <EquivalenciaMontoUi
                                    monto={mes.montoBancario}
                                    cotizacion={cotizacionUi.cotizacion}
                                  />
                                )}
                              </span>
                              <div className="monthly-bar-track">
                                <span
                                  className="monthly-bar-fill monthly-bar-banking"
                                  style={{
                                    width: `${Math.max(
                                      0,
                                      (mes.montoBancario / maximoBarras) * 100,
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>

                            <div className="monthly-bar-line">
                              <span className="monthly-bar-name">
                                {esCuentaCredito ? "Pagos" : "Real"}
                              </span>
                              <span className="monthly-bar-amount">
                                <strong>
                                  {formatearMonto(segundoMonto, moneda)}
                                </strong>
                                {moneda === "UI" && (
                                  <EquivalenciaMontoUi
                                    monto={segundoMonto}
                                    cotizacion={cotizacionUi.cotizacion}
                                  />
                                )}
                              </span>
                              <div className="monthly-bar-track">
                                <span
                                  className="monthly-bar-fill monthly-bar-real"
                                  style={{
                                    width: `${Math.max(
                                      0,
                                      (segundoMonto / maximoBarras) * 100,
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {esCuentaCredito && (
        <section
          id="dashboard-categorias"
          className="monthly-comparison-card credit-category-breakdown page-scroll-section"
        >
          <header className="monthly-comparison-header">
            <div>
              <h2>Consumos por categoría y subcategoría</h2>
              <p>
                Usa únicamente el monto bancario de compras, cuotas y
                reintegros. Los pagos de la tarjeta no se reparten como gasto.
              </p>
            </div>
            <button
              type="button"
              className="monthly-comparison-toggle"
              onClick={() => setPanelCategoriasContraido((actual) => !actual)}
              aria-expanded={!panelCategoriasContraido}
              aria-controls="dashboard-categorias-tarjeta"
              aria-label={
                panelCategoriasContraido
                  ? "Desplegar categorías de tarjeta"
                  : "Contraer categorías de tarjeta"
              }
              title={
                panelCategoriasContraido
                  ? "Desplegar categorías"
                  : "Contraer categorías"
              }
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={panelCategoriasContraido ? "is-collapsed" : ""}
              >
                <path d="M5.5 7.5 10 12l4.5-4.5" />
              </svg>
            </button>
          </header>

          <div
            id="dashboard-categorias-tarjeta"
            className="credit-category-breakdown-content"
            hidden={panelCategoriasContraido}
          >
            {desgloseCategoriasTarjeta.length === 0 ? (
              <p className="credit-dashboard-summary-empty-row">
                No hay consumos creados y categorizados en este período.
              </p>
            ) : (
              <div className="credit-dashboard-movements-table">
                <table>
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Subcategoría</th>
                      {monedasDashboard.map((moneda) => (
                        <th key={moneda}>{moneda}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {desgloseCategoriasTarjeta.map((fila) => (
                      <tr key={`${fila.categoria}-${fila.subcategoria}`}>
                        <td>{fila.categoria}</td>
                        <td>{fila.subcategoria}</td>
                        {monedasDashboard.map((moneda) => (
                          <td key={moneda}>
                            {formatearMonto(fila.montos[moneda], moneda)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {esCuentaCredito && (
        <section
          id="dashboard-resumenes"
          className="monthly-comparison-card credit-dashboard-summaries page-scroll-section"
        >
          <header className="monthly-comparison-header">
            <div>
              <h2>Resúmenes del período</h2>
              <p>
                Se agrupan por fecha de cierre. Las compras mantienen su fecha
                original en la comparación mensual.
              </p>
            </div>
            <button
              type="button"
              className="monthly-comparison-toggle"
              onClick={() => setPanelResumenesContraido((actual) => !actual)}
              aria-expanded={!panelResumenesContraido}
              aria-controls="dashboard-resumenes-tarjeta"
              aria-label={
                panelResumenesContraido
                  ? "Desplegar resúmenes de tarjeta"
                  : "Contraer resúmenes de tarjeta"
              }
              title={
                panelResumenesContraido
                  ? "Desplegar resúmenes"
                  : "Contraer resúmenes"
              }
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={panelResumenesContraido ? "is-collapsed" : ""}
              >
                <path d="M5.5 7.5 10 12l4.5-4.5" />
              </svg>
            </button>
          </header>

          <div
            id="dashboard-resumenes-tarjeta"
            className="credit-dashboard-summary-list"
            hidden={panelResumenesContraido}
          >
            {resumenesFiltrados.length === 0 ? (
              <div className="credit-dashboard-summary-empty">
                <strong>No hay resúmenes con cierre en este período.</strong>
                <span>
                  Las compras pueden igualmente aparecer arriba según su fecha.
                </span>
              </div>
            ) : (
              resumenesFiltrados.map((resumen) => {
                const resumenContraido = Boolean(
                  resumenesContraidos[resumen._id],
                );
                const resumenContenidoId = `dashboard-resumen-${resumen._id}`;
                const movimientos = gastosPorResumen.get(resumen._id) || [];
                const monedasResumen = monedasDashboard.filter(
                  (moneda) => resumen.totales?.[moneda],
                );

                return (
                  <article
                    className="credit-summary-card credit-dashboard-summary-card"
                    key={resumen._id}
                  >
                    <header className="credit-summary-card-header">
                      <div>
                        <p className="eyebrow">Resumen</p>
                        <h3>
                          {resumen.periodo
                            || `Cierre ${formatearFecha(resumen.cierre)}`}
                        </h3>
                        <p>
                          Cierre: {formatearFecha(resumen.cierre)}
                          {" · "}
                          Vencimiento: {formatearFecha(resumen.vencimiento)}
                        </p>
                      </div>
                      <div className="credit-dashboard-summary-header-actions">
                        <span className="credit-summary-count">
                          {cantidadMovimientosResumen(resumen.totales)} movimientos
                        </span>
                        <button
                          type="button"
                          className="monthly-comparison-toggle"
                          onClick={() => alternarResumen(resumen._id)}
                          aria-expanded={!resumenContraido}
                          aria-controls={resumenContenidoId}
                          aria-label={
                            resumenContraido
                              ? `Desplegar resumen ${resumen.periodo || ""}`
                              : `Contraer resumen ${resumen.periodo || ""}`
                          }
                          title={
                            resumenContraido
                              ? "Desplegar resumen"
                              : "Contraer resumen"
                          }
                        >
                          <svg
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                            className={resumenContraido ? "is-collapsed" : ""}
                          >
                            <path d="M5.5 7.5 10 12l4.5-4.5" />
                          </svg>
                        </button>
                      </div>
                    </header>

                    <div
                      id={resumenContenidoId}
                      className="credit-dashboard-summary-content"
                      hidden={resumenContraido}
                    >
                      <div className="credit-summary-currencies">
                        {monedasResumen.map((moneda) => {
                          const total = resumen.totales[moneda];
                          return (
                            <section
                              className="credit-summary-currency"
                              key={moneda}
                            >
                              <div className="credit-summary-currency-title">
                                <strong>{moneda}</strong>
                                <span>{total.porcentajeUsado}% utilizado</span>
                              </div>
                              <div className="credit-summary-amounts">
                                <div>
                                  <span>Límite</span>
                                  <strong>
                                    {total.limite === null
                                      ? "No informado"
                                      : formatearMonto(total.limite, moneda)}
                                  </strong>
                                </div>
                                <div>
                                  <span>Consumos</span>
                                  <strong>
                                    {formatearMonto(total.consumos, moneda)}
                                  </strong>
                                </div>
                                <div>
                                  <span>Pagos y reintegros</span>
                                  <strong>
                                    {formatearMonto(
                                      total.pagosYReintegros,
                                      moneda,
                                    )}
                                  </strong>
                                </div>
                                <div>
                                  <span>Deuda del resumen</span>
                                  <strong className="credit-summary-debt">
                                    {formatearMonto(total.deuda, moneda)}
                                  </strong>
                                </div>
                                <div>
                                  <span>Cuotas futuras</span>
                                  <strong>
                                    {formatearMonto(
                                      total.cuotasFuturas,
                                      moneda,
                                    )}
                                  </strong>
                                </div>
                                <div>
                                  <span>
                                    {total.excesoLimite > 0
                                      ? "Exceso del límite"
                                      : "Disponible operativo"}
                                  </span>
                                  <strong
                                    className={
                                      total.excesoLimite > 0
                                        ? "credit-summary-debt"
                                        : "credit-summary-available"
                                    }
                                  >
                                    {formatearMonto(
                                      total.excesoLimite > 0
                                        ? total.excesoLimite
                                        : total.disponible,
                                      moneda,
                                    )}
                                  </strong>
                                </div>
                              </div>
                              <div
                                className="credit-summary-progress"
                                aria-label={`${total.porcentajeUsado}% del límite utilizado`}
                              >
                                <span
                                  style={{
                                    width: `${total.porcentajeBarra ?? Math.min(100, total.porcentajeUsado)}%`,
                                  }}
                                />
                              </div>
                            </section>
                          );
                        })}
                      </div>

                      <PlanesCuotasTarjeta
                        planes={resumen.planesCuotas || []}
                        compacto
                      />

                      <div className="credit-dashboard-movements">
                        <div className="credit-dashboard-movements-header">
                          <div>
                            <strong>Movimientos del resumen</strong>
                            <span>
                              {cantidadPendientesResumen(resumen.totales)}
                              {" "}
                              pendientes
                            </span>
                          </div>
                          <Link
                            className="secondary-link"
                            to={`/cuentas/${cuentaActual._id}/resumenes/${resumen._id}/gastos`}
                          >
                            Abrir desglose
                          </Link>
                        </div>

                        {movimientos.length === 0 ? (
                          <p className="credit-dashboard-summary-empty-row">
                            No hay movimientos para mostrar.
                          </p>
                        ) : (
                          <div className="credit-dashboard-movements-table">
                            <table>
                              <thead>
                                <tr>
                                  <th>Fecha</th>
                                  <th>Detalle</th>
                                  <th>Tipo</th>
                                  <th>Bancario</th>
                                  <th>Categoría</th>
                                  <th>Subcategoría</th>
                                  <th>Estado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {movimientos.map((movimiento) => {
                                  const moneda = obtenerMonedaMovimiento(
                                    cuentaActual,
                                    movimiento.moneda,
                                  );
                                  return (
                                    <tr key={movimiento._id}>
                                      <td>{formatearFecha(movimiento.fecha)}</td>
                                      <td title={movimiento.detalle}>
                                        {movimiento.detalle}
                                      </td>
                                      <td>
                                        {movimiento.tipoMovimiento || "manual"}
                                      </td>
                                      <td>
                                        {formatearMonto(
                                          movimiento.montoBancario,
                                          moneda,
                                        )}
                                      </td>
                                      <td>
                                        {movimiento.categoriaId
                                          ?.nombreCategoria || "Sin categoría"}
                                      </td>
                                      <td>
                                        {movimiento.subcategoriaId
                                          ?.nombreSubcategoria || "Sin subcategoría"}
                                      </td>
                                      <td>{movimiento.estado}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      <aside className="dashboard-savings-note">
        <span className="dashboard-savings-icon">$</span>
        <div>
          <h3>
            {esCuentaCredito
              ? "¿Cómo se interpreta la tarjeta?"
              : "¿Cómo se calcula el ahorro total?"}
          </h3>
          {esCuentaCredito ? (
            <p>
              La tarjeta conserva únicamente el flujo bancario: compras y
              cuotas aumentan la deuda; pagos y reintegros la reducen. El
              impacto económico se registra una sola vez en la cuenta
              bancaria desde la que pagás la tarjeta. El vínculo sirve para
              conciliar ambos movimientos, no para anular ese pago. Las
              cuotas futuras reducen el límite operativo hasta que cada plan
              llega a su última cuota.
            </p>
          ) : (
            <p>
              Cada mes parte de un presupuesto fijo de US$ 4.000. Las salidas
              desde Caja Ahorro USD con subcategoría Transf. consumen ese monto:
              si lo superan hay déficit y, si queda disponible, hay ahorro. Las
              transferencias siguen siendo neutrales para el movimiento bancario
              y el Gasto Real se muestra por separado.
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}

export default DashboardPage;
