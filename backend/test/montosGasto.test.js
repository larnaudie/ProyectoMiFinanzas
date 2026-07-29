import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularMontoRealGasto,
  gastoTieneMontosCompletos,
} from "../v1/utils/montosGasto.js";

test("mantiene el cálculo porcentual cuando existe monto bancario", () => {
  const gasto = {
    montoBancario: -1000,
    montoReal: -9999,
    porcentaje: 70,
    incluirMontoReal: true,
  };

  assert.equal(calcularMontoRealGasto(gasto), -700);
  assert.equal(gastoTieneMontosCompletos(gasto), true);
});

test("conserva un monto real directo cuando no existe monto bancario", () => {
  const gasto = {
    montoBancario: 0,
    montoReal: -450,
    porcentaje: null,
    incluirMontoReal: false,
  };

  assert.equal(calcularMontoRealGasto(gasto), -450);
  assert.equal(gastoTieneMontosCompletos(gasto), true);
});

test("considera incompleto un gasto sin ningún monto", () => {
  const gasto = {
    montoBancario: null,
    montoReal: 0,
    porcentaje: 100,
    incluirMontoReal: true,
  };

  assert.equal(calcularMontoRealGasto(gasto), 0);
  assert.equal(gastoTieneMontosCompletos(gasto), false);
});
