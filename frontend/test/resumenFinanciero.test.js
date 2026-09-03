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
        origen: { referenciaId: { _id: "entra-uyu" } },
      },
      {
        _id: "entra-uyu",
        cuentaId: "uyu",
        fecha: "2026-08-01",
        estado: "creado",
        montoBancario: 40000,
        origen: { referenciaId: { _id: "sale-usd" } },
      },
    ],
  });

  assert.equal(resumen.USD.egresosBancarios, 0);
  assert.equal(resumen.UYU.ingresosBancarios, 0);
  assert.equal(resumen.USD.gastoReal, 0);
  assert.equal(resumen.UYU.gastoReal, 0);
});

test("una transferencia vinculada modifica el ahorro de cada cuenta", () => {
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
        origen: { referenciaId: { _id: "entra-uyu" } },
      },
      {
        _id: "entra-uyu",
        cuentaId: "uyu",
        fecha: "2026-08-02",
        estado: "creado",
        montoBancario: 40000,
        origen: { referenciaId: { _id: "sale-usd" } },
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
  assert.equal(resumen.USD.egresosBancarios, 1000);
  assert.equal(resumen.USD.resultadoBancario, 3000);
  assert.equal(resumen.UYU.cantidad, 0);
  assert.equal(resumen.UYU.gastoReal, 0);
});

test("el ahorro de una cuenta incluye gastos directos además de transferencias", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas,
    periodo: "2026-05",
    cuentaId: "usd",
    gastos: [
      {
        _id: "ingreso",
        cuentaId: "usd",
        fecha: "2026-05-04",
        estado: "creado",
        montoBancario: 4000,
      },
      {
        _id: "transferencia",
        cuentaId: "usd",
        fecha: "2026-05-04",
        estado: "creado",
        montoBancario: -2405.58,
        subcategoriaId: { nombreSubcategoria: "Transf. CA-UYU" },
      },
      {
        _id: "auto",
        cuentaId: "usd",
        fecha: "2026-05-10",
        estado: "creado",
        montoBancario: -10000,
        montoReal: -10000,
        incluirMontoReal: true,
        subcategoriaId: { nombreSubcategoria: "Auto Gastos" },
      },
      {
        _id: "otros",
        cuentaId: "usd",
        fecha: "2026-05-20",
        estado: "creado",
        montoBancario: -1053.38,
        montoReal: -1053.38,
        incluirMontoReal: true,
      },
    ],
  });

  assert.equal(resumen.USD.ingresosBancarios, 4000);
  assert.equal(resumen.USD.egresosBancarios, 13458.96);
  assert.equal(resumen.USD.resultadoBancario, -9458.96);
});

test("cada cuenta conserva su ahorro y el consolidado neutraliza los traslados", () => {
  const cuentasFlujo = [
    { _id: "cc-usd", tipoCuenta: "debito", moneda: "USD" },
    { _id: "ca-usd", tipoCuenta: "debito", moneda: "USD" },
    { _id: "ca-uyu", tipoCuenta: "debito", moneda: "UYU" },
  ];
  const gastos = [
    {
      _id: "sueldo",
      cuentaId: "cc-usd",
      fecha: "2026-05-01",
      estado: "creado",
      montoBancario: 4000,
    },
    {
      _id: "cc-a-ca",
      cuentaId: "cc-usd",
      fecha: "2026-05-02",
      estado: "creado",
      montoBancario: -4000,
      subcategoriaId: { nombreSubcategoria: "Transf. CC-USD" },
    },
    {
      _id: "ca-recibe",
      cuentaId: "ca-usd",
      fecha: "2026-05-02",
      estado: "creado",
      montoBancario: 4000,
      subcategoriaId: { nombreSubcategoria: "Transf. CC-USD" },
    },
    {
      _id: "ca-envia",
      cuentaId: "ca-usd",
      fecha: "2026-05-03",
      estado: "creado",
      montoBancario: -3000,
      subcategoriaId: { nombreSubcategoria: "Transf. CA-UYU" },
    },
    {
      _id: "uyu-recibe",
      cuentaId: "ca-uyu",
      fecha: "2026-05-03",
      estado: "creado",
      montoBancario: 120000,
      subcategoriaId: { nombreSubcategoria: "Transf. CA-USD" },
    },
    {
      _id: "gasto-uyu",
      cuentaId: "ca-uyu",
      fecha: "2026-05-04",
      estado: "creado",
      montoBancario: -40000,
    },
  ];

  const cc = resumirMovimientosMensuales({
    cuentas: cuentasFlujo,
    gastos,
    periodo: "2026-05",
    cuentaId: "cc-usd",
  });
  const caUsd = resumirMovimientosMensuales({
    cuentas: cuentasFlujo,
    gastos,
    periodo: "2026-05",
    cuentaId: "ca-usd",
  });
  const caUyu = resumirMovimientosMensuales({
    cuentas: cuentasFlujo,
    gastos,
    periodo: "2026-05",
    cuentaId: "ca-uyu",
  });
  const consolidado = resumirMovimientosMensuales({
    cuentas: cuentasFlujo,
    gastos,
    periodo: "2026-05",
  });

  assert.equal(cc.USD.resultadoBancario, 0);
  assert.equal(caUsd.USD.resultadoBancario, 1000);
  assert.equal(caUyu.UYU.resultadoBancario, 80000);
  assert.equal(consolidado.USD.resultadoBancario, 4000);
  assert.equal(consolidado.UYU.resultadoBancario, -40000);
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
        origen: { referenciaId: { _id: "entra-uyu" } },
      },
      {
        _id: "entra-uyu",
        cuentaId: "uyu",
        fecha: "2026-08-02",
        estado: "creado",
        montoBancario: 40000,
        origen: { referenciaId: { _id: "sale-usd" } },
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

test("una referencia técnica del Excel no se confunde con una transferencia interna", () => {
  const resumen = resumirMovimientosMensuales({
    cuentas,
    periodo: "2026-08",
    gastos: [
      {
        _id: "gasto-importado",
        cuentaId: "uyu",
        fecha: "2026-08-10",
        estado: "creado",
        montoBancario: -1250,
        montoReal: -1000,
        incluirMontoReal: true,
        origen: {
          tipo: "excel",
          referenciaId: "movimiento-importado",
        },
      },
    ],
  });

  assert.equal(resumen.UYU.egresosBancarios, 1250);
  assert.equal(resumen.UYU.gastoReal, 1000);
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
  assert.equal(resumen.USD.cantidad, 0);
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

test("consolida entradas y salidas de distintas monedas en un único resultado", () => {
  const cotizacion = {
    usd: { uyuPorDolar: 40.235 },
    ui: { uyuPorUnidad: 6.64 },
  };
  const movimientos = {
    UYU: {
      ingresosBancarios: 53738.24,
      egresosBancarios: 119129.6,
      resultadoBancario: -65391.36,
    },
    USD: {
      ingresosBancarios: 4000,
      egresosBancarios: 141.2,
      resultadoBancario: 3858.8,
    },
    UI: {
      ingresosBancarios: 0,
      egresosBancarios: 0,
      resultadoBancario: 0,
    },
  };

  assert.equal(
    totalizarCampoEnUyu(movimientos, "ingresosBancarios", cotizacion),
    214678.24,
  );
  assert.equal(
    totalizarCampoEnUyu(movimientos, "egresosBancarios", cotizacion),
    124810.78,
  );
  assert.equal(
    totalizarCampoEnUyu(movimientos, "resultadoBancario", cotizacion),
    89867.46,
  );
});
