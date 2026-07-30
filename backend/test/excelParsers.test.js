import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx";
import {
  listarHojasExcel,
  obtenerTipoMovimientoTarjeta,
  parsearExcelBancario,
  parsearExcelPersonal,
  parsearExcelTarjeta,
  parsearMontoFlexible,
} from "../v1/utils/excelParsers.js";

const crearBuffer = (filas) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(filas), "Datos");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

const crearBufferConHojas = (hojas) => {
  const workbook = XLSX.utils.book_new();
  Object.entries(hojas).forEach(([nombre, filas]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(filas), nombre);
  });
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

test("parsearMontoFlexible admite formatos bancarios latinos y anglosajones", () => {
  assert.equal(parsearMontoFlexible("-8,225.14"), -8225.14);
  assert.equal(parsearMontoFlexible("-1.092,10"), -1092.1);
  assert.equal(parsearMontoFlexible("$ -804,16"), -804.16);
  assert.equal(parsearMontoFlexible("93000"), 93000);
});

test("Merpago no se confunde con un pago de tarjeta", () => {
  assert.equal(obtenerTipoMovimientoTarjeta("Merpago Disershop", 1278.8), "compra");
  assert.equal(obtenerTipoMovimientoTarjeta("Pago Supernet", -804.16), "pago");
});

test("parsea el formato bancario por encabezados y conserva el monto", () => {
  const buffer = crearBuffer([
    ["Moneda"],
    ["UYU"],
    ["Fecha", "Referencia", "Tipo Movimiento", "Descripción", "Débito", "Crédito"],
    ["19/01/2026", "397044", "DEBITO OPERACION", "", "-8,225.14", ""],
  ]);
  const { movimientos } = parsearExcelBancario(buffer);
  assert.equal(movimientos.length, 1);
  assert.equal(movimientos[0].montoBancario, -8225.14);
});

test("conserva movimientos bancarios válidos aunque no tengan referencia", () => {
  const buffer = crearBuffer([
    ["Moneda"],
    ["UYU"],
    ["Fecha", "Referencia", "Tipo Movimiento", "Descripción", "Débito", "Crédito"],
    [
      "20/02/2026",
      "",
      "EXTORNO COMPRA CON VISA DEBITO",
      "",
      "",
      "232,11",
    ],
    [
      "21/07/2026",
      "",
      "COMPRA CON TARJETA DEBITO",
      "",
      "-9.830,88",
      "",
    ],
  ]);

  const { movimientos } = parsearExcelBancario(buffer);

  assert.equal(movimientos.length, 2);
  assert.equal(movimientos[0].referenciaBanco, "");
  assert.equal(movimientos[0].montoBancario, 232.11);
  assert.equal(movimientos[1].referenciaBanco, "");
  assert.equal(movimientos[1].montoBancario, -9830.88);
});

test("parsea el formato bancario simple con Fecha, Detalle y Monto", () => {
  const buffer = crearBuffer([
    ["fecha", "detalle", "monto"],
    [46208, "El cardinal", 480.032],
    [46209, "Alma Natural", 1000.51],
    [46210, "Reintegro", -25.75],
    ["", "Fila sin fecha", 200],
  ]);

  const { nombreHoja, movimientos } = parsearExcelBancario(buffer);

  assert.equal(nombreHoja, "Datos");
  assert.equal(movimientos.length, 3);
  assert.equal(movimientos[0].fechaBanco.toISOString().slice(0, 10), "2026-07-05");
  assert.equal(movimientos[0].detalleOriginal, "El cardinal");
  assert.equal(movimientos[0].montoBancario, 0);
  assert.equal(movimientos[0].montoReal, 480.03);
  assert.equal(movimientos[0].referenciaBanco, "");
  assert.equal(movimientos[1].montoReal, 1000.51);
  assert.equal(movimientos[2].montoReal, -25.75);
});

test("rechaza un Excel bancario sin formato oficial ni columnas simples", () => {
  const buffer = crearBuffer([
    ["Día", "Concepto", "Importe"],
    ["05/07/2026", "Compra", 100],
  ]);

  assert.throws(
    () => parsearExcelBancario(buffer),
    /Fecha, Detalle y Monto/,
  );
});

