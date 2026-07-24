import crypto from "node:crypto";
import XLSX from "xlsx";
import { normalizarMontoBancarioTarjeta } from "./resumenTarjetaTotales.js";

export const normalizarTexto = (texto) =>
  String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const parsearMontoFlexible = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  let texto = String(valor)
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!texto || texto === "-" || texto === "." || texto === ",") return null;

  const ultimoPunto = texto.lastIndexOf(".");
  const ultimaComa = texto.lastIndexOf(",");

  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    const separadorDecimal = ultimoPunto > ultimaComa ? "." : ",";
    const separadorMiles = separadorDecimal === "." ? "," : ".";
    texto = texto.split(separadorMiles).join("");
    if (separadorDecimal === ",") texto = texto.replace(",", ".");
  } else {
    const separador = ultimoPunto >= 0 ? "." : ultimaComa >= 0 ? "," : "";

    if (separador) {
      const partes = texto.split(separador);
      const decimales = partes.at(-1)?.length || 0;
      const apareceVariasVeces = partes.length > 2;

      if (apareceVariasVeces || decimales === 3) {
        texto = partes.join("");
      } else if (separador === ",") {
        texto = texto.replace(",", ".");
      }
    }
  }

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
};

export const parsearFechaFlexible = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor;

  if (typeof valor === "number") {
    const fechaExcel = XLSX.SSF.parse_date_code(valor);
    if (!fechaExcel) return null;
    return new Date(fechaExcel.y, fechaExcel.m - 1, fechaExcel.d);
  }

  const texto = String(valor).trim();
  if (!texto) return null;

  const partesLatinas = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (partesLatinas) {
    const [, dia, mes, anio] = partesLatinas;
    const anioNumero = Number(anio) < 100 ? 2000 + Number(anio) : Number(anio);
    const fecha = new Date(anioNumero, Number(mes) - 1, Number(dia));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

export const obtenerTipoMovimientoTarjeta = (detalle, montoEstadoCuenta = null) => {
  const palabras = normalizarTexto(detalle).split(" ").filter(Boolean);

  if (palabras.includes("pago") || palabras.includes("pagos")) return "pago";
  if (palabras.includes("cuota") || palabras.includes("cuotas")) return "cuota";
  if (
    palabras.includes("devolucion") ||
    palabras.includes("reintegro") ||
    palabras.includes("reversa")
  ) {
    return "reintegro";
  }

  if (Number(montoEstadoCuenta) < 0) return "reintegro";
  return "compra";
};

const leerPrimeraHoja = (buffer, raw = false) => {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const nombreHoja = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[nombreHoja];
  const filas = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw,
  });

  return { filas, nombreHoja };
};

const buscarFilaEncabezados = (filas, requeridos) =>
  filas.findIndex((fila) => {
    const encabezados = fila.map(normalizarTexto);
    return requeridos.every((requerido) => encabezados.includes(requerido));
  });

const buscarIndice = (encabezados, nombres) => {
  const normalizados = encabezados.map(normalizarTexto);
  return normalizados.findIndex((encabezado) => nombres.includes(encabezado));
};

const valorDebajoDeEtiqueta = (filas, etiqueta) => {
  for (let filaIndex = 0; filaIndex < filas.length - 1; filaIndex += 1) {
    const columnaIndex = filas[filaIndex].findIndex(
      (celda) => normalizarTexto(celda) === etiqueta,
    );
    if (columnaIndex >= 0) return filas[filaIndex + 1]?.[columnaIndex] ?? null;
  }
  return null;
};

