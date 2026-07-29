import assert from "node:assert/strict";
import test from "node:test";
import {
  crearErrorNombreUsuarioInvalido,
  limpiarNombreUsuario,
  normalizarNombreUsuario,
} from "../v1/utils/usuario.js";

test("normaliza el nombre de usuario para comparar mayúsculas y espacios", () => {
  assert.equal(limpiarNombreUsuario("  Pablo   Usuario  "), "Pablo Usuario");
  assert.equal(normalizarNombreUsuario("  PABLO   Usuario  "), "pablo usuario");
});

test("el conflicto de nombre usa un mensaje neutral", () => {
  const error = crearErrorNombreUsuarioInvalido();

  assert.equal(error.status, 400);
  assert.equal(error.message, "Nombre de usuario inválido. Intentá con otro.");
  assert.equal(error.message.toLowerCase().includes("existe"), false);
});
