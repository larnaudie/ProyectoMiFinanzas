import assert from "node:assert/strict";
import test from "node:test";
import Gasto from "../v1/0.1-models/gasto.model.js";
import MovimientoImportado from "../v1/0.1-models/movimientoImportado.model.js";
import Prestamo from "../v1/0.1-models/prestamo.model.js";
import Subcategoria from "../v1/0.1-models/subcategoria.model.js";
import { crearGastoDesdeMovimientoImportadoService } from "../v1/3-services/importacionExcel.service.js";

test("duplica conscientemente un gasto sin reemplazar el vínculo original", async (t) => {
  const originales = {
    buscarMovimiento: MovimientoImportado.findOne,
    buscarGastoExistente: Gasto.exists,
    crearGasto: Gasto.create,
    buscarSubcategoria: Subcategoria.findOne,
    buscarPrestamos: Prestamo.find,
  };
  t.after(() => {
    MovimientoImportado.findOne = originales.buscarMovimiento;
    Gasto.exists = originales.buscarGastoExistente;
    Gasto.create = originales.crearGasto;
    Subcategoria.findOne = originales.buscarSubcategoria;
    Prestamo.find = originales.buscarPrestamos;
  });

  const usuarioId = "64a000000000000000000001";
  const cuentaId = "64b000000000000000000001";
  const movimientoId = "64c000000000000000000001";
  const gastoOriginalId = "64d000000000000000000001";
  const gastoDuplicadoId = "64e000000000000000000001";
  const subcategoriaId = "64f000000000000000000001";
  const movimiento = {
    _id: movimientoId,
    usuarioId,
    cuentaId,
    moneda: "UYU",
    detalleOriginal: "SERVICIO PAC DEBITO PAGO MI AUTO",
    fechaBanco: new Date("2026-10-05T12:00:00.000Z"),
    montoBancario: -11112.9,
    montoReal: -11112.9,
    hashBanco: "hash-movimiento",
    estadoImportacion: "vinculado",
    gastoId: gastoOriginalId,
    async save() {
      throw new Error("No debe reemplazar ni volver a guardar el vínculo original");
    },
  };
  let documentoCreado = null;

  MovimientoImportado.findOne = async () => movimiento;
  Gasto.exists = async () => true;
  Gasto.create = async (documento) => {
    documentoCreado = documento;
    return { _id: gastoDuplicadoId, ...documento };
  };
  Subcategoria.findOne = () => ({
    select: async () => ({
      _id: subcategoriaId,
      nombreSubcategoria: "Auto Cuotas",
    }),
  });
  Prestamo.find = () => ({
    sort: async () => [],
  });

  const resultado = await crearGastoDesdeMovimientoImportadoService({
    usuarioId,
    id: movimientoId,
    data: {
      detalle: movimiento.detalleOriginal,
      fecha: "2026-10-05",
      montoBancario: -11112.9,
      montoReal: -11112.9,
      porcentaje: 100,
      incluirMontoReal: true,
      subcategoriaId,
      duplicarGasto: true,
    },
  });

  assert.equal(resultado.duplicado, true);
  assert.equal(resultado.gasto._id, gastoDuplicadoId);
  assert.equal(movimiento.gastoId, gastoOriginalId);
  assert.equal(movimiento.estadoImportacion, "vinculado");
  assert.equal(documentoCreado.hashImportacion, null);
  assert.deepEqual(documentoCreado.origen, {
    tipo: "manual",
    referenciaId: null,
  });
});
