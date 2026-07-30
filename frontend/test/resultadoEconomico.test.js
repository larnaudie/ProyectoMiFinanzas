import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularResultadoCuentaGasto,
  calcularResultadoEconomicoGasto,
} from "../src/utils/resultadoEconomico.js";

test("un ingreso real incluido aumenta el resultado económico", () => {
  assert.equal(calcularResultadoEconomicoGasto({
    montoReal: 4000,
    incluirMontoReal: true,
  }), 4000);
});

test("un gasto real incluido reduce el resultado económico", () => {
  assert.equal(calcularResultadoEconomicoGasto({
    montoBancario: 0,
    montoReal: -450,
    incluirMontoReal: true,
  }), -450);
});

test("una transferencia no incluida es neutral", () => {
  assert.equal(calcularResultadoEconomicoGasto({
    montoBancario: -4000,
    montoReal: 0,
    incluirMontoReal: false,
  }), 0);
});

test("una transferencia recibida aumenta el resultado individual", () => {
  assert.equal(calcularResultadoCuentaGasto({
    montoBancario: 4000,
    montoReal: 0,
    incluirMontoReal: false,
  }), 4000);
});

test("una transferencia enviada reduce el resultado individual", () => {
  assert.equal(calcularResultadoCuentaGasto({
    montoBancario: -2000,
    montoReal: 0,
    incluirMontoReal: false,
  }), -2000);
});

test("el resultado individual usa el monto real cuando está incluido", () => {
  assert.equal(calcularResultadoCuentaGasto({
    montoBancario: -1000,
    montoReal: -700,
    incluirMontoReal: true,
  }), -700);
});

test("el resultado individual contempla un gasto real sin banco", () => {
  assert.equal(calcularResultadoCuentaGasto({
    montoBancario: 0,
    montoReal: -450,
    incluirMontoReal: true,
  }), -450);
});

test("las dos puntas de una transferencia se compensan al sumar cuentas", () => {
  const transferenciaEnviada = calcularResultadoCuentaGasto({
    montoBancario: -4000,
    montoReal: 0,
    incluirMontoReal: false,
  });
  const transferenciaRecibida = calcularResultadoCuentaGasto({
    montoBancario: 4000,
    montoReal: 0,
    incluirMontoReal: false,
  });

  assert.equal(transferenciaEnviada + transferenciaRecibida, 0);
});

test("el dashboard general equivale a sumar resultados individuales", () => {
  const cuentaCorriente = [
    {
      montoBancario: 4000,
      montoReal: 4000,
      incluirMontoReal: true,
    },
    {
      montoBancario: -4000,
      montoReal: 0,
      incluirMontoReal: false,
    },
  ].reduce(
    (total, gasto) => total + calcularResultadoCuentaGasto(gasto),
    0,
  );
  const cajaAhorro = [
    {
      montoBancario: 4000,
      montoReal: 0,
      incluirMontoReal: false,
    },
    {
      montoBancario: -700,
      montoReal: -490,
      incluirMontoReal: true,
    },
  ].reduce(
    (total, gasto) => total + calcularResultadoCuentaGasto(gasto),
    0,
  );

  assert.equal(cuentaCorriente, 0);
  assert.equal(cajaAhorro, 3510);
  assert.equal(cuentaCorriente + cajaAhorro, 3510);
});
