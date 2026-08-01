import test from "node:test";
import assert from "node:assert/strict";

import { importarResumenTarjetaSchema } from "../v1/0-validators/tarjeta.validators.js";

const resumenValido = {
  cierre: "2026-07-28",
};

const movimientoBase = {
  sourceHash: "a".repeat(64),
  fecha: "2026-07-02",
  detalle: "Gasto contemplado",
  montoEstadoCuenta: -100,
  montoBancario: -100,
  moneda: "UYU",
  tipo: "compra",
  categoriaId: "b".repeat(24),
  subcategoriaId: "c".repeat(24),
  montoReal: 0,
  porcentaje: 0,
  incluirMontoReal: false,
};

test("la importacion de tarjeta admite solo impacto bancario", () => {
  const { error, value } = importarResumenTarjetaSchema.validate({
    resumen: resumenValido,
    movimientos: [movimientoBase],
  });

  assert.equal(error, undefined);
  assert.equal(value.movimientos[0].montoBancario, -100);
  assert.equal(value.movimientos[0].montoReal, 0);
  assert.equal(value.movimientos[0].porcentaje, 0);
  assert.equal(value.movimientos[0].incluirMontoReal, false);
  assert.equal(value.movimientos[0].categoriaId, "b".repeat(24));
  assert.equal(value.movimientos[0].subcategoriaId, "c".repeat(24));
});

test("la importacion de tarjeta rechaza un movimiento sin monto bancario", () => {
  const { error } = importarResumenTarjetaSchema.validate({
    resumen: resumenValido,
    movimientos: [{
      ...movimientoBase,
      montoBancario: 0,
      montoReal: -100,
      incluirMontoReal: true,
    }],
  });

  assert.match(error?.message || "", /montoBancario/);
});

test("la importacion de tarjeta rechaza impacto economico directo", () => {
  const { error } = importarResumenTarjetaSchema.validate({
    resumen: resumenValido,
    movimientos: [{
      ...movimientoBase,
      montoReal: -100,
    }],
  });

  assert.match(error?.message || "", /montoReal/);
});
