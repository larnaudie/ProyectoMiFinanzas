import assert from "node:assert/strict";
import test from "node:test";
import Gasto from "../v1/0.1-models/gasto.model.js";
import MovimientoImportado from "../v1/0.1-models/movimientoImportado.model.js";
import { obtenerMovimientosImportadosService } from "../v1/3-services/importacionExcel.service.js";

test("los movimientos pendientes conservan la advertencia de gasto duplicado", async (t) => {
  const buscarMovimientosOriginal = MovimientoImportado.find;
  const buscarGastosOriginal = Gasto.find;
  t.after(() => {
    MovimientoImportado.find = buscarMovimientosOriginal;
    Gasto.find = buscarGastosOriginal;
  });

  const movimientos = [
    {
      _id: "movimiento-duplicado",
      fechaBanco: new Date("2026-10-05T12:00:00.000Z"),
      detalleOriginal: "SERVICIO PAC DEBITO PAGO MI AUTO UYU /REF: 52681977",
      montoBancario: -11112.9,
      montoReal: 0,
      estadoImportacion: "pendiente",
    },
    {
      _id: "movimiento-nuevo",
      fechaBanco: new Date("2026-10-05T12:00:00.000Z"),
      detalleOriginal: "COMPRA EN OTRO COMERCIO",
      montoBancario: -584,
      montoReal: 0,
      estadoImportacion: "pendiente",
    },
  ];
  const gastoExistente = {
    _id: "gasto-existente",
    fecha: new Date("2026-10-05T09:00:00.000Z"),
    detalle: "SERVICIO PAC DEBITO PAGO MI AUTO UYU /REF: 52681977",
    montoBancario: -11112.9,
    montoReal: 0,
    estado: "creado",
  };

  MovimientoImportado.find = () => ({
    sort() {
      return this;
    },
    async lean() {
      return movimientos;
    },
  });
  Gasto.find = () => ({
    select() {
      return this;
    },
    async lean() {
      return [gastoExistente];
    },
  });

  const resultado = await obtenerMovimientosImportadosService({
    usuarioId: "64a000000000000000000001",
    cuentaId: "64b000000000000000000001",
    estadoImportacion: "pendiente",
  });

  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado[0].posiblesDuplicados, [gastoExistente]);
  assert.deepEqual(resultado[1].posiblesDuplicados, []);
});
