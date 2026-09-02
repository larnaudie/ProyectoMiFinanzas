import assert from "node:assert/strict";
import test from "node:test";
import {
  resumirMovimientosMensuales,
  resumirSaldosCuentas,
  totalizarCampoEnUyu,
  totalizarSaldosEnUyu,
} from "../src/utils/resumenFinanciero.js";

const cuentas = [
  { _id: "uyu", tipoCuenta: "debito", moneda: "UYU" },
  { _id: "usd", tipoCuenta: "debito", moneda: "USD" },
  { _id: "tarjeta", tipoCuenta: "credito", monedas: ["UYU", "USD"] },
];

test("separa movimiento bancario y gasto real del mes", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas,
    periodo: "2026-08",
    gastos: [
      {
        _id: "ingreso",
        cuentaId: "uyu",
        fecha: "2026-08-01",
        estado: "creado",
        montoBancario: 40000,
      },
      {
        _id: "gasto",
        cuentaId: "uyu",
        fecha: "2026-08-02",
        estado: "creado",
        montoBancario: -26000,
        montoReal: -18200,
        incluirMontoReal: true,
      },
    ],
  });

  assert.deepEqual(resumen.UYU, {
    cantidad: 2,
    duplicadosIgnorados: 0,
    ingresosBancarios: 40000,
    egresosBancarios: 26000,
    resultadoBancario: 14000,
    gastoReal: 18200,
  });
});

test("una transferencia propia vinculada es neutral para el flujo general", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas,
    periodo: "2026-08",
    gastos: [
      {
        _id: "sale-usd",
        cuentaId: "usd",
        fecha: "2026-08-01",
        estado: "creado",
        montoBancario: -1000,
        origen: { referenciaId: "entra-uyu" },
      },
      {
        _id: "entra-uyu",
        cuentaId: "uyu",
        fecha: "2026-08-01",
        estado: "creado",
        montoBancario: 40000,
        origen: { referenciaId: "sale-usd" },
      },
    ],
  });

  assert.equal(resumen.USD.egresosBancarios, 0);
  assert.equal(resumen.UYU.ingresosBancarios, 0);
  assert.equal(resumen.USD.gastoReal, 0);
  assert.equal(resumen.UYU.gastoReal, 0);
});

test("filtra el resultado mensual por cuenta sin perder las transferencias vinculadas", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas,
    periodo: "2026-08",
    cuentaId: "usd",
    gastos: [
      {
        _id: "ingreso-usd",
        cuentaId: "usd",
        fecha: "2026-08-01",
        estado: "creado",
        montoBancario: 4000,
      },
      {
        _id: "sale-usd",
        cuentaId: "usd",
        fecha: "2026-08-02",
        estado: "creado",
        montoBancario: -1000,
        origen: { referenciaId: "entra-uyu" },
      },
      {
        _id: "entra-uyu",
        cuentaId: "uyu",
        fecha: "2026-08-02",
        estado: "creado",
        montoBancario: 40000,
        origen: { referenciaId: "sale-usd" },
      },
      {
        _id: "gasto-uyu",
        cuentaId: "uyu",
        fecha: "2026-08-03",
        estado: "creado",
        montoBancario: -10000,
        montoReal: -7000,
        incluirMontoReal: true,
      },
    ],
  });

  assert.equal(resumen.USD.cantidad, 2);
  assert.equal(resumen.USD.ingresosBancarios, 4000);
  assert.equal(resumen.USD.egresosBancarios, 0);
  assert.equal(resumen.UYU.cantidad, 0);
  assert.equal(resumen.UYU.gastoReal, 0);
});

test("un traslado interno no altera el flujo general", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas,
    periodo: "2026-08",
    gastos: [
      {
        _id: "sueldo-usd",
        cuentaId: "usd",
        fecha: "2026-08-01",
        estado: "creado",
        montoBancario: 4000,
      },
      {
        _id: "sale-usd",
        cuentaId: "usd",
        fecha: "2026-08-02",
        estado: "creado",
        montoBancario: -1000,
        origen: { referenciaId: "entra-uyu" },
      },
      {
        _id: "entra-uyu",
        cuentaId: "uyu",
        fecha: "2026-08-02",
        estado: "creado",
        montoBancario: 40000,
        origen: { referenciaId: "sale-usd" },
      },
    ],
  });

  assert.equal(resumen.USD.ingresosBancarios, 4000);
  assert.equal(resumen.USD.egresosBancarios, 0);
  assert.equal(resumen.UYU.ingresosBancarios, 0);
});

test("reconoce una transferencia histórica importada aunque no esté vinculada", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas,
    periodo: "2026-08",
    gastos: [
      {
        _id: "salario",
        cuentaId: "usd",
        fecha: "2026-08-01",
        estado: "creado",
        montoBancario: 4000,
        subcategoriaId: { nombreSubcategoria: "Ingresos" },
      },
      {
        _id: "transferencia-importada",
        cuentaId: "uyu",
        fecha: "2026-08-02",
        estado: "creado",
        montoBancario: 40000,
        subcategoriaId: { nombreSubcategoria: "Transf. CA-USD" },
      },
    ],
  });

  assert.equal(resumen.USD.ingresosBancarios, 4000);
  assert.equal(resumen.UYU.ingresosBancarios, 0);
});

