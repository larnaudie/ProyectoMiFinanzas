import assert from "node:assert/strict";
import test from "node:test";
import Gasto from "../v1/0.1-models/gasto.model.js";
import { obtenerGastosService } from "../v1/3-services/gasto.service.js";

const USUARIO_ID = "64a000000000000000000001";
const CUENTA_PRINCIPAL_ID = "64b000000000000000000001";
const CUENTA_PRESUPUESTO_ID = "64b000000000000000000002";

test("la vista de dashboard consulta solo las cuentas necesarias y usa una respuesta liviana", async (t) => {
  let consultaRecibida = null;
  let camposSeleccionados = "";
  const poblaciones = [];
  const documentos = [{
    _id: "64c000000000000000000001",
    detalle: "Movimiento de prueba",
    cuentaId: CUENTA_PRINCIPAL_ID,
  }];

  t.mock.method(Gasto, "find", (consulta) => {
    consultaRecibida = consulta;
    return {
      select(campos) {
        camposSeleccionados = campos;
        return this;
      },
      populate(path, campos) {
        poblaciones.push({ path, campos });
        return this;
      },
      async lean() {
        return documentos;
      },
    };
  });

  const resultado = await obtenerGastosService(USUARIO_ID, {
    vista: "dashboard",
    cuentaIds: [
      `${CUENTA_PRINCIPAL_ID},${CUENTA_PRESUPUESTO_ID}`,
      CUENTA_PRINCIPAL_ID,
    ],
  });

  assert.equal(consultaRecibida.usuarioId, USUARIO_ID);
  assert.deepEqual(consultaRecibida.cuentaId.$in, [
    CUENTA_PRINCIPAL_ID,
    CUENTA_PRESUPUESTO_ID,
  ]);
  assert.match(camposSeleccionados, /montoBancario/);
  assert.doesNotMatch(camposSeleccionados, /factura/);
  assert.deepEqual(poblaciones, [
    { path: "subcategoriaId", campos: "nombreSubcategoria" },
    { path: "categoriaId", campos: "nombreCategoria" },
    {
      path: "origen.referenciaId",
      campos: "_id tipoMovimiento origen.tipo",
    },
  ]);
  assert.strictEqual(resultado, documentos);
});

test("rechaza identificadores de cuenta inválidos en el filtro múltiple", async () => {
  await assert.rejects(
    obtenerGastosService(USUARIO_ID, {
      vista: "dashboard",
      cuentaIds: `${CUENTA_PRINCIPAL_ID},no-es-un-id`,
    }),
    (error) => error.status === 400 && /identificador inválido/i.test(error.message),
  );
});
