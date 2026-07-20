import XLSX from "xlsx";
import MovimientoImportado from "../0.1-models/movimientoImportado.model.js";
import Gasto from "../0.1-models/gasto.model.js";
import Subcategoria from "../0.1-models/subcategoria.model.js";
import { crearGastoService } from "./gasto.service.js";

export const importarExcelService = async ({ usuarioId, cuentaId, file }) => {
  if (!file) {
    throw new Error("No se recibio ningun archivo Excel");
  }

  const movimientos = obtenerMovimientos(file.buffer);

  const movimientosProcesados = [];

  for (const movimiento of movimientos) {
    const detalleNormalizado = normalizarTexto(movimiento.detalleOriginal);

    const hashBanco = crearHashBanco({
      usuarioId,
      cuentaId,
      referenciaBanco: movimiento.referenciaBanco,
      fechaBanco: movimiento.fechaBanco,
      montoBancario: movimiento.montoBancario,
      detalleNormalizado,
    });

    const movimientoExistente = await MovimientoImportado.findOne({
      usuarioId,
      cuentaId,
      hashBanco,
    });

    const posiblesDuplicados = await buscarPosiblesDuplicados({
      usuarioId,
      cuentaId,
      fechaBanco: movimiento.fechaBanco,
      montoBancario: movimiento.montoBancario,
      detalleNormalizado,
    });

    if (movimientoExistente) {
      movimientosProcesados.push({
        estado: "duplicado_importacion",
        movimiento: movimientoExistente,
        posiblesDuplicados,
      });

      continue;
    }

    const movimientoCreado = await MovimientoImportado.create({
      usuarioId,
      cuentaId,
      referenciaBanco: movimiento.referenciaBanco,
      fechaBanco: movimiento.fechaBanco,
      detalleOriginal: movimiento.detalleOriginal,
      detalleNormalizado,
      montoBancario: movimiento.montoBancario,
      moneda: movimiento.moneda,
      hashBanco,
      archivoNombre: file.originalname,
    });

    movimientosProcesados.push({
      estado: posiblesDuplicados.length > 0 ? "posible_duplicado" : "nuevo",
      movimiento: movimientoCreado,
      posiblesDuplicados,
    });
  }

  return {
    totalLeidos: movimientos.length,
    totalProcesados: movimientosProcesados.length,
    movimientos: movimientosProcesados,
  };
};


export const importarExcelPersonalService = async ({ usuarioId, cuentaId, file }) => {
  if (!file) {
    throw new Error("No se recibio ningun archivo Excel");
  }

  const movimientos = obtenerMovimientosPersonales(file.buffer);
  const gastosProcesados = [];

  for (const movimiento of movimientos) {
    const subcategoria = movimiento.nombreSubcategoria
      ? await Subcategoria.findOne({
          usuarioId,
          nombreSubcategoria: new RegExp(`^${escaparRegex(movimiento.nombreSubcategoria)}$`, "i"),
        })
      : null;

    const gasto = await crearGastoService(
      {
        detalle: movimiento.detalle,
        cuentaId,
        fecha: movimiento.fecha,
        montoBancario: movimiento.montoBancario,
        porcentaje: movimiento.porcentaje,
        incluirMontoReal: true,
        subcategoriaId: subcategoria?._id,
        cambiarEstado: false,
        origen: {
          tipo: "excel",
          referenciaId: null,
        },
      },
      usuarioId
    );

    gastosProcesados.push({
      gasto,
      subcategoriaEncontrada: Boolean(subcategoria),
      nombreSubcategoria: movimiento.nombreSubcategoria,
    });
  }

  return {
    totalLeidos: movimientos.length,
    totalProcesados: gastosProcesados.length,
    gastos: gastosProcesados,
  };
};
const obtenerMovimientos = (buffer) => {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
  });

  const primeraHoja = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[primeraHoja];

  const filas = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  const filaEncabezadosIndex = filas.findIndex((fila) =>
    fila.includes("Fecha") &&
    fila.includes("Referencia") &&
    fila.includes("Tipo Movimiento")
  );

  if (filaEncabezadosIndex === -1) {
    throw new Error("No se encontraron encabezados validos en el Excel");
  }

  const filasMovimientos = filas.slice(filaEncabezadosIndex + 1);

  return filasMovimientos
    .filter((fila) => fila[1] && fila[2] && fila[3])
    .map((fila) => {
      const debito = parsearMonto(fila[6]);
      const credito = parsearMonto(fila[8]);
      const montoBancario = debito !== 0 ? debito : credito;

      return {
        fechaBanco: parsearFecha(fila[1]),
        referenciaBanco: String(fila[2]),
        detalleOriginal: String(fila[3]),
        montoBancario,
        moneda: "UYU",
      };
    });
};