test("los ahorros y movimientos de pago dentro de la tarjeta son neutrales", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas,
    periodo: "2026-08",
    gastos: [
      {
        _id: "ahorro-usd",
        cuentaId: "usd",
        fecha: "2026-08-01",
        estado: "creado",
        montoBancario: -500,
        montoReal: -500,
        incluirMontoReal: true,
        subcategoriaId: { nombreSubcategoria: "Ahorros" },
      },
      {
        _id: "pago-tarjeta",
        cuentaId: "tarjeta",
        fecha: "2026-08-02",
        estado: "creado",
        moneda: "USD",
        montoBancario: -300,
        montoReal: -300,
        incluirMontoReal: true,
        tipoMovimiento: "pago",
        origen: { tipo: "tarjeta" },
      },
    ],
  });

  assert.equal(resumen.USD.egresosBancarios, 0);
  assert.equal(resumen.USD.gastoReal, 0);
});

test("un saldo anterior no se convierte en ingreso ni gasto real del mes", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas,
    periodo: "2026-01",
    gastos: [
      {
        _id: "saldo-anterior",
        cuentaId: "usd",
        fecha: "2026-01-01",
        estado: "creado",
        detalle: "Monto Anterior",
        montoBancario: 10000,
        montoReal: 10000,
        incluirMontoReal: true,
      },
    ],
  });

  assert.equal(resumen.USD.ingresosBancarios, 0);
  assert.equal(resumen.USD.gastoReal, 0);
});

test("un pago bancario importado conserva la decisión de gasto real", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas,
    periodo: "2026-08",
    gastos: [
      {
        _id: "pago-desde-banco",
        cuentaId: "uyu",
        fecha: "2026-08-17",
        estado: "creado",
        montoBancario: -9000,
        montoReal: -9000,
        incluirMontoReal: true,
        subcategoriaId: { nombreSubcategoria: "Pago Tarjeta Platinum" },
      },
    ],
  });

  assert.equal(resumen.UYU.egresosBancarios, 9000);
  assert.equal(resumen.UYU.gastoReal, 9000);
});

test("ignora un duplicado bancario exacto cargado en otra cuenta", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas: [
      ...cuentas,
      { _id: "usd-2", tipoCuenta: "debito", moneda: "USD" },
    ],
    periodo: "2026-05",
    gastos: [
      {
        _id: "original",
        cuentaId: "usd",
        fecha: "2026-05-14",
        estado: "creado",
        detalle: "COMPRA GOOGLE ONE",
        montoBancario: -19.99,
        montoReal: -19.99,
        incluirMontoReal: true,
      },
      {
        _id: "duplicado",
        cuentaId: "usd-2",
        fecha: "2026-05-14",
        estado: "creado",
        detalle: "COMPRA GOOGLE ONE",
        montoBancario: -19.99,
        montoReal: -19.99,
        incluirMontoReal: true,
      },
    ],
  });

  assert.equal(resumen.USD.egresosBancarios, 19.99);
  assert.equal(resumen.USD.gastoReal, 19.99);
  assert.equal(resumen.USD.duplicadosIgnorados, 1);
});

test("los saldos se agrupan sin mezclar monedas y excluyen tarjetas", () => {
  const saldos = resumirSaldosCuentas([
    { _id: "a", tipoCuenta: "debito", moneda: "USD", saldoActual: 9832.26 },
    { _id: "b", tipoCuenta: "debito", moneda: "UI", saldoActual: 91141.66 },
    { _id: "c", tipoCuenta: "credito", moneda: "UYU", saldoActual: -5000 },
  ]);

  assert.equal(saldos.USD.total, 9832.26);
  assert.equal(saldos.UI.total, 91141.66);
  assert.equal(saldos.UYU.total, 0);
  assert.equal(saldos.UYU.cuentas.length, 0);
});

test("convierte sólo la referencia consolidada y conserva los importes originales", () => {
  const cotizacion = {
    usd: { uyuPorDolar: 40 },
    ui: { uyuPorUnidad: 6.5 },
  };
  const saldos = resumirSaldosCuentas([
    { _id: "a", tipoCuenta: "debito", moneda: "USD", saldoActual: 100 },
    { _id: "b", tipoCuenta: "debito", moneda: "UI", saldoActual: 100 },
  ]);
  const movimientos = {
    UYU: { gastoReal: 1000 },
    USD: { gastoReal: 100 },
    UI: { gastoReal: -100 },
  };

  assert.equal(totalizarSaldosEnUyu(saldos, cotizacion), 4650);
  assert.equal(
    totalizarCampoEnUyu(movimientos, "gastoReal", cotizacion),
    4350,
  );
});
