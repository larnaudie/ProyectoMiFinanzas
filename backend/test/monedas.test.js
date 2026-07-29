import assert from "node:assert/strict";
import test from "node:test";
import cuentasSchema from "../v1/0-validators/cuenta.validators.js";
import {
  actualizarGastoSchema,
  gastosSchema,
} from "../v1/0-validators/gasto.validators.js";
import {
  MONEDAS_SOPORTADAS,
  normalizarListaMonedas,
  normalizarMoneda,
  obtenerMonedaMovimiento,
  obtenerMonedasCuenta,
} from "../v1/utils/monedas.js";

test("incluye Unidades Indexadas entre las monedas soportadas", () => {
  assert.deepEqual(MONEDAS_SOPORTADAS, ["UYU", "USD", "UI"]);
  assert.equal(normalizarMoneda("UI"), "UI");
  assert.equal(normalizarMoneda("UYI"), "UI");
  assert.equal(normalizarMoneda("Unidades Indexadas"), "UI");
});

test("una tarjeta admite varias monedas y las existentes conservan UYU y USD", () => {
  const { error, value } = cuentasSchema.validate({
    nombreCuenta: "Tarjeta multimoneda",
    tipoCuenta: "credito",
    moneda: "UYU",
    monedas: ["USD", "UI"],
  });

  assert.equal(error, undefined);
  assert.deepEqual(value.monedas, ["USD", "UI"]);
  assert.deepEqual(
    obtenerMonedasCuenta({ tipoCuenta: "credito", monedas: [] }),
    ["UYU", "USD"],
  );
  assert.deepEqual(
    normalizarListaMonedas(["UI", "USD", "USD"]),
    ["USD", "UI"],
  );
});

test("permite crear una cuenta en UI", () => {
  const { error, value } = cuentasSchema.validate({
    nombreCuenta: "Ahorro en UI",
    tipoCuenta: "debito",
    moneda: "UI",
  });

  assert.equal(error, undefined);
  assert.equal(value.moneda, "UI");
});

test("permite crear y actualizar gastos en UI", () => {
  const creacion = gastosSchema.validate({
    detalle: "Movimiento en UI",
    cuentaId: "64a9993bcaf60cb12acaa7f0",
    montoBancario: 125,
    moneda: "UI",
  });
  const actualizacion = actualizarGastoSchema.validate({ moneda: "UI" });

  assert.equal(creacion.error, undefined);
  assert.equal(creacion.value.moneda, "UI");
  assert.equal(actualizacion.error, undefined);
});

test("la moneda de una cuenta de débito prevalece sobre la moneda histórica del gasto", () => {
  assert.equal(
    obtenerMonedaMovimiento(
      { tipoCuenta: "debito", moneda: "USD" },
      "UYU",
    ),
    "USD",
  );
  assert.equal(
    obtenerMonedaMovimiento(
      { tipoCuenta: "credito", monedas: ["UYU", "USD"] },
      "USD",
    ),
    "USD",
  );
});