const extraerParMonedas = (filas, etiqueta) => {
  const filaIndex = filas.findIndex((fila) =>
    fila.some((celda) => normalizarTexto(celda) === etiqueta),
  );
  if (filaIndex < 0) return { UYU: null, USD: null };

  const fila = filas[filaIndex];
  let pesosIndex = -1;
  let dolaresIndex = -1;

  for (let indice = filaIndex - 1; indice >= Math.max(0, filaIndex - 5); indice -= 1) {
    const encabezados = filas[indice].map(normalizarTexto);
    if (pesosIndex < 0) pesosIndex = encabezados.indexOf("pesos");
    if (dolaresIndex < 0) dolaresIndex = encabezados.indexOf("dolares");
    if (pesosIndex >= 0 || dolaresIndex >= 0) break;
  }

  return {
    UYU: pesosIndex >= 0 ? parsearMontoFlexible(fila[pesosIndex]) : null,
    USD: dolaresIndex >= 0 ? parsearMontoFlexible(fila[dolaresIndex]) : null,
  };
};

const crearHashMovimiento = (movimiento) =>
  crypto
    .createHash("sha256")
    .update(
      [
        movimiento.fecha?.toISOString().slice(0, 10),
        movimiento.fila,
        movimiento.tarjeta,
        normalizarTexto(movimiento.detalle),
        movimiento.importePesos,
        movimiento.importeDolares,
      ].join("|"),
    )
    .digest("hex");

export const parsearExcelTarjeta = (buffer) => {
  const { filas, nombreHoja } = leerPrimeraHoja(buffer, false);
  const filaEncabezadosIndex = buscarFilaEncabezados(filas, ["fecha", "tarjeta", "detalle"]);

  if (filaEncabezadosIndex < 0) {
    throw new Error("No se encontraron encabezados validos en el Excel de tarjeta");
  }

  const encabezados = filas[filaEncabezadosIndex];
  const fechaIndex = buscarIndice(encabezados, ["fecha"]);
  const tarjetaIndex = buscarIndice(encabezados, ["tarjeta"]);
  const detalleIndex = buscarIndice(encabezados, ["detalle"]);
  const importePesosIndex = buscarIndice(encabezados, ["importe"]);
  const importePesosExactoIndex = encabezados.findIndex((celda) =>
    String(celda || "").toLowerCase().includes("importe $"),
  );
  const importeDolaresIndex = encabezados.findIndex((celda) =>
    String(celda || "").toLowerCase().includes("importe u$s"),
  );
  const pesosIndex = importePesosExactoIndex >= 0 ? importePesosExactoIndex : importePesosIndex;

  if ([fechaIndex, tarjetaIndex, detalleIndex, pesosIndex, importeDolaresIndex].some((i) => i < 0)) {
    throw new Error("El Excel de tarjeta no contiene todas las columnas requeridas");
  }

  const movimientos = filas
    .slice(filaEncabezadosIndex + 1)
    .map((fila, index) => {
      const fecha = parsearFechaFlexible(fila[fechaIndex]);
      const tarjeta = String(fila[tarjetaIndex] || "").trim();
      const detalle = String(fila[detalleIndex] || "").trim();
      const importePesos = parsearMontoFlexible(fila[pesosIndex]) || 0;
      const importeDolares = parsearMontoFlexible(fila[importeDolaresIndex]) || 0;
      const usaPesos = importePesos !== 0;
      const montoEstadoCuenta = usaPesos ? importePesos : importeDolares;
      const moneda = usaPesos ? "UYU" : "USD";
      const tipo = obtenerTipoMovimientoTarjeta(detalle, montoEstadoCuenta);
      const montoBancario = normalizarMontoBancarioTarjeta(
        montoEstadoCuenta,
        tipo,
      );
      const movimiento = {
        fila: filaEncabezadosIndex + index + 2,
        fecha,
        tarjeta,
        detalle,
        importePesos,
        importeDolares,
        montoEstadoCuenta,
        montoBancario,
        moneda,
        tipo,
        porcentaje: tipo === "pago" ? 0 : 100,
        incluirMontoReal: tipo !== "pago",
      };

      return { ...movimiento, sourceHash: crearHashMovimiento(movimiento) };
    })
    .filter((movimiento) => movimiento.fecha && movimiento.detalle && movimiento.montoEstadoCuenta !== 0);

  const saldoAnterior = { UYU: null, USD: null };
  const saldoFinal = { UYU: null, USD: null };
  const filaSaldoAnterior = filas.find((fila) => fila.some((celda) => normalizarTexto(celda) === "saldo anterior"));
  const filaSaldoFinal = filas.find((fila) => fila.some((celda) => normalizarTexto(celda) === "saldo final"));
  if (filaSaldoAnterior) {
    saldoAnterior.UYU = parsearMontoFlexible(filaSaldoAnterior[pesosIndex]);
    saldoAnterior.USD = parsearMontoFlexible(filaSaldoAnterior[importeDolaresIndex]);
  }
  if (filaSaldoFinal) {
    saldoFinal.UYU = parsearMontoFlexible(filaSaldoFinal[pesosIndex]);
    saldoFinal.USD = parsearMontoFlexible(filaSaldoFinal[importeDolaresIndex]);
  }

  const cuentaTarjeta = String(valorDebajoDeEtiqueta(filas, "cuenta") || "").trim();
  const resumen = {
    cuentaTarjetaUltimosDigitos: cuentaTarjeta.slice(-4),
    limiteCredito: {
      USD: parsearMontoFlexible(valorDebajoDeEtiqueta(filas, "limite de credito us")),
      UYU: parsearMontoFlexible(valorDebajoDeEtiqueta(filas, "limite de credito")),
    },
    cierre: parsearFechaFlexible(valorDebajoDeEtiqueta(filas, "fecha de cierre")),
    vencimiento: parsearFechaFlexible(valorDebajoDeEtiqueta(filas, "vencimiento")),
    periodo: String(valorDebajoDeEtiqueta(filas, "periodo consultado") || "").trim(),
    pagoContado: extraerParMonedas(filas, "pago contado"),
    pagoMinimo: extraerParMonedas(filas, "pago minimo"),
    saldoAnterior,
    saldoFinal,
  };

  return { nombreHoja, resumen, movimientos };
};

