import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx";
import {
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

  assert.equal(movimientos.length, 2);
  assert.equal(movimientos[0].fecha.toISOString().slice(0, 10), "2026-01-30");
  assert.equal(movimientos[0].montoBancario, -1028);
  assert.equal(movimientos[0].porcentaje, 100);
  assert.equal(movimientos[1].fecha.toISOString().slice(0, 10), "2026-01-02");
  assert.equal(movimientos[1].nombreSubcategoria, "Supermercado");
  assert.equal(movimientos[1].porcentaje, 70);
});
