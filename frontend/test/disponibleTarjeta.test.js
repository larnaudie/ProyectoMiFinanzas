import assert from "node:assert/strict";
import test from "node:test";
import { calcularDisponibleOperativoTarjeta } from "../src/utils/disponibleTarjeta.js";

test("concilia limite, saldo a favor, cuotas futuras y saldo USD", () => {
  const resultado = calcularDisponibleOperativoTarjeta(
    {
      totales: {
        UYU: {
          limite: 93000,
          saldoFinal: -19026.92,
          cuotasFuturas: 17619.28,
        },
        USD: {
          limite: 0,
          saldoFinal: -2.08,
          cuotasFuturas: 0,
        },
      },
    },
    { usd: { uyuPorDolar: 40.24 } },
  );

  assert.equal(resultado.moneda, "UYU");
  assert.equal(resultado.ajustesMoneda[0].ajuste, 83.7);
  assert.equal(resultado.disponible, 94491.34);
});

test("no mezcla tarjetas con limites independientes por moneda", () => {
  const resultado = calcularDisponibleOperativoTarjeta({
    totales: {
      UYU: { limite: 93000 },
      USD: { limite: 1000 },
    },
  });

  assert.equal(resultado, null);
});