test("parsea compras y pagos de tarjeta con signos normalizados", () => {
  const buffer = crearBuffer([
    ["Cuenta", "Fecha de Cierre", "Vencimiento", "Período Consultado"],
    ["770060620870", "28/1/2026", "13/02/2026", "Enero 2026"],
    ["Fecha", "Tarjeta", "Detalle", "Importe $", "Importe U$S"],
    ["26/12/2025", "XXXXX-5409", "Merpago Disershop", "1.278,80", "0,00"],
    ["26/12/2025", "XXXXX-5409", "Merpago Disershop", "1.278,80", "0,00"],
    ["03/01/2026", "XXXXX-5409", "Pago Supernet", "-804,16", "0,00"],
  ]);
  const { resumen, movimientos } = parsearExcelTarjeta(buffer);
  assert.equal(resumen.periodo, "Enero 2026");
  assert.equal(movimientos[0].tipo, "compra");
  assert.equal(movimientos[0].montoBancario, -1278.8);
  assert.notEqual(movimientos[0].sourceHash, movimientos[1].sourceHash);
  assert.equal(movimientos[2].tipo, "pago");
  assert.equal(movimientos[2].montoBancario, 804.16);
});

test("el formato personal genera huellas estables y distingue filas repetidas", () => {
  const buffer = crearBuffer([
    ["Fecha", "Detalle", "Flujo Bancario", "% Economia Real", "Categoria"],
    ["10/01/2026", "Compra repetida", "-100,00", "-100,00", "Alimentos"],
    ["10/01/2026", "Compra repetida", "-100,00", "-100,00", "Alimentos"],
  ]);
  const primeraLectura = parsearExcelPersonal(buffer).movimientos;
  const segundaLectura = parsearExcelPersonal(buffer).movimientos;

  assert.equal(primeraLectura.length, 2);
  assert.notEqual(primeraLectura[0].sourceHash, primeraLectura[1].sourceHash);
  assert.equal(primeraLectura[0].sourceHash, segundaLectura[0].sourceHash);
});

test("parsea una tabla personal plana sin encabezados y admite fechas serializadas", () => {
  const buffer = crearBuffer([
    ["30/01/2026", "Compra bancaria", -1028, -1028, "Juegos/Ocio", 1],
    [46024, "Compra con fecha serializada", -196.6, -137.62, "Supermercado", 2],
    [46025, "Fila sin flujo bancario", "", -399.5, "Muebles", ""],
  ]);

  const { movimientos } = parsearExcelPersonal(buffer);

  assert.equal(movimientos.length, 3);
  assert.equal(movimientos[0].fecha.toISOString().slice(0, 10), "2026-01-30");
  assert.equal(movimientos[0].montoBancario, -1028);
  assert.equal(movimientos[0].porcentaje, 100);
  assert.equal(movimientos[1].fecha.toISOString().slice(0, 10), "2026-01-02");
  assert.equal(movimientos[1].nombreSubcategoria, "Supermercado");
  assert.equal(movimientos[1].porcentaje, 70);
  assert.equal(movimientos[2].montoBancario, 0);
  assert.equal(movimientos[2].montoReal, -399.5);
  assert.equal(movimientos[2].incluirMontoReal, true);
});

test("lista las hojas y permite elegir cuál importar del Excel personal", () => {
  const encabezados = [
    "Fecha",
    "Detalle",
    "Flujo Bancario",
    "% Economia Real",
    "Categoria",
  ];
  const buffer = crearBufferConHojas({
    Enero: [
      encabezados,
      ["10/01/2026", "Compra enero", -100, -100, "Alimentos"],
    ],
    Febrero: [
      encabezados,
      ["10/02/2026", "Compra febrero", -200, -100, "Salidas"],
    ],
    Marzo: [
      encabezados,
      ["10/03/2026", "Compra marzo", -300, -300, "Transporte"],
    ],
  });

  assert.deepEqual(listarHojasExcel(buffer), ["Enero", "Febrero", "Marzo"]);

  const resultado = parsearExcelPersonal(buffer, "Febrero");
  assert.equal(resultado.nombreHoja, "Febrero");
  assert.equal(resultado.movimientos.length, 1);
  assert.equal(resultado.movimientos[0].detalle, "Compra febrero");
  assert.equal(resultado.movimientos[0].porcentaje, 50);
  assert.throws(
    () => parsearExcelPersonal(buffer, "Abril"),
    /La hoja seleccionada no existe/,
  );
});
