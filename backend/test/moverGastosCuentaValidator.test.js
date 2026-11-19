import test from "node:test";
import assert from "node:assert/strict";
import { moverGastosCuentaSchema } from "../v1/0-validators/gasto.validators.js";

const idOrigen = "6a499947caf60cb12acaa7f2";
const idDestino = "6a49993fcaf60cb12acaa7f1";

test("valida un traslado masivo entre cuentas diferentes", () => {
  const { error, value } = moverGastosCuentaSchema.validate({
    gastoIds: ["6afdafb07ef29752e784fb7a", "6afdafb57ef29752e784fb7b"],
    cuentaOrigenId: idOrigen,
    cuentaDestinoId: idDestino,
  });

  assert.equal(error, undefined);
  assert.equal(value.gastoIds.length, 2);
});

test("rechaza destino igual al origen y movimientos repetidos", () => {
  const mismaCuenta = moverGastosCuentaSchema.validate({
    gastoIds: ["6afdafb07ef29752e784fb7a"],
    cuentaOrigenId: idOrigen,
    cuentaDestinoId: idOrigen,
  });
  const repetidos = moverGastosCuentaSchema.validate({
    gastoIds: ["6afdafb07ef29752e784fb7a", "6afdafb07ef29752e784fb7a"],
    cuentaOrigenId: idOrigen,
    cuentaDestinoId: idDestino,
  });

  assert.ok(mismaCuenta.error);
  assert.ok(repetidos.error);
});
