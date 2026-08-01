import assert from "node:assert/strict";
import test from "node:test";
import {
  construirPlanesCuotasResumen,
  extraerPlanCuotasTarjeta,
  sumarCuotasFuturasPorMoneda,
} from "../v1/utils/planesCuotasTarjeta.js";

test("detecta una cuota Santander con numeracion separada por espacios", () => {
  const plan = extraerPlanCuotasTarjeta({
    detalle: "Dlo Tiendamia U Cuota 02 10",
    fecha: "2026-06-11",
    moneda: "UYU",
    monto: 1365.91,
  });

  assert.equal(plan.detalleBase, "Dlo Tiendamia U");
  assert.equal(plan.cuotaActual, 2);
  assert.equal(plan.cuotasTotales, 10);
  assert.equal(plan.cuotasRestantes, 8);
  assert.equal(plan.montoFuturo, 10927.28);
  assert.equal(plan.estado, "activo");
});

test("una ultima cuota deja el plan finalizado y sin compromiso futuro", () => {
  const plan = extraerPlanCuotasTarjeta({
    detalle: "Compra Cuota 06/06",
    fecha: "2026-06-12",
    moneda: "UYU",
    monto: -1673,
  });

  assert.equal(plan.cuotasRestantes, 0);
  assert.equal(plan.montoFuturo, 0);
  assert.equal(plan.estado, "finalizado");
});

test("construye los compromisos futuros del resumen", () => {
  const planes = construirPlanesCuotasResumen([
    {
      _id: "1",
      detalle: "Dlo Tiendamia U Cuota 02 10",
      fecha: "2026-06-11",
      moneda: "UYU",
      montoOriginalTarjeta: 1365.91,
      tipoMovimiento: "cuota",
    },
    {
      _id: "2",
      detalle: "Macromercado Cuota 02 06",
      fecha: "2026-06-12",
      moneda: "UYU",
      montoOriginalTarjeta: 1673,
      tipoMovimiento: "cuota",
    },
  ]);

  assert.equal(planes.length, 2);
  assert.deepEqual(sumarCuotasFuturasPorMoneda(planes), {
    UYU: 17619.28,
  });
});
