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
  moneda: "UYU",
  tipo: "compra",
  incluirMontoReal: true,
};

test("la importacion de tarjeta admite monto real directo sin monto bancario", () => {
  const { error, value } = importarResumenTarjetaSchema.validate({
    resumen: resumenValido,
    movimientos: [{
      ...movimientoBase,
      montoBancario: 0,
      montoReal: -100,
      porcentaje: 0,
    }],
  });

  assert.equal(error, undefined);
  assert.equal(value.movimientos[0].montoBancario, 0);
  assert.equal(value.movimientos[0].montoReal, -100);
});

test("la importacion de tarjeta rechaza un movimiento sin monto bancario ni real", () => {
  const { error } = importarResumenTarjetaSchema.validate({
    resumen: resumenValido,
    movimientos: [{
      ...movimientoBase,
      montoBancario: 0,
      montoReal: 0,
      porcentaje: 0,
    }],
  });

  assert.match(error?.message || "", /monto bancario o monto real/);
});
