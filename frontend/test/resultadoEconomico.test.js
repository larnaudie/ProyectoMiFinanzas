import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularResultadoEconomicoGasto,
  calcularResultadoTarjetaGasto,
  resumirGastoReal,
} from "../src/utils/resultadoEconomico.js";

test("el impacto económico individual respeta si cuenta en Gasto Real", () => {
  assert.equal(calcularResultadoEconomicoGasto({
    montoReal: -700,
    incluirMontoReal: true,
  }), -700);
  assert.equal(calcularResultadoEconomicoGasto({
    montoReal: -700,
    incluirMontoReal: false,
  }), 0);
});

test("el resumen de Gasto Real incluye solamente egresos marcados", () => {
  const resumen = resumirGastoReal([
    { montoReal: -1000, incluirMontoReal: true },
    { montoReal: -250.55, incluirMontoReal: true },
    { montoReal: -800, incluirMontoReal: false },
    { montoReal: 500, incluirMontoReal: true },
  ]);

  assert.deepEqual(resumen, { gastoReal: 1250.55 });
});

test("la tarjeta no genera un resultado de ahorro propio", () => {
  assert.equal(calcularResultadoTarjetaGasto(), 0);
});
