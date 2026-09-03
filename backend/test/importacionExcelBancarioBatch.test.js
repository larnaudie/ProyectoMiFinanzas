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