export const parsearExcelBancario = (buffer) => {
  const { filas, nombreHoja } = leerPrimeraHoja(buffer, false);
  const filaEncabezadosIndex = buscarFilaEncabezados(filas, [
    "fecha",
    "referencia",
    "tipo movimiento",
  ]);

  if (filaEncabezadosIndex < 0) {
    throw new Error("No se encontraron encabezados validos en el Excel bancario");
  }

  const encabezados = filas[filaEncabezadosIndex];
  const fechaIndex = buscarIndice(encabezados, ["fecha"]);
  const referenciaIndex = buscarIndice(encabezados, ["referencia"]);
  const tipoIndex = buscarIndice(encabezados, ["tipo movimiento"]);
  const descripcionIndex = buscarIndice(encabezados, ["descripcion"]);
  const debitoIndex = buscarIndice(encabezados, ["debito"]);
  const creditoIndex = buscarIndice(encabezados, ["credito"]);
  const moneda = String(valorDebajoDeEtiqueta(filas, "moneda") || "UYU").trim().toUpperCase();

  const movimientos = filas
    .slice(filaEncabezadosIndex + 1)
    .map((fila) => {
      const debito = parsearMontoFlexible(fila[debitoIndex]) || 0;
      const credito = parsearMontoFlexible(fila[creditoIndex]) || 0;
      const detalleTipo = String(fila[tipoIndex] || "").trim();
      const descripcion = descripcionIndex >= 0 ? String(fila[descripcionIndex] || "").trim() : "";
      return {
        fechaBanco: parsearFechaFlexible(fila[fechaIndex]),
        referenciaBanco: String(fila[referenciaIndex] || "").trim(),
        detalleOriginal: descripcion || detalleTipo,
        montoBancario: debito !== 0 ? debito : credito,
        moneda: moneda === "USD" ? "USD" : "UYU",
      };
    })
    .filter(
      (movimiento) =>
        movimiento.fechaBanco &&
        movimiento.referenciaBanco &&
        movimiento.detalleOriginal &&
        movimiento.montoBancario !== 0,
    );

  return { nombreHoja, movimientos };
};

