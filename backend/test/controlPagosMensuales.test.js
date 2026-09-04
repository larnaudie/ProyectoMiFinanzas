import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluarControlesMensuales,
  limitesPeriodoControl,
  sugerirSubcategoriasHabituales,
} from "../v1/utils/controlPagosMensuales.js";

const subcategoria = (id, nombre) => ({
  _id: id,
  nombreSubcategoria: nombre,
});

const control = (id, nombre, subcategoriaId) => ({
  _id: id,
  nombre,
  subcategoriaId,
});

const gasto = (datos = {}) => ({
  _id: datos._id || "gasto",
  cuentaId: { _id: datos.cuentaId || "cuenta", nombreCuenta: datos.cuenta || "Caja" },
  subcategoriaId: datos.subcategoriaId || "ute",
  detalle: datos.detalle || "Pago mensual",
  fecha: datos.fecha || "2026-07-10T00:00:00.000Z",
  estado: datos.estado || "creado",
  moneda: datos.moneda || "UYU",
  montoBancario: datos.montoBancario ?? -1000,
  montoReal: datos.montoReal ?? -1000,
  incluirMontoReal: datos.incluirMontoReal ?? true,
});

test("consulta pagos por subcategoría en todas las cuentas", () => {
  const resultado = evaluarControlesMensuales({
    controles: [control("control-ute", "UTE", subcategoria("ute", "UTE"))],
    gastos: [
      gasto({ _id: "uno", cuentaId: "caja-uyu", cuenta: "Caja UYU" }),
      gasto({ _id: "dos", cuentaId: "tarjeta", cuenta: "Tarjeta" }),
    ],
  });

  assert.equal(resultado.resumen.pagados, 1);
  assert.equal(resultado.controles[0].estado, "pagado");
  assert.equal(resultado.controles[0].coincidencias.length, 2);
  assert.deepEqual(
    resultado.controles[0].coincidencias.map((item) => item.cuenta).sort(),
    ["Caja UYU", "Tarjeta"],
  );
});

test("distingue gasto pendiente de pago no encontrado", () => {
  const controles = [
    control("control-ose", "OSE", subcategoria("ose", "OSE")),
    control("control-ort", "ORT", subcategoria("ort", "ORT")),
  ];
  const resultado = evaluarControlesMensuales({
    controles,
    gastos: [gasto({ subcategoriaId: "ose", estado: "pendiente" })],
  });

  assert.equal(resultado.controles[0].estado, "pendiente");
  assert.equal(resultado.controles[1].estado, "no_encontrado");
  assert.deepEqual(resultado.resumen, {
    total: 2,
    totalConfigurados: 2,
    omitidos: 0,
    pagados: 0,
    pendientes: 1,
    noEncontrados: 1,
  });
});

test("el análisis es de solo lectura y no modifica los gastos recibidos", () => {
  const gastos = [gasto({ detalle: "SERVICIO UTE" })];
  const copia = structuredClone(gastos);

  evaluarControlesMensuales({
    controles: [control("control-ute", "UTE", subcategoria("ute", "UTE"))],
    gastos,
  });

  assert.deepEqual(gastos, copia);
});

test("sugiere pagos habituales existentes sin repetir controles configurados", () => {
  const sugerencias = sugerirSubcategoriasHabituales({
    subcategorias: [
      subcategoria("ute", "UTE"),
      subcategoria("wifi", "Antel WI-FI"),
      subcategoria("ocio", "Cine"),
    ],
    controles: [control("control-ute", "UTE", subcategoria("ute", "UTE"))],
  });

  assert.deepEqual(sugerencias, [
    { _id: "wifi", nombreSubcategoria: "Antel WI-FI" },
  ]);
});

test("calcula límites UTC del mes consultado", () => {
  const periodo = limitesPeriodoControl({ anio: 2026, mes: 7 });
  assert.equal(periodo.inicio.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(periodo.fin.toISOString(), "2026-08-01T00:00:00.000Z");
});

test("omite del resultado los pagos que no corresponden al mes configurado", () => {
  const resultado = evaluarControlesMensuales({
    controles: [{
      ...control("factura", "Facturación electrónica", subcategoria("factura", "Factura")),
      mesesActivos: [6],
    }],
    gastos: [],
    periodo: limitesPeriodoControl({ anio: 2026, mes: 7 }),
  });

  assert.equal(resultado.controles[0].estado, "omitido");
  assert.equal(resultado.controles[0].motivoOmision, "fuera_calendario");
  assert.deepEqual(resultado.resumen, {
    total: 0,
    totalConfigurados: 1,
    omitidos: 1,
    pagados: 0,
    pendientes: 0,
    noEncontrados: 0,
  });
});

test("permite omitir un único mes sin alterar el calendario habitual", () => {
  const resultado = evaluarControlesMensuales({
    controles: [{
      ...control("ute", "UTE", subcategoria("ute", "UTE")),
      mesesActivos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      excepciones: [{ anio: 2026, mes: 7 }],
    }],
    gastos: [],
    periodo: limitesPeriodoControl({ anio: 2026, mes: 7 }),
  });

  assert.equal(resultado.controles[0].estado, "omitido");
  assert.equal(resultado.controles[0].motivoOmision, "excepcion_periodo");
});

test("un pago de otro mes puede completar el período al que fue asignado", () => {
  const pagoAgosto = gasto({
    _id: "pago-agosto",
    subcategoriaId: "ute",
    fecha: "2026-08-05T00:00:00.000Z",
  });
  const resultado = evaluarControlesMensuales({
    controles: [{
      ...control("ute", "UTE", subcategoria("ute", "UTE")),
      pagosAsignados: [{ anio: 2026, mes: 7, gastoId: "pago-agosto" }],
    }],
    gastos: [pagoAgosto],
    periodo: limitesPeriodoControl({ anio: 2026, mes: 7 }),
  });

  assert.equal(resultado.controles[0].estado, "pagado");
  assert.equal(resultado.controles[0].pagoAsignado.gastoId, "pago-agosto");
  assert.equal(resultado.controles[0].coincidencias[0].asignadoAlPeriodo, true);
});

test("un pago asignado a un período anterior no completa también su mes bancario", () => {
  const pagoAgosto = gasto({
    _id: "pago-atrasado",
    subcategoriaId: "ute",
    fecha: "2026-08-05T00:00:00.000Z",
  });
  const resultado = evaluarControlesMensuales({
    controles: [{
      ...control("ute", "UTE", subcategoria("ute", "UTE")),
      pagosAsignados: [{ anio: 2026, mes: 7, gastoId: "pago-atrasado" }],
    }],
    gastos: [pagoAgosto],
    periodo: limitesPeriodoControl({ anio: 2026, mes: 8 }),
  });

  assert.equal(resultado.controles[0].estado, "no_encontrado");
  assert.equal(resultado.controles[0].coincidencias.length, 0);
});
