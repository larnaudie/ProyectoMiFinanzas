import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularResumenDeuda,
  convertirCobroDeuda,
} from "../v1/utils/deudasCobrar.js";
import { actualizarEstadoDeudaSchema } from "../v1/0-validators/deudaCobrar.validators.js";

test("aplica un cobro sin convertir cuando usa la moneda de la deuda", () => {
  assert.equal(convertirCobroDeuda({
    monto: 1000,
    monedaOrigen: "USD",
    monedaDestino: "USD",
  }), 1000);
});

test("convierte $ 40.000 a US$ 1.000 usando la cotización BCU guardada", () => {
  assert.equal(convertirCobroDeuda({
    monto: 40000,
    monedaOrigen: "UYU",
    monedaDestino: "USD",
    cotizacion: { uyuPorDolar: 40 },
  }), 1000);
});

test("convierte cobros entre USD, UYU y UI por su valor común en pesos", () => {
  assert.equal(convertirCobroDeuda({
    monto: 1000,
    monedaOrigen: "USD",
    monedaDestino: "UYU",
    cotizacion: { uyuPorDolar: 40 },
  }), 40000);
  assert.equal(convertirCobroDeuda({
    monto: 1000,
    monedaOrigen: "UYU",
    monedaDestino: "UI",
    cotizacion: { uyuPorUi: 6.25 },
  }), 160);
});

test("calcula pendiente, avance y excedente de una deuda", () => {
  const parcial = calcularResumenDeuda({
    capitalOriginal: 5000,
    cobros: [{ montoAplicado: 1000 }, { montoAplicado: 2000 }],
  });
  assert.deepEqual(parcial, {
    capital: 5000,
    cobrado: 3000,
    pendiente: 2000,
    excedente: 0,
    porcentaje: 60,
    completa: false,
  });

  const completa = calcularResumenDeuda({
    capitalOriginal: 5000,
    cobros: [{ montoAplicado: 5500 }],
  });
  assert.equal(completa.porcentaje, 100);
  assert.equal(completa.pendiente, 0);
  assert.equal(completa.excedente, 500);
  assert.equal(completa.completa, true);
});

test("rechaza una conversión sin cotización suficiente", () => {
  assert.throws(() => convertirCobroDeuda({
    monto: 40000,
    monedaOrigen: "UYU",
    monedaDestino: "USD",
  }), /cotización BCU válida/);
});

test("acepta el cierre manual explícito de una deuda", () => {
  const { value, error } = actualizarEstadoDeudaSchema.validate({
    estado: "saldada",
    forzar: true,
  });
  assert.equal(error, undefined);
  assert.equal(value.forzar, true);

  const reapertura = actualizarEstadoDeudaSchema.validate({ estado: "activa" });
  assert.equal(reapertura.error, undefined);
  assert.equal(reapertura.value.forzar, false);
});