const encontrarBloquesPersonales = (filas) => {
  const bloques = [];

  filas.forEach((fila, filaIndex) => {
    fila.forEach((celda, columnaIndex) => {
      if (normalizarTexto(celda) !== "fecha") return;
      const encabezados = fila.slice(columnaIndex, columnaIndex + 5).map(normalizarTexto);
      const esBloque =
        encabezados[1] === "detalle" &&
        encabezados[2] === "flujo bancario" &&
        encabezados[3].includes("economia real") &&
        encabezados[4] === "categoria";
      if (esBloque) bloques.push({ filaIndex, columnaIndex });
    });
  });

  return bloques;
};

const encontrarTablaPersonalSinEncabezados = (filas) => {
  const cantidadFilasValidas = filas.filter((fila) => {
    const fecha = parsearFechaFlexible(fila[0]);
    const detalle = String(fila[1] || "").trim();
    const montoBancario = parsearMontoFlexible(fila[2]);
    const nombreSubcategoria = String(fila[4] || "").trim();

    return Boolean(
      fecha
      && detalle
      && montoBancario !== null
      && montoBancario !== 0
      && nombreSubcategoria,
    );
  }).length;

  if (cantidadFilasValidas === 0) return [];

  return [{ filaIndex: -1, columnaIndex: 0 }];
};

export const parsearExcelPersonal = (buffer) => {
  const { filas, nombreHoja } = leerPrimeraHoja(buffer, true);
  const bloquesConEncabezados = encontrarBloquesPersonales(filas);
  const bloques = bloquesConEncabezados.length > 0
    ? bloquesConEncabezados
    : encontrarTablaPersonalSinEncabezados(filas);
  if (bloques.length === 0) {
    throw new Error(
      "No se encontró un formato personal válido. Se esperaban columnas de fecha, detalle, flujo bancario, economía real y categoría.",
    );
  }

  const filasEncabezado = [...new Set(bloques.map((bloque) => bloque.filaIndex))].sort((a, b) => a - b);
  const movimientos = [];

  bloques.forEach((bloque) => {
    const siguienteFilaEncabezado =
      filasEncabezado.find((filaIndex) => filaIndex > bloque.filaIndex) ?? filas.length;

    for (let indice = bloque.filaIndex + 1; indice < siguienteFilaEncabezado; indice += 1) {
      const fila = filas[indice];
      const fecha = parsearFechaFlexible(fila[bloque.columnaIndex]);
      const detalle = String(fila[bloque.columnaIndex + 1] || "").trim();
      const montoBancario = parsearMontoFlexible(fila[bloque.columnaIndex + 2]);
      const montoReal = parsearMontoFlexible(fila[bloque.columnaIndex + 3]);
      const nombreSubcategoria = String(fila[bloque.columnaIndex + 4] || "").trim();

      if (!fecha || !detalle || montoBancario === null || montoBancario === 0) continue;
      const porcentaje = montoReal !== null
        ? Number(Math.min(100, Math.abs((montoReal / montoBancario) * 100)).toFixed(2))
        : 0;

      const sourceHash = crypto
        .createHash("sha256")
        .update(
          [
            bloque.filaIndex,
            bloque.columnaIndex,
            indice,
            fecha.toISOString().slice(0, 10),
            normalizarTexto(detalle),
            montoBancario,
            montoReal,
            normalizarTexto(nombreSubcategoria),
          ].join("|"),
        )
        .digest("hex");

      movimientos.push({
        fecha,
        detalle,
        montoBancario,
        porcentaje,
        nombreSubcategoria,
        sourceHash,
      });
    }
  });

  return { nombreHoja, movimientos };
};
