import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx";
import Cuenta from "../v1/0.1-models/cuenta.model.js";
import Gasto from "../v1/0.1-models/gasto.model.js";
import MovimientoImportado from "../v1/0.1-models/movimientoImportado.model.js";
import SaldoCuenta from "../v1/0.1-models/saldoCuenta.model.js";
import { importarExcelService } from "../v1/3-services/importacionExcel.service.js";

const crearBuffer = (filas) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(filas), "Datos");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

test("el importador bancario agrupa lecturas y escrituras sin perder duplicados", async (t) => {
  const originales = {
    buscarCuenta: Cuenta.findOne,
    buscarGastos: Gasto.find,
    buscarMovimientos: MovimientoImportado.find,
    escribirMovimientos: MovimientoImportado.bulkWrite,
    escribirSaldos: SaldoCuenta.bulkWrite,
  };
  t.after(() => {
    Cuenta.findOne = originales.buscarCuenta;
    Gasto.find = originales.buscarGastos;
    MovimientoImportado.find = originales.buscarMovimientos;
    MovimientoImportado.bulkWrite = originales.escribirMovimientos;
    SaldoCuenta.bulkWrite = originales.escribirSaldos;
  });

  const llamadas = {
    buscarGastos: 0,
    buscarMovimientos: 0,
    escribirMovimientos: 0,
    operacionesMovimiento: 0,
  };
  Cuenta.findOne = () => ({
    select: async () => ({
      _id: "64b000000000000000000001",
      moneda: "UYU",
      tipoCuenta: "debito",
      monedas: [],
    }),
  });
  MovimientoImportado.find = async () => {
    llamadas.buscarMovimientos += 1;
    return [];
  };
  MovimientoImportado.bulkWrite = async (operaciones) => {
    llamadas.escribirMovimientos += 1;
    llamadas.operacionesMovimiento = operaciones.length;
    return { insertedCount: operaciones.length };
  };
  SaldoCuenta.bulkWrite = async () => ({ matchedCount: 0, upsertedCount: 0 });
  Gasto.find = () => {
    llamadas.buscarGastos += 1;
    return {
      select() {
        return this;
      },
      async lean() {
        return [];
      },
    };
  };

  const buffer = crearBuffer([
    ["Moneda"],
    ["UYU"],
    ["Fecha", "Referencia", "Tipo Movimiento", "Descripción", "Débito", "Crédito"],
    ["01/08/2026", "A-1", "COMPRA", "", -100, ""],
    ["01/08/2026", "A-1", "COMPRA", "", -100, ""],
    ["02/08/2026", "A-2", "COMPRA", "", -200, ""],
  ]);
  const resultado = await importarExcelService({
    usuarioId: "64a000000000000000000001",
    cuentaId: "64b000000000000000000001",
    file: { buffer, originalname: "agosto.xlsx" },
  });

  assert.equal(resultado.totalLeidos, 3);
  assert.deepEqual(
    resultado.movimientos.map(({ estado }) => estado),
    ["nuevo", "duplicado_importacion", "nuevo"],
  );
  assert.equal(llamadas.buscarMovimientos, 1);
  assert.equal(llamadas.buscarGastos, 1);
  assert.equal(llamadas.escribirMovimientos, 1);
  assert.equal(llamadas.operacionesMovimiento, 2);
});

