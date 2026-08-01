import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarPoliticaCuentaCredito,
  esCuentaCredito,
} from "../v1/utils/politicaCuentaCredito.js";

test("identifica una cuenta de credito", () => {
  assert.equal(esCuentaCredito({ tipoCuenta: "credito" }), true);
  assert.equal(esCuentaCredito({ tipoCuenta: "debito" }), false);
});

test("una cuenta de credito conserva solo el monto bancario", () => {
  const gasto = aplicarPoliticaCuentaCredito(
    {
      montoBancario: -1000,
      montoReal: -700,
      porcentaje: 70,
      incluirMontoReal: true,
    },
    { tipoCuenta: "credito" },
  );

  assert.equal(gasto.montoBancario, -1000);
  assert.equal(gasto.montoReal, 0);
  assert.equal(gasto.porcentaje, 0);
  assert.equal(gasto.incluirMontoReal, false);
});

test("una cuenta de debito no es modificada por la politica de credito", () => {
  const gasto = aplicarPoliticaCuentaCredito(
    {
      montoBancario: -1000,
      montoReal: -700,
      porcentaje: 70,
      incluirMontoReal: true,
    },
    { tipoCuenta: "debito" },
  );

  assert.equal(gasto.montoReal, -700);
  assert.equal(gasto.porcentaje, 70);
  assert.equal(gasto.incluirMontoReal, true);
});
