import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularImpactoDeuda,
  calcularTotalesResumen,
  normalizarMontoBancarioTarjeta,
} from "../v1/utils/resumenTarjetaTotales.js";

test("los pagos son positivos y el resto de movimientos de tarjeta negativos", () => {
  assert.equal(normalizarMontoBancarioTarjeta(-500, "pago"), 500);
  assert.equal(normalizarMontoBancarioTarjeta(500, "compra"), -500);
  assert.equal(normalizarMontoBancarioTarjeta(500, "cuota"), -500);
  assert.equal(normalizarMontoBancarioTarjeta(500, "reintegro"), -500);
});

test("compras y cuotas aumentan la deuda; pagos y reintegros la reducen", () => {
  assert.equal(calcularImpactoDeuda({ montoOriginalTarjeta: 1200, tipoMovimiento: "compra" }), 1200);
  assert.equal(calcularImpactoDeuda({ montoOriginalTarjeta: -500, tipoMovimiento: "pago" }), -500);
  assert.equal(calcularImpactoDeuda({ montoBancario: -300, tipoMovimiento: "cuota" }), 300);
  assert.equal(calcularImpactoDeuda({ montoBancario: 100, tipoMovimiento: "reintegro" }), -100);
});

test("calcula límite, deuda y crédito disponible por moneda", () => {
  const totales = calcularTotalesResumen(
    { limiteCredito: { UYU: 93000, USD: 1000 } },
    [
      { moneda: "UYU", montoOriginalTarjeta: 10000, estado: "pendiente" },
      { moneda: "UYU", montoOriginalTarjeta: -2000, estado: "creado" },
      { moneda: "USD", montoOriginalTarjeta: 250, estado: "pendiente" },
    ],
  );

  assert.equal(totales.UYU.consumos, 10000);
  assert.equal(totales.UYU.pagosYReintegros, 2000);
  assert.equal(totales.UYU.deuda, 8000);
  assert.equal(totales.UYU.disponible, 85000);
  assert.equal(totales.UYU.cantidad, 2);
  assert.equal(totales.USD.deuda, 250);
  assert.equal(totales.USD.disponible, 750);
});

test("un saldo a favor aumenta el crédito disponible por encima del límite", () => {
  const totales = calcularTotalesResumen(
    {
      limiteCredito: { UYU: 93000, USD: null },
      saldoAnterior: { UYU: 17078.37, USD: null },
      saldoFinal: { UYU: -1092.1, USD: null },
    },
    [
      { moneda: "UYU", montoOriginalTarjeta: 10482.14, estado: "creado" },
      { moneda: "UYU", montoOriginalTarjeta: -28652.61, estado: "creado" },
    ],
  );

  assert.equal(totales.UYU.deuda, 0);
  assert.equal(totales.UYU.saldoAFavor, 1092.1);
  assert.equal(totales.UYU.disponible, 94092.1);
  assert.equal(totales.UYU.saldoMovimientos, -18170.47);
});

test("separa el monto bancario creado del pendiente por moneda", () => {
  const totales = calcularTotalesResumen(
    { limiteCredito: { UYU: 93000, USD: 1000 } },
    [
      {
        moneda: "UYU",
        montoOriginalTarjeta: 1000,
        montoBancario: -1000,
        estado: "creado",
      },
      {
        moneda: "UYU",
        montoOriginalTarjeta: -200,
        montoBancario: 200,
        tipoMovimiento: "pago",
        estado: "pendiente",
      },
      {
        moneda: "USD",
        montoOriginalTarjeta: 50,
        montoBancario: -50,
        estado: "creado",
      },
    ],
  );

  assert.equal(totales.UYU.montoBancarioTotal, -800);
  assert.equal(totales.UYU.montoBancarioCreado, -1000);
  assert.equal(totales.UYU.montoBancarioPendiente, 200);
  assert.equal(totales.USD.montoBancarioTotal, -50);
  assert.equal(totales.USD.montoBancarioCreado, -50);
  assert.equal(totales.USD.montoBancarioPendiente, 0);
});
