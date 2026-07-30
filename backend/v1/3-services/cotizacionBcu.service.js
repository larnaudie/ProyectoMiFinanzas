const BCU_COTIZACIONES_URL =
  process.env.BCU_COTIZACIONES_URL
  || "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones";

const CODIGO_DOLAR_BILLETE = 2225;
const CODIGO_UNIDAD_INDEXADA = 9800;
const CACHE_MS = Number(process.env.BCU_COTIZACIONES_CACHE_MS) || 60 * 60 * 1000;
const TIMEOUT_MS = Number(process.env.BCU_COTIZACIONES_TIMEOUT_MS) || 8000;

let cacheCotizacion = null;
let consultaEnCurso = null;

const numeroFinito = (valor) => {
  const numero = Number(String(valor ?? "").trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
};

const extraerValorXml = (bloque, etiqueta) => {
  const coincidencia = bloque.match(
    new RegExp(`<${etiqueta}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${etiqueta}>`, "i"),
  );
  return coincidencia?.[1]?.trim() || "";
};

export const interpretarCotizacionesBcu = (xml) => {
  const bloques = [
    ...String(xml || "").matchAll(
      /<datoscotizaciones\.dato(?:\s[^>]*)?>([\s\S]*?)<\/datoscotizaciones\.dato>/gi,
    ),
  ];

  const cotizaciones = bloques
    .map((coincidencia) => {
      const bloque = coincidencia[1];
      return {
        fecha: extraerValorXml(bloque, "Fecha"),
        codigo: numeroFinito(extraerValorXml(bloque, "Moneda")),
        nombre: extraerValorXml(bloque, "Nombre"),
        compra: numeroFinito(extraerValorXml(bloque, "TCC")),
        venta: numeroFinito(extraerValorXml(bloque, "TCV")),
        arbitraje: numeroFinito(extraerValorXml(bloque, "ArbAct")),
      };
    })
    .filter(
      (cotizacion) =>
        cotizacion.fecha
        && cotizacion.codigo !== null
        && cotizacion.compra !== null,
    );

  const obtenerUltima = (codigo) =>
    cotizaciones
      .filter((cotizacion) => cotizacion.codigo === codigo)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null;

  const dolar = obtenerUltima(CODIGO_DOLAR_BILLETE);
  const ui = obtenerUltima(CODIGO_UNIDAD_INDEXADA);

  if (!dolar || !ui || dolar.compra <= 0 || ui.compra <= 0) {
    const error = new Error(
      "El BCU no devolvió una cotización válida para UI y dólar.",
    );
    error.status = 503;
    throw error;
  }

  return {
    fuente: "Banco Central del Uruguay",
    ui: {
      fecha: ui.fecha,
      uyuPorUnidad: ui.compra,
    },
    usd: {
      fecha: dolar.fecha,
      uyuPorDolar: dolar.compra,
    },
    equivalencias: {
      unaUiEnUyu: ui.compra,
      unaUiEnUsd: ui.compra / dolar.compra,
    },
  };
};

const fechaMontevideo = (fecha) => {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
};

export const crearSolicitudCotizacionesBcu = (ahora = new Date()) => {
  const fechaHasta = fechaMontevideo(ahora);
  const fechaDesdeDate = new Date(ahora);
  fechaDesdeDate.setUTCDate(fechaDesdeDate.getUTCDate() - 14);
  const fechaDesde = fechaMontevideo(fechaDesdeDate);

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">
  <soapenv:Header/>
  <soapenv:Body>
    <cot:wsbcucotizaciones.Execute>
      <cot:Entrada>
        <cot:Moneda>
          <cot:item>${CODIGO_DOLAR_BILLETE}</cot:item>
          <cot:item>${CODIGO_UNIDAD_INDEXADA}</cot:item>
        </cot:Moneda>
        <cot:FechaDesde>${fechaDesde}</cot:FechaDesde>
        <cot:FechaHasta>${fechaHasta}</cot:FechaHasta>
        <cot:Grupo>0</cot:Grupo>
      </cot:Entrada>
    </cot:wsbcucotizaciones.Execute>
  </soapenv:Body>
</soapenv:Envelope>`;
};

const consultarBcu = async ({
  fetchImpl = globalThis.fetch,
  ahora = new Date(),
} = {}) => {
  if (typeof fetchImpl !== "function") {
    const error = new Error("Este servidor no dispone de una conexión HTTP compatible.");
    error.status = 503;
    throw error;
  }

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const response = await fetchImpl(BCU_COTIZACIONES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=utf-8",
        SOAPAction: "Cotizaaction/AWSBCUCOTIZACIONES.Execute",
      },
      body: crearSolicitudCotizacionesBcu(ahora),
      signal: controlador.signal,
    });

    if (!response.ok) {
      const error = new Error(
        `El servicio de cotizaciones del BCU respondió con estado ${response.status}.`,
      );
      error.status = 503;
      throw error;
    }

    const resultado = interpretarCotizacionesBcu(await response.text());
    return {
      ...resultado,
      consultadaEn: ahora.toISOString(),
      desdeCache: false,
      desactualizada: false,
    };
  } catch (error) {
    if (!error.status) error.status = 503;
    if (error.name === "AbortError") {
      error.message = "La consulta al BCU superó el tiempo de espera.";
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const limpiarCacheCotizacionesBcu = () => {
  cacheCotizacion = null;
  consultaEnCurso = null;
};

export const obtenerCotizacionUiBcuService = async ({
  forzar = false,
  fetchImpl = globalThis.fetch,
  ahora = new Date(),
} = {}) => {
  const cacheVigente =
    cacheCotizacion
    && ahora.getTime() - cacheCotizacion.guardadaEn < CACHE_MS;

  if (!forzar && cacheVigente) {
    return {
      ...cacheCotizacion.valor,
      desdeCache: true,
      desactualizada: false,
    };
  }

  if (!forzar && consultaEnCurso) return consultaEnCurso;

  consultaEnCurso = consultarBcu({ fetchImpl, ahora })
    .then((cotizacion) => {
      cacheCotizacion = {
        guardadaEn: ahora.getTime(),
        valor: cotizacion,
      };
      return cotizacion;
    })
    .catch((error) => {
      if (cacheCotizacion) {
        return {
          ...cacheCotizacion.valor,
          desdeCache: true,
          desactualizada: true,
          advertencia:
            "No se pudo actualizar la cotización; se muestra la última consulta disponible.",
        };
      }
      throw error;
    })
    .finally(() => {
      consultaEnCurso = null;
    });

  return consultaEnCurso;
};
