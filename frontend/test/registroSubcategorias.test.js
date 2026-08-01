import test from "node:test";
import assert from "node:assert/strict";
import {
  construirRegistroGastosPorSubcategoria,
  esSubcategoriaTransferencia,
} from "../src/utils/registroSubcategorias.js";

const cuentas = [
  { _id: "ca-uyu", nombreCuenta: "Caja UYU", moneda: "UYU", tipoCuenta: "debito" },
  { _id: "ca-usd", nombreCuenta: "Caja USD", moneda: "USD", tipoCuenta: "debito" },
  { _id: "tc", nombreCuenta: "Tarjeta", monedas: ["UYU", "USD"], tipoCuenta: "credito" },
];

const gasto = (datos = {}) => ({
  _id: Math.random().toString(),
  cuentaId: "ca-uyu",
  fecha: "2026-07-10",
  estado: "creado",
  montoBancario: -100,
  montoReal: -80,
  incluirMontoReal: true,
  categoriaId: { nombreCategoria: "Alimentación" },
  subcategoriaId: { nombreSubcategoria: "Supermercado" },
  ...datos,
});

test("agrupa gastos reales negativos y excluye ingresos, transferencias y tarjetas", () => {
  const registros = construirRegistroGastosPorSubcategoria({
    cuentas,
    meses: ["2026-07"],
    gastos: [
      gasto(),
      gasto({ _id: "segundo", montoReal: -20 }),
      gasto({ _id: "ingreso", montoReal: 500 }),
      gasto({
        _id: "transferencia",
        montoReal: 0,
        incluirMontoReal: false,
        subcategoriaId: { nombreSubcategoria: "Transf. CA-USD" },
      }),
      gasto({ _id: "tarjeta", cuentaId: "tc", moneda: "UYU" }),
      gasto({ _id: "pendiente", estado: "pendiente" }),
    ],
  });

  assert.equal(registros.length, 1);
  assert.equal(registros[0].moneda, "UYU");
  assert.equal(registros[0].cantidad, 2);
  assert.equal(registros[0].total, 100);
  assert.equal(registros[0].filas[0].subcategoria, "Supermercado");
  assert.deepEqual(registros[0].filas[0].cuentas, ["Caja UYU"]);
});

test("usa monto bancario sin incluir y mantiene las monedas separadas", () => {
  const registros = construirRegistroGastosPorSubcategoria({
    cuentas,
    meses: ["2026-07"],
    gastos: [
      gasto({ incluirMontoReal: false, montoBancario: -125, montoReal: 0 }),
      gasto({
        _id: "usd",
        cuentaId: "ca-usd",
        incluirMontoReal: false,
        montoBancario: -12.5,
        montoReal: 0,
      }),
      gasto({ _id: "otro-mes", fecha: "2026-06-10", montoReal: -999 }),
    ],
  });

  assert.deepEqual(
    registros.map(({ moneda, total }) => ({ moneda, total })),
    [
      { moneda: "USD", total: 12.5 },
      { moneda: "UYU", total: 125 },
    ],
  );
});

test("reconoce nombres habituales de transferencias", () => {
  assert.equal(esSubcategoriaTransferencia("Transf. CA-UYU"), true);
  assert.equal(esSubcategoriaTransferencia("Transferencia interna"), true);
  assert.equal(esSubcategoriaTransferencia("Supermercado"), false);
});
