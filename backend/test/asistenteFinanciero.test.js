import test from "node:test";
import assert from "node:assert/strict";
import { consultarAsistenteSchema } from "../v1/0-validators/asistente.validators.js";
import { resumirGastosParaAsistente } from "../v1/3-services/asistenteFinanciero.service.js";

const cuentaUsd = {
  _id: "cuenta-usd",
  nombreCuenta: "Caja Ahorro en USD",
  tipoCuenta: "bancaria",
  moneda: "USD",
};

test("el asistente valida preguntas e historial acotado", () => {
  const valido = consultarAsistenteSchema.validate({
    pregunta: "¿Cómo fue noviembre?",
    historial: [{ role: "assistant", content: "Decime qué querés analizar." }],
  });
  const invalido = consultarAsistenteSchema.validate({ pregunta: "x" });

  assert.equal(valido.error, undefined);
  assert.ok(invalido.error);
});

test("separa ingresos externos, gastos y transferencias propias", () => {
  const movimientos = [
    {
      _id: "sueldo",
      cuentaId: cuentaUsd,
      fecha: "2026-11-03",
      detalle: "SUELDO",
      estado: "creado",
      montoBancario: 4000,
      montoReal: 4000,
      incluirMontoReal: true,
      subcategoriaId: { nombreSubcategoria: "Ingresos" },
    },
    {
      _id: "compra",
      cuentaId: cuentaUsd,
      fecha: "2026-11-05",
      detalle: "COMPRA",
      estado: "creado",
      montoBancario: -176.64,
      montoReal: -176.64,
      incluirMontoReal: true,
      subcategoriaId: { nombreSubcategoria: "Supermercado" },
    },
    {
      _id: "transferencia",
      cuentaId: cuentaUsd,
      fecha: "2026-11-06",
      detalle: "TRANSFERENCIA A CUENTA PROPIA",
      estado: "creado",
      montoBancario: -2000,
      montoReal: 0,
      incluirMontoReal: false,
      subcategoriaId: { nombreSubcategoria: "Transf. CA-UYU" },
    },
  ];

  const resumen = resumirGastosParaAsistente(movimientos);

  assert.equal(resumen.monedas.USD.entradasExternas, 4000);
  assert.equal(resumen.monedas.USD.salidasExternas, 176.64);
  assert.equal(resumen.monedas.USD.resultadoExterno, 3823.36);
  assert.equal(resumen.monedas.USD.transferenciasEnviadas, 2000);
  assert.equal(resumen.monedas.USD.gastoReal, 176.64);
});
