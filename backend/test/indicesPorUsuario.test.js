import assert from "node:assert/strict";
import test from "node:test";
import Banco from "../v1/0.1-models/banco.model.js";
import Categoria from "../v1/0.1-models/categoria.model.js";
import Cuenta from "../v1/0.1-models/cuenta.model.js";
import DeudaCobrar from "../v1/0.1-models/deudaCobrar.model.js";
import MovimientoImportado from "../v1/0.1-models/movimientoImportado.model.js";
import SaldoCuenta from "../v1/0.1-models/saldoCuenta.model.js";
import Subcategoria from "../v1/0.1-models/subcategoria.model.js";
import { errorMiddleware } from "../v1/middlewares/error.middleware.js";

const indiceUnico = (modelo, campos) => modelo.schema.indexes().find(
  ([definicion, opciones]) => opciones.unique === true
    && JSON.stringify(definicion) === JSON.stringify(campos),
);

test("los nombres y hashes pertenecientes a usuarios usan índices compuestos", () => {
  assert.ok(indiceUnico(Banco, { usuarioId: 1, nombreBanco: 1 }));
  assert.ok(indiceUnico(Cuenta, { usuarioId: 1, nombreCuenta: 1 }));
  assert.ok(indiceUnico(Categoria, { usuarioId: 1, nombreCategoria: 1 }));
  assert.ok(indiceUnico(Subcategoria, { usuarioId: 1, nombreSubcategoria: 1 }));
  assert.ok(indiceUnico(DeudaCobrar, { usuarioId: 1, nombre: 1 }));
  assert.ok(indiceUnico(
    MovimientoImportado,
    { usuarioId: 1, cuentaId: 1, hashBanco: 1 },
  ));
  assert.ok(indiceUnico(
    SaldoCuenta,
    { usuarioId: 1, cuentaId: 1, hashBanco: 1 },
  ));
});

test("no quedan índices únicos globales en entidades pertenecientes al usuario", () => {
  for (const modelo of [
    Banco,
    Cuenta,
    Categoria,
    Subcategoria,
    DeudaCobrar,
    MovimientoImportado,
    SaldoCuenta,
  ]) {
    const globales = modelo.schema.indexes().filter(([definicion, opciones]) => (
      opciones.unique === true
      && !Object.prototype.hasOwnProperty.call(definicion, "usuarioId")
    ));
    assert.deepEqual(globales, []);
  }
});

test("un duplicado devuelve conflicto legible y no expone el error de Mongo", () => {
  let estado;
  let cuerpo;
  const response = {
    status(valor) {
      estado = valor;
      return this;
    },
    json(valor) {
      cuerpo = valor;
      return this;
    },
  };

  errorMiddleware({
    code: 11000,
    keyPattern: { usuarioId: 1, nombreBanco: 1 },
  }, {}, response, () => {});

  assert.equal(estado, 409);
  assert.equal(cuerpo.message, "Ya existe un banco igual para este usuario.");
});