test("reemplaza un debito a confirmar y conserva el gasto vinculado", async (t) => {
  const originales = {
    buscarCuenta: Cuenta.findOne,
    buscarGastos: Gasto.find,
    escribirGastos: Gasto.bulkWrite,
    buscarMovimientos: MovimientoImportado.find,
    escribirMovimientos: MovimientoImportado.bulkWrite,
    escribirSaldos: SaldoCuenta.bulkWrite,
  };
  t.after(() => {
    Cuenta.findOne = originales.buscarCuenta;
    Gasto.find = originales.buscarGastos;
    Gasto.bulkWrite = originales.escribirGastos;
    MovimientoImportado.find = originales.buscarMovimientos;
    MovimientoImportado.bulkWrite = originales.escribirMovimientos;
    SaldoCuenta.bulkWrite = originales.escribirSaldos;
  });

  const usuarioId = "64a000000000000000000001";
  const cuentaId = "64b000000000000000000001";
  const gastoId = "64c000000000000000000001";
  const movimientoId = "64d000000000000000000001";
  const provisional = {
    _id: movimientoId,
    usuarioId,
    cuentaId,
    gastoId,
    referenciaBanco: "2952",
    fechaBanco: new Date("2026-08-17T12:00:00.000Z"),
    detalleOriginal:
      "DEBITO A CONFIRMAR BANRED COMPRA 917155 - MONTEVIDEO/MACROMERCADO VIS3 -",
    detalleNormalizado:
      "debito a confirmar banred compra 917155 montevideo macromercado vis3",
    montoBancario: -945.88,
    montoReal: -945.88,
    saldoBanco: null,
    tipoMonto: "bancario",
    moneda: "UYU",
    hashBanco: "hash-provisional",
    estadoImportacion: "vinculado",
    archivoNombre: "agosto-parcial.xlsx",
    isNew: false,
  };
  let operacionesMovimiento = [];
  let operacionesGasto = [];

  Cuenta.findOne = () => ({
    select: async () => ({
      _id: cuentaId,
      moneda: "UYU",
      tipoCuenta: "debito",
      monedas: [],
    }),
  });
  MovimientoImportado.find = async () => [provisional];
  MovimientoImportado.bulkWrite = async (operaciones) => {
    operacionesMovimiento = operaciones;
    return { matchedCount: operaciones.length };
  };
  SaldoCuenta.bulkWrite = async () => ({ matchedCount: 0, upsertedCount: 0 });
  Gasto.find = (filtro) => {
    if (filtro?._id) {
      return {
        async distinct() {
          return [gastoId];
        },
      };
    }
    return {
      select() {
        return this;
      },
      async lean() {
        return [];
      },
    };
  };
  Gasto.bulkWrite = async (operaciones) => {
    operacionesGasto = operaciones;
    return { matchedCount: operaciones.length };
  };

  const buffer = crearBuffer([
    ["Moneda"],
    ["UYU"],
    ["Fecha", "Referencia", "Tipo Movimiento", "Descripción", "Débito", "Crédito"],
    [
      "17/08/2026",
      "622723917155",
      "COMPRA CON TARJETA DEBITO MACROMERCADO, MONTEVIDEO",
      "",
      -945.88,
      "",
    ],
  ]);
  const resultado = await importarExcelService({
    usuarioId,
    cuentaId,
    file: { buffer, originalname: "agosto-definitivo.xlsx" },
  });

  assert.equal(resultado.totalReemplazados, 1);
  assert.equal(resultado.movimientos[0].estado, "reemplazado_provisional");
  assert.equal(resultado.movimientos[0].movimiento._id, movimientoId);
  assert.equal(resultado.movimientos[0].movimiento.gastoId, gastoId);
  assert.equal(resultado.movimientos[0].movimiento.estadoImportacion, "vinculado");
  assert.equal(operacionesMovimiento.length, 1);
  assert.equal(operacionesMovimiento[0].updateOne.filter._id, movimientoId);
  assert.equal(
    operacionesMovimiento[0].updateOne.update.$set.referenciaBanco,
    "622723917155",
  );
  assert.equal(operacionesGasto.length, 1);
  assert.equal(operacionesGasto[0].updateOne.filter._id, gastoId);
  assert.equal(
    operacionesGasto[0].updateOne.update.$set.detalle,
    "COMPRA CON TARJETA DEBITO MACROMERCADO, MONTEVIDEO",
  );
  assert.equal(operacionesGasto[0].updateOne.update.$set.montoBancario, -945.88);
});
