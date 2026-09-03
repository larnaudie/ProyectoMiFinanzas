import assert from "node:assert/strict";
import test from "node:test";
import Cuenta from "../v1/0.1-models/cuenta.model.js";
import Gasto from "../v1/0.1-models/gasto.model.js";
import Subcategoria from "../v1/0.1-models/subcategoria.model.js";
import { crearGastoService } from "../v1/3-services/gasto.service.js";

test("crear un gasto Excel reutiliza cuenta y subcategoria ya validadas", async (t) => {
  const originales = {
    buscarCuenta: Cuenta.findOne,
    buscarGasto: Gasto.findOne,
    crearGasto: Gasto.create,
    buscarSubcategoria: Subcategoria.findOne,
  };
  t.after(() => {
    Cuenta.findOne = originales.buscarCuenta;
    Gasto.findOne = originales.buscarGasto;
    Gasto.create = originales.crearGasto;
    Subcategoria.findOne = originales.buscarSubcategoria;
  });

  let documentoCreado = null;
  const consultaInesperada = () => {
    throw new Error("No debía consultar nuevamente datos ya validados");
  };
  Cuenta.findOne = consultaInesperada;
  Gasto.findOne = consultaInesperada;
  Subcategoria.findOne = consultaInesperada;
  Gasto.create = async (documento) => {
    documentoCreado = documento;
    return { _id: "64d000000000000000000001", ...documento };
  };

  const gasto = await crearGastoService(
    {
      detalle: "Compra importada",
      cuentaId: "64b000000000000000000001",
      fecha: "2026-08-31",
      montoBancario: -100,
      montoReal: -70,
      porcentaje: 70,
      incluirMontoReal: true,
      subcategoriaId: "64c000000000000000000001",
      cambiarEstado: true,
      origen: {
        tipo: "excel",
        referenciaId: "64e000000000000000000001",
      },
    },
    "64a000000000000000000001",
    {
      cuentaPreCargada: {
        _id: "64b000000000000000000001",
        moneda: "UYU",
        tipoCuenta: "debito",
        monedas: [],
      },
      subcategoriaPreCargada: {
        _id: "64c000000000000000000001",
        nombreSubcategoria: "Supermercado",
      },
      reconciliarPrestamos: false,
    },
  );

  assert.equal(gasto._id, "64d000000000000000000001");
  assert.equal(documentoCreado.estado, "creado");
  assert.equal(documentoCreado.moneda, "UYU");
  assert.equal(documentoCreado.montoReal, -70);
});
