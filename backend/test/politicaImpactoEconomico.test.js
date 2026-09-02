import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarPoliticaImpactoEconomico,
  esSubcategoriaTransferencia,
} from "../v1/utils/politicaImpactoEconomico.js";

test("reconoce las subcategorías de transferencia por su prefijo", () => {
  assert.equal(esSubcategoriaTransferencia("Transf. CA-USD"), true);
  assert.equal(esSubcategoriaTransferencia("TRANSF CC-UYU"), true);
  assert.equal(esSubcategoriaTransferencia("Supermercado"), false);
});

test("una transferencia queda neutral para el resultado económico", () => {
  const gasto = aplicarPoliticaImpactoEconomico({
    montoBancario: -4000,
    montoReal: -4000,
    porcentaje: 100,
    incluirMontoReal: true,
  }, "Transf. CA-USD");

  assert.equal(gasto.incluirMontoReal, false);
  assert.equal(gasto.porcentaje, 0);
  assert.equal(gasto.montoReal, 0);
});

test("un ingreso con porcentaje cero se incluye al cien por ciento", () => {
  const gasto = aplicarPoliticaImpactoEconomico({
    montoBancario: 4000,
    montoReal: 0,
    porcentaje: 0,
    incluirMontoReal: true,
  }, "Ingresos");

  assert.equal(gasto.incluirMontoReal, true);
  assert.equal(gasto.porcentaje, 100);
  assert.equal(gasto.montoReal, 4000);
});

test("un gasto real directo respeta la decision de excluirlo", () => {
  const gasto = aplicarPoliticaImpactoEconomico({
    montoBancario: 0,
    montoReal: -450,
    porcentaje: 0,
    incluirMontoReal: false,
  }, "Supermercado");

  assert.equal(gasto.incluirMontoReal, false);
  assert.equal(gasto.montoReal, -450);
});

test("un gasto bancario respeta la decision de excluirlo", () => {
  const gasto = aplicarPoliticaImpactoEconomico({
    montoBancario: -1000,
    montoReal: -1000,
    porcentaje: 70,
    incluirMontoReal: false,
  }, "Supermercado");

  assert.equal(gasto.incluirMontoReal, false);
  assert.equal(gasto.porcentaje, 70);
  assert.equal(gasto.montoReal, 0);
});

test("conserva un porcentaje personal cuando el usuario incluye el gasto", () => {
  const gasto = aplicarPoliticaImpactoEconomico({
    montoBancario: -1000,
    montoReal: -1000,
    porcentaje: 70,
    incluirMontoReal: true,
  }, "Supermercado");

  assert.equal(gasto.incluirMontoReal, true);
  assert.equal(gasto.porcentaje, 70);
  assert.equal(gasto.montoReal, -700);
});
