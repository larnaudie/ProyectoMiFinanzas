import assert from "node:assert/strict";
import test from "node:test";
import {
  correspondeAConfirmacionDeDebito,
  esDebitoProvisional,
} from "../v1/utils/movimientosBancarios.js";

const provisional = {
  fechaBanco: "2026-08-17",
  referenciaBanco: "2952",
  detalleOriginal:
    "DEBITO A CONFIRMAR BANRED COMPRA 917155 - MONTEVIDEO/MACROMERCADO VIS3 -",
  montoBancario: -945.88,
};

test("reconoce un débito bancario provisional", () => {
  assert.equal(esDebitoProvisional(provisional), true);
});

test("vincula la confirmación por fecha, importe y código de autorización", () => {
  assert.equal(correspondeAConfirmacionDeDebito({
    provisional,
    definitivo: {
      fechaBanco: "2026-08-17",
      referenciaBanco: "622723917155",
      detalleOriginal: "COMPRA CON TARJETA DEBITO MACROMERCADO, MONTEVIDEO",
      montoBancario: -945.88,
    },
  }), true);
});

test("no reemplaza otro consumo con el mismo importe", () => {
  assert.equal(correspondeAConfirmacionDeDebito({
    provisional,
    definitivo: {
      fechaBanco: "2026-08-17",
      referenciaBanco: "622723000001",
      detalleOriginal: "COMPRA CON TARJETA DEBITO OTRO COMERCIO",
      montoBancario: -945.88,
    },
  }), false);
});
