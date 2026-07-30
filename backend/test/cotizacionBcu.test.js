import assert from "node:assert/strict";
import test from "node:test";
import {
  crearSolicitudCotizacionesBcu,
  interpretarCotizacionesBcu,
  limpiarCacheCotizacionesBcu,
  obtenerCotizacionUiBcuService,
} from "../v1/3-services/cotizacionBcu.service.js";

const RESPUESTA_BCU = `
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <datoscotizaciones>
      <datoscotizaciones.dato xmlns="Cotiza">
        <Fecha>2026-07-28</Fecha>
        <Moneda>2225</Moneda>
        <Nombre>DLS. USA BILLETE</Nombre>
        <TCC>40.214000</TCC>
        <TCV>40.214000</TCV>
        <ArbAct>1.000000</ArbAct>
      </datoscotizaciones.dato>
      <datoscotizaciones.dato xmlns="Cotiza">
        <Fecha>2026-07-29</Fecha>
        <Moneda>2225</Moneda>
        <Nombre>DLS. USA BILLETE</Nombre>
        <TCC>40.223000</TCC>
        <TCV>40.223000</TCV>
        <ArbAct>1.000000</ArbAct>
      </datoscotizaciones.dato>
      <datoscotizaciones.dato xmlns="Cotiza">
        <Fecha>2026-07-28</Fecha>
        <Moneda>9800</Moneda>
        <Nombre>UNIDAD INDEXADA</Nombre>
        <TCC>6.626800</TCC>
        <TCV>6.626800</TCV>
        <ArbAct>0.164788</ArbAct>
      </datoscotizaciones.dato>
      <datoscotizaciones.dato xmlns="Cotiza">
        <Fecha>2026-07-29</Fecha>
        <Moneda>9800</Moneda>
        <Nombre>UNIDAD INDEXADA</Nombre>
        <TCC>6.627600</TCC>
        <TCV>6.627600</TCV>
        <ArbAct>0.164771</ArbAct>
      </datoscotizaciones.dato>
    </datoscotizaciones>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

test("interpreta la última UI y el último dólar publicados por el BCU", () => {
  const cotizacion = interpretarCotizacionesBcu(RESPUESTA_BCU);

  assert.equal(cotizacion.ui.fecha, "2026-07-29");
  assert.equal(cotizacion.ui.uyuPorUnidad, 6.6276);
  assert.equal(cotizacion.usd.fecha, "2026-07-29");
  assert.equal(cotizacion.usd.uyuPorDolar, 40.223);
  assert.equal(
    cotizacion.equivalencias.unaUiEnUsd,
    6.6276 / 40.223,
  );
});

test("la solicitud incluye UI, dólar y un rango que cubre cierres anteriores", () => {
  const solicitud = crearSolicitudCotizacionesBcu(
    new Date("2026-07-29T15:00:00.000Z"),
  );

  assert.match(solicitud, /<cot:item>2225<\/cot:item>/);
  assert.match(solicitud, /<cot:item>9800<\/cot:item>/);
  assert.match(solicitud, /<cot:FechaDesde>2026-07-15<\/cot:FechaDesde>/);
  assert.match(solicitud, /<cot:FechaHasta>2026-07-29<\/cot:FechaHasta>/);
});

test("mantiene en caché la cotización del BCU", async () => {
  limpiarCacheCotizacionesBcu();
  let consultas = 0;
  const fetchImpl = async () => {
    consultas += 1;
    return {
      ok: true,
      text: async () => RESPUESTA_BCU,
    };
  };
  const ahora = new Date("2026-07-29T15:00:00.000Z");

  const primera = await obtenerCotizacionUiBcuService({
    fetchImpl,
    ahora,
  });
  const segunda = await obtenerCotizacionUiBcuService({
    fetchImpl,
    ahora: new Date("2026-07-29T15:10:00.000Z"),
  });

  assert.equal(consultas, 1);
  assert.equal(primera.desdeCache, false);
  assert.equal(segunda.desdeCache, true);
  limpiarCacheCotizacionesBcu();
});
