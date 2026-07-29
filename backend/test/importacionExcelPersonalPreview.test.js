import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx";
import Cuenta from "../v1/0.1-models/cuenta.model.js";
import Gasto from "../v1/0.1-models/gasto.model.js";
import Subcategoria from "../v1/0.1-models/subcategoria.model.js";
import { importarExcelPersonalService } from "../v1/3-services/importacionExcel.service.js";

const crearExcelPersonal = () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Fecha", "Detalle", "Flujo Bancario", "% Economia Real", "Categoria"],
    ["30/01/2026", "Compra de prueba", -1200, -900, "Supermercado"],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Enero");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

test("previsualizar un Excel personal no crea gastos", async (contexto) => {
  contexto.mock.method(Cuenta, "findOne", () => ({
    select: async () => ({ _id: "64a9993bcaf60cb12acaa7f0" }),
  }));
  contexto.mock.method(Gasto, "find", () => ({
    select: async () => [],
  }));
  contexto.mock.method(Subcategoria, "find", () => ({
    select: async () => [],
  }));
  const crearGasto = contexto.mock.method(Gasto, "create", async () => {
    throw new Error("La previsualizacion no debe escribir gastos");
  });

  const resultado = await importarExcelPersonalService({
    usuarioId: "64a998189cc1e1c3afd3b77f",
    cuentaId: "64a9993bcaf60cb12acaa7f0",
    file: { buffer: crearExcelPersonal() },
    nombreHoja: "Enero",
  });

  assert.equal(resultado.totalLeidos, 1);
  assert.equal(resultado.movimientos.length, 1);
  assert.equal(resultado.movimientos[0].estado, "previsualizado");
  assert.equal(resultado.movimientos[0].gastoId, null);
  assert.equal(crearGasto.mock.callCount(), 0);
});