const obtenerMovimientosPersonales = (buffer) => {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
  });

  const primeraHoja = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[primeraHoja];

  const filas = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  const bloques = encontrarBloquesPersonales(filas);

  if (bloques.length === 0) {
    throw new Error("No se encontraron bloques personales validos en el Excel");
  }

  const filasEncabezado = [...new Set(bloques.map((bloque) => bloque.filaIndex))]
    .sort((a, b) => a - b);
  const movimientos = [];

  bloques.forEach((bloque) => {
    const siguienteFilaEncabezado = filasEncabezado.find(
      (filaIndex) => filaIndex > bloque.filaIndex
    ) ?? filas.length;

    for (let i = bloque.filaIndex + 1; i < siguienteFilaEncabezado; i += 1) {
      const fila = filas[i];
      const fecha = parsearFechaFlexible(fila[bloque.columnaIndex]);
      const detalle = String(fila[bloque.columnaIndex + 1] || "").trim();
      const montoBancario = parsearMontoFlexible(fila[bloque.columnaIndex + 2]);
      const montoReal = parsearMontoFlexible(fila[bloque.columnaIndex + 3]);
      const nombreSubcategoria = String(fila[bloque.columnaIndex + 4] || "").trim();

      if (!fecha && !detalle && montoBancario === null && montoReal === null && !nombreSubcategoria) {
        continue;
      }

      if (!fecha || !detalle || montoBancario === null || montoBancario === 0) {
        continue;
      }

      const porcentaje = montoReal !== null
        ? Number(Math.abs((montoReal / montoBancario) * 100).toFixed(2))
        : 0;

      movimientos.push({
        fecha,
        detalle,
        montoBancario,
        porcentaje,
        nombreSubcategoria,
      });
    }
  });

  return movimientos;
};

const encontrarBloquesPersonales = (filas) => {
  const bloques = [];

  filas.forEach((fila, filaIndex) => {
    fila.forEach((celda, columnaIndex) => {
      if (normalizarTexto(celda) !== "fecha") return;

      const encabezados = fila
        .slice(columnaIndex, columnaIndex + 5)
        .map(normalizarTexto);

      const esBloquePersonal =
        encabezados[1] === "detalle" &&
        encabezados[2] === "flujo bancario" &&
        encabezados[3].includes("economia real") &&
        encabezados[4] === "categoria";

      if (esBloquePersonal) {
        bloques.push({ filaIndex, columnaIndex });
      }
    });
  });

  return bloques;
};
const parsearFechaFlexible = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor;

  if (typeof valor === "number") {
    const fechaExcel = XLSX.SSF.parse_date_code(valor);
    if (!fechaExcel) return null;
    return new Date(fechaExcel.y, fechaExcel.m - 1, fechaExcel.d);
  }

  const texto = String(valor).trim();

  if (!texto) return null;

  if (texto.includes("/")) {
    const partes = texto.split("/").map(Number);
    const [dia, mes, anio] = partes;
    const anioCompleto = anio < 100 ? 2000 + anio : anio;
    return new Date(anioCompleto, mes - 1, dia);
  }

  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const parsearMontoFlexible = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return valor;

  const normalizado = String(valor)
    .replace("$", "")
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
    .trim();

  if (!normalizado) return null;

  const numero = Number(normalizado);
  return Number.isNaN(numero) ? null : numero;
};
const buscarPosiblesDuplicados = async ({
  usuarioId,
  cuentaId,
  fechaBanco,
  montoBancario,
  detalleNormalizado,
}) => {
  const desde = new Date(fechaBanco);
  desde.setDate(desde.getDate() - 7);

  const hasta = new Date(fechaBanco);
  hasta.setDate(hasta.getDate() + 7);

  const gastos = await Gasto.find({
    usuarioId,
    cuentaId,
    montoBancario,
    fecha: {
      $gte: desde,
      $lte: hasta,
    },
  });

  return gastos.filter((gasto) => {
    const detalleGasto = normalizarTexto(gasto.detalle);
    return detalleGasto.includes(detalleNormalizado) ||
      detalleNormalizado.includes(detalleGasto);
  });
};

