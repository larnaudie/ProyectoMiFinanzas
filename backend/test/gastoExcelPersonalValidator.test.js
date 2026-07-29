import assert from "node:assert/strict";
import test from "node:test";
import { crearGastoExcelPersonalSchema } from "../v1/0-validators/gasto.validators.js";

const movimientoValido = {
  sourceHash: "a".repeat(64),
  detalle: "Compra de prueba",
  fecha: "2026-01-30",
  montoBancario: -1200,
  porcentaje: 75,
  incluirMontoReal: true,
  categoriaId: "",
  subcategoriaId: "64a9993bcaf60cb12acaa7f0",
};

test("valida un movimiento personal confirmado por el usuario", () => {
  const { error, value } = crearGastoExcelPersonalSchema.validate(movimientoValido);

  assert.equal(error, undefined);
  assert.equal(value.sourceHash, movimientoValido.sourceHash);
  assert.equal(value.montoBancario, -1200);
});

test("rechaza crear movimientos personales sin huella o subcategoria", () => {
  const sinHuella = crearGastoExcelPersonalSchema.validate({
    ...movimientoValido,
    sourceHash: "",
  });
  const sinSubcategoria = crearGastoExcelPersonalSchema.validate({
    ...movimientoValido,
    subcategoriaId: "",
  });

  assert.ok(sinHuella.error);
  assert.ok(sinSubcategoria.error);
});

test("acepta un gasto real sin monto bancario", () => {
  const { error, value } = crearGastoExcelPersonalSchema.validate({
    ...movimientoValido,
    montoBancario: 0,
    montoReal: -850,
    porcentaje: 0,
  });

  assert.equal(error, undefined);
  assert.equal(value.montoReal, -850);
});

test("rechaza un gasto sin monto bancario ni monto real", () => {
  const { error } = crearGastoExcelPersonalSchema.validate({
    ...movimientoValido,
    montoBancario: 0,
    montoReal: 0,
  });

  assert.ok(error);
  assert.match(error.message, /monto bancario o monto real/i);
});
