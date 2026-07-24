import test from "node:test";
import assert from "node:assert/strict";
import { normalizarMontoContraparte } from "../v1/utils/vinculosGasto.js";

test("una salida genera una contrapartida positiva", () => {
  assert.equal(normalizarMontoContraparte(-2000, -2000), 2000);
});

test("un ingreso genera una contrapartida negativa", () => {
  assert.equal(normalizarMontoContraparte(500, 500), -500);
});

test("permite un importe distinto para transferencias entre monedas", () => {
  assert.equal(normalizarMontoContraparte(-500, 21000), 21000);
});
