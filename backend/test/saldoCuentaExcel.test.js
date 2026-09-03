import test from "node:test";
import assert from "node:assert/strict";
import { actualizarSaldoCuentaDesdeExcel } from "../v1/3-services/importacionExcel.service.js";

const crearCuenta = (datos = {}) => {
  let guardados = 0;
  const cuenta = {
    tipoCuenta: "debito",
    moneda: "UYU",
    saldoActual: null,
    saldoActualizadoEn: null,
    saldoInformadoAl: null,
    saldoOrigen: null,
    saldoArchivoNombre: null,
    ...datos,
    async save() {
      guardados += 1;
    },
  };

  return { cuenta, guardados: () => guardados };
};

test("el Excel actualiza automaticamente el saldo de la cuenta", async () => {
  const estado = crearCuenta();

  const resultado = await actualizarSaldoCuentaDesdeExcel({
    cuenta: estado.cuenta,
    saldoDetectado: {
      monto: 9832.26,
      moneda: "UYU",
      fecha: new Date("2026-08-31T00:00:00.000Z"),
    },
    archivoNombre: "estado-agosto.xlsx",
  });

  assert.equal(resultado.actualizado, true);
  assert.equal(estado.cuenta.saldoActual, 9832.26);
  assert.equal(estado.cuenta.saldoOrigen, "excel");
  assert.equal(estado.cuenta.saldoArchivoNombre, "estado-agosto.xlsx");
  assert.equal(estado.guardados(), 1);
});

test("un nuevo Excel reemplaza un ajuste manual previo", async () => {
  const estado = crearCuenta({
    saldoActual: 100,
    saldoOrigen: "manual",
    saldoInformadoAl: new Date("2026-09-02T12:00:00.000Z"),
  });

  const resultado = await actualizarSaldoCuentaDesdeExcel({
    cuenta: estado.cuenta,
    saldoDetectado: {
      monto: 900,
      moneda: "UYU",
      fecha: new Date("2026-08-31T00:00:00.000Z"),
    },
    archivoNombre: "estado-agosto.xlsx",
  });

  assert.equal(resultado.actualizado, true);
  assert.equal(estado.cuenta.saldoActual, 900);
  assert.equal(estado.cuenta.saldoOrigen, "excel");
  assert.equal(estado.guardados(), 1);
});

test("importar un Excel bancario antiguo no pisa otro saldo Excel mas reciente", async () => {
  const estado = crearCuenta({
    saldoActual: 900,
    saldoOrigen: "excel",
    saldoInformadoAl: new Date("2026-08-31T00:00:00.000Z"),
  });

  const resultado = await actualizarSaldoCuentaDesdeExcel({
    cuenta: estado.cuenta,
    saldoDetectado: {
      monto: 750,
      moneda: "UYU",
      fecha: new Date("2026-07-31T00:00:00.000Z"),
    },
    archivoNombre: "estado-julio.xlsx",
  });

  assert.equal(resultado.actualizado, false);
  assert.equal(resultado.motivo, "saldo_mas_antiguo");
  assert.equal(estado.cuenta.saldoActual, 900);
  assert.equal(estado.guardados(), 0);
});
