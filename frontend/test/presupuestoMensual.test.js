import assert from "node:assert/strict";
import test from "node:test";
import {
  esCuentaFuentePresupuesto,
  resumirPresupuestoMensualPorTransferencias,
} from "../src/utils/presupuestoMensual.js";

const cuentas = [
  {
    _id: "ca-usd",
    nombreCuenta: "Caja Ahorro en USD",
    moneda: "USD",
    tipoCuenta: "debito",
  },
  {
    _id: "cc-usd",
    nombreCuenta: "Cuenta Corriente en USD",
    moneda: "USD",
    tipoCuenta: "debito",
  },
  {
    _id: "ca-uyu",
    nombreCuenta: "Caja Ahorro en UYU",
    moneda: "UYU",
    tipoCuenta: "debito",
  },
];

const transferencia = (datos = {}) => ({
  estado: "creado",
  fecha: "2026-08-10",
  cuentaId: "ca-usd",
  montoBancario: -1000,
  subcategoriaId: { nombreSubcategoria: "Transf. CA-UYU" },
  ...datos,
});

test("identifica la Caja Ahorro USD como fuente del presupuesto", () => {
  assert.equal(esCuentaFuentePresupuesto(cuentas[0]), true);
  assert.equal(esCuentaFuentePresupuesto(cuentas[1]), false);
  assert.equal(esCuentaFuentePresupuesto(cuentas[2]), false);
});

test("hay ahorro cuando las transferencias desde CA USD no consumen los US$ 4000", () => {
  const resumen = resumirPresupuestoMensualPorTransferencias({
    cuentas,
    periodo: "2026-08",
    gastos: [
      transferencia({ montoBancario: -1500 }),
      transferencia({ fecha: "2026-08-20", montoBancario: -2000 }),
    ],
  });

  assert.equal(resumen.presupuestoUsd, 4000);
  assert.equal(resumen.transferidoUsd, 3500);
  assert.equal(resumen.resultadoUsd, 500);
  assert.equal(resumen.estado, "ahorro");
});

test("hay déficit cuando las transferencias desde CA USD superan los US$ 4000", () => {
  const resumen = resumirPresupuestoMensualPorTransferencias({
    cuentas,
    periodo: "2026-08",
    gastos: [
      transferencia({ montoBancario: -2500 }),
      transferencia({ fecha: "2026-08-20", montoBancario: -1800 }),
    ],
  });

  assert.equal(resumen.transferidoUsd, 4300);
  assert.equal(resumen.resultadoUsd, -300);
  assert.equal(resumen.estado, "deficit");
});

test("ignora gastos reales, otros meses y transferencias desde Cuenta Corriente USD", () => {
  const resumen = resumirPresupuestoMensualPorTransferencias({
    cuentas,
    periodo: "2026-08",
    gastos: [
      transferencia(),
      transferencia({
        cuentaId: "cc-usd",
        montoBancario: -4000,
        subcategoriaId: { nombreSubcategoria: "Transf. CA-USD" },
      }),
      transferencia({
        montoBancario: -900,
        subcategoriaId: { nombreSubcategoria: "Supermercado" },
      }),
      transferencia({ fecha: "2026-07-10", montoBancario: -2000 }),
    ],
  });

  assert.equal(resumen.transferidoUsd, 1000);
  assert.equal(resumen.resultadoUsd, 3000);
  assert.equal(resumen.cantidadTransferencias, 1);
});
