import test from "node:test";
import assert from "node:assert/strict";
import {
  crearFiltrosGastosIniciales,
  filtrarGastos,
} from "../src/utils/filtrosGastos.js";

const cuentaUyu = {
  _id: "cuenta-uyu",
  nombreCuenta: "Caja UYU",
  moneda: "UYU",
  tipoCuenta: "debito",
};
const cuentaUsd = {
  _id: "cuenta-usd",
  nombreCuenta: "Caja USD",
  moneda: "USD",
  tipoCuenta: "debito",
};

const gastos = [
  {
    _id: "gasto-1",
    cuenta: cuentaUyu,
    fecha: "2026-01-12T00:00:00.000Z",
    detalle: "Compra supermercado",
    montoBancario: -100,
    montoReal: -70,
    incluirMontoReal: true,
    estado: "creado",
    categoriaId: { _id: "categoria-1" },
    subcategoriaId: { _id: "subcategoria-1" },
  },
  {
    _id: "gasto-2",
    cuenta: cuentaUsd,
    fecha: "2026-02-05T00:00:00.000Z",
    detalle: "Transferencia ahorro",
    montoBancario: 500,
    montoReal: 0,
    incluirMontoReal: false,
    estado: "pendiente",
    categoriaId: null,
    subcategoriaId: { _id: "subcategoria-2" },
  },
];

test("filtra movimientos globales por cuenta, estado y moneda", () => {
  const filtros = {
    ...crearFiltrosGastosIniciales({ incluirFiltrosGlobales: true }),
    fechaAnio: "",
    cuentaId: "cuenta-usd",
    estado: "pendiente",
    moneda: "USD",
  };

  const resultado = filtrarGastos(gastos, filtros, {
    obtenerCuenta: (gasto) => gasto.cuenta,
  });

  assert.deepEqual(resultado.map((gasto) => gasto._id), ["gasto-2"]);
});

test("combina detalle, mes, categoría y rango de monto real", () => {
  const filtros = {
    ...crearFiltrosGastosIniciales({ incluirFiltrosGlobales: true }),
    detalle: "super",
    fechaMes: "01",
    fechaAnio: "2026",
    categoriaId: "categoria-1",
    montoRealModo: "rango",
    montoRealDesde: "-80",
    montoRealHasta: "-60",
    incluirMontoReal: "true",
  };

  const resultado = filtrarGastos(gastos, filtros, {
    obtenerCuenta: (gasto) => gasto.cuenta,
  });

  assert.deepEqual(resultado.map((gasto) => gasto._id), ["gasto-1"]);
});

test("todos los meses conserva el filtro por año", () => {
  const filtros = {
    ...crearFiltrosGastosIniciales({ incluirFiltrosGlobales: true }),
    fechaMes: "",
    fechaAnio: "2026",
  };

  const resultado = filtrarGastos(gastos, filtros, {
    obtenerCuenta: (gasto) => gasto.cuenta,
  });

  assert.equal(resultado.length, 2);
});

test("el desglose sin filtro global Incluye conserva ambos tipos de gasto", () => {
  const filtros = {
    ...crearFiltrosGastosIniciales(),
    fechaMes: "",
    fechaAnio: "2026",
  };

  const resultado = filtrarGastos(gastos, filtros, {
    obtenerCuenta: (gasto) => gasto.cuenta,
  });

  assert.deepEqual(
    resultado.map((gasto) => gasto._id),
    ["gasto-1", "gasto-2"],
  );
});
