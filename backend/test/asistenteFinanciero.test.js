import test from "node:test";
import assert from "node:assert/strict";
import { consultarAsistenteSchema } from "../v1/0-validators/asistente.validators.js";
import {
  convertirHistorialAGemini,
  extraerTextoGemini,
  resumirGastosParaAsistente,
  solicitarInteraccionGemini,
} from "../v1/3-services/asistenteFinanciero.service.js";

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

test("convierte el historial al formato stateless de Gemini", () => {
  const input = convertirHistorialAGemini([
    { role: "user", content: "Hola" },
    { role: "assistant", content: "¿Qué querés analizar?" },
  ], "¿Cómo fue noviembre?");

  assert.equal(input.length, 3);
  assert.equal(input[0].type, "user_input");
  assert.equal(input[1].type, "model_output");
  assert.equal(input[2].content[0].text, "¿Cómo fue noviembre?");
});

test("extrae la respuesta textual de Gemini", () => {
  assert.equal(extraerTextoGemini({ output_text: "Respuesta directa" }), "Respuesta directa");
  assert.equal(extraerTextoGemini({
    steps: [{ type: "model_output", content: [{ type: "text", text: "Respuesta por pasos" }] }],
  }), "Respuesta por pasos");
});

test("envía herramientas de solo lectura a Gemini sin persistir la interacción", async () => {
  let solicitud;
  const fetchImpl = async (_url, opciones) => {
    solicitud = opciones;
    return {
      ok: true,
      status: 200,
      json: async () => ({ output_text: "Listo", steps: [] }),
    };
  };

  const respuesta = await solicitarInteraccionGemini({
    apiKey: "clave-de-prueba",
    modelo: "gemini-3.8-flash",
    input: [{ type: "user_input", content: [{ type: "text", text: "Hola" }] }],
    fetchImpl,
  });
  const cuerpo = JSON.parse(solicitud.body);

  assert.equal(respuesta.output_text, "Listo");
  assert.equal(cuerpo.model, "gemini-3.8-flash");
  assert.equal(cuerpo.store, false);
  assert.equal(cuerpo.tools.length, 4);
  assert.equal(solicitud.headers["x-goog-api-key"], "clave-de-prueba");
});

test("traduce el límite gratuito de Gemini a un mensaje comprensible", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: { message: "Resource exhausted" } }),
  });

  await assert.rejects(
    solicitarInteraccionGemini({
      apiKey: "clave-de-prueba",
      modelo: "gemini-3.8-flash",
      input: [],
      fetchImpl,
    }),
    (error) => error.status === 429 && /límite gratuito de Gemini/i.test(error.message),
  );
});
