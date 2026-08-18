import assert from "node:assert/strict";
import test from "node:test";
import { resumirValoresMonetarios } from "../src/utils/montosGasto.js";

test("separa ingresos, egresos y resultado neto", () => {
  assert.deepEqual(
    resumirValoresMonetarios([140058.29, -139219.99]),
    {
      ingresos: 140058.29,
      egresos: 139219.99,
      neto: 838.3,
    },
  );
});

test("ignora valores monetarios no numericos", () => {
  assert.deepEqual(
    resumirValoresMonetarios(["", null, undefined, "invalido", -10]),
    {
      ingresos: 0,
      egresos: 10,
      neto: -10,
    },
  );
});