const crearHashBanco = ({
  usuarioId,
  cuentaId,
  referenciaBanco,
  fechaBanco,
  montoBancario,
  detalleNormalizado,
}) => {
  const fecha = new Date(fechaBanco).toISOString().slice(0, 10);

  return [
    usuarioId,
    cuentaId,
    referenciaBanco,
    fecha,
    montoBancario,
    detalleNormalizado,
  ].join("|");
};

const escaparRegex = (texto) => {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};
const normalizarTexto = (texto) => {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const parsearMonto = (valor) => {
  if (!valor) {
    return 0;
  }

  return Number(
    String(valor)
      .replace("$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  );
};

const parsearFecha = (valor) => {
  const [dia, mes, anio] = String(valor).split("/");

  return new Date(Number(anio), Number(mes) - 1, Number(dia));
};

export const obtenerMovimientosImportadosService = async ({
  usuarioId,
  cuentaId,
  estadoImportacion,
}) => {
  const filtro = {
    usuarioId,
    cuentaId,
  };

  if (estadoImportacion) {
    filtro.estadoImportacion = estadoImportacion;
  }

  return MovimientoImportado.find(filtro)
    .populate("gastoId")
    .sort({ fechaBanco: -1 });
};

export const ignorarMovimientoImportadoService = async ({ usuarioId, id }) => {
  const movimiento = await MovimientoImportado.findOneAndUpdate(
    { _id: id, usuarioId },
    {
      estadoImportacion: "ignorado",
      gastoId: null,
    },
    { new: true }
  );

  if (!movimiento) {
    throw new Error("Movimiento importado no encontrado");
  }

  return movimiento;
};

export const vincularMovimientoAGastoService = async ({
  usuarioId,
  id,
  gastoId,
}) => {
  const movimiento = await MovimientoImportado.findOne({
    _id: id,
    usuarioId,
  });

  if (!movimiento) {
    throw new Error("Movimiento importado no encontrado");
  }

  const gasto = await Gasto.findOne({
    _id: gastoId,
    usuarioId,
    cuentaId: movimiento.cuentaId,
  });

  if (!gasto) {
    throw new Error("Gasto no encontrado para esta cuenta");
  }

  movimiento.gastoId = gasto._id;
  movimiento.estadoImportacion = "vinculado";

  await movimiento.save();

  return movimiento;
};

export const crearGastoDesdeMovimientoImportadoService = async ({
  usuarioId,
  id,
  data,
}) => {
  const movimiento = await MovimientoImportado.findOne({
    _id: id,
    usuarioId,
  });

  if (!movimiento) {
    throw new Error("Movimiento importado no encontrado");
  }

  if (movimiento.estadoImportacion === "vinculado") {
    throw new Error("El movimiento ya esta vinculado a un gasto");
  }

  const gasto = await crearGastoService(
    {
      detalle: data.detalle || movimiento.detalleOriginal,
      cuentaId: movimiento.cuentaId,
      fecha: data.fecha || movimiento.fechaBanco,
      montoBancario: movimiento.montoBancario,
      porcentaje: data.porcentaje,
      incluirMontoReal: data.incluirMontoReal,
      categoriaId: data.categoriaId,
      subcategoriaId: data.subcategoriaId,
      cambiarEstado: data.cambiarEstado,
      origen: {
        tipo: "excel",
        referenciaId: movimiento._id,
      },
    },
    usuarioId
  );

  movimiento.gastoId = gasto._id;
  movimiento.estadoImportacion = "vinculado";

  await movimiento.save();

  return {
    movimiento,
    gasto,
  };
};