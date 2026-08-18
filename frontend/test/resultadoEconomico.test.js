import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularResultadoCuentaGasto,
  calcularResultadoEconomicoGasto,
  calcularResultadoTarjetaGasto,
  esPagoTarjeta,
  obtenerMontoQuePuedeSumarAlPresupuesto,
  puedeSumarAlPresupuesto,
  resumirPresupuestoYGastoReal,
} from "../src/utils/resultadoEconomico.js";

test("el impacto económico conserva sólo el monto real incluido", () => {
  assert.equal(calcularResultadoEconomicoGasto({
    montoReal: -450,
    incluirMontoReal: true,
  }), -450);
  assert.equal(calcularResultadoEconomicoGasto({
    montoReal: -450,
    incluirMontoReal: false,
  }), 0);
});

test("sólo un movimiento positivo puede sumar al presupuesto", () => {
  assert.equal(puedeSumarAlPresupuesto({ montoBancario: 40000 }), true);
  assert.equal(puedeSumarAlPresupuesto({ montoBancario: -40000 }), false);
  assert.equal(puedeSumarAlPresupuesto({ montoBancario: 0, montoReal: 10000 }), true);
  assert.equal(obtenerMontoQuePuedeSumarAlPresupuesto({
    montoBancario: 10000,
    montoReal: 7000,
  }), 10000);
});

test("una transferencia positiva marcada aumenta el presupuesto", () => {
  assert.equal(calcularResultadoCuentaGasto({
    montoBancario: 40000,
    montoReal: 0,
    incluirMontoReal: false,
    sumaAlPresupuesto: true,
  }), 40000);
});

test("una transferencia de emergencia no marcada es neutral", () => {
  assert.equal(calcularResultadoCuentaGasto({
    montoBancario: 6000,
    montoReal: 0,
    incluirMontoReal: false,
    sumaAlPresupuesto: false,
  }), 0);
});

test("un egreso usa el monto real incluido", () => {
  assert.equal(calcularResultadoCuentaGasto({
    montoBancario: -1000,
    montoReal: -700,
    incluirMontoReal: true,
    sumaAlPresupuesto: false,
  }), -700);
});

test("el escenario presupuesto, exceso e ingreso extra termina con ahorro 4000", () => {
  const movimientos = [
    { montoBancario: 40000, sumaAlPresupuesto: true },
    { montoBancario: -46000, montoReal: -46000, incluirMontoReal: true },
    { montoBancario: 6000, sumaAlPresupuesto: false },
    { montoBancario: 10000, montoReal: 10000, incluirMontoReal: true, sumaAlPresupuesto: true },
  ];
  const resultado = movimientos.reduce(
    (total, gasto) => total + calcularResultadoCuentaGasto(gasto),
    0,
  );

  assert.equal(resultado, 4000);
});

test("resume presupuesto, gasto real y déficit del mes sin usar ingresos no marcados", () => {
  const resumen = resumirPresupuestoYGastoReal([
    { montoBancario: 25000, sumaAlPresupuesto: true },
    { montoBancario: 25000, sumaAlPresupuesto: true },
    { montoBancario: 40000, sumaAlPresupuesto: true },
    { montoBancario: 39400, sumaAlPresupuesto: true },
    { montoBancario: 10658.29, sumaAlPresupuesto: false },
    { montoReal: -135055.69, incluirMontoReal: true },
  ]);

  assert.deepEqual(resumen, {
    presupuesto: 129400,
    gastoReal: 135055.69,
    resultado: -5655.69,
  });
});

test("aplica la misma regla a cualquier cuenta, mes y moneda", () => {
  const escenarios = [
    {
      contexto: { cuentaId: "cuenta-uyu", mes: "2026-01", moneda: "UYU" },
      gastos: [
        { montoBancario: 40000, sumaAlPresupuesto: true },
        { montoReal: -35000, incluirMontoReal: true },
      ],
      esperado: { presupuesto: 40000, gastoReal: 35000, resultado: 5000 },
    },
    {
      contexto: { cuentaId: "cuenta-usd", mes: "2026-07", moneda: "USD" },
      gastos: [
        { montoBancario: 1500, sumaAlPresupuesto: true },
        { montoReal: -1750, incluirMontoReal: true },
      ],
      esperado: { presupuesto: 1500, gastoReal: 1750, resultado: -250 },
    },
    {
      contexto: { cuentaId: "cuenta-ui", mes: "2027-03", moneda: "UI" },
      gastos: [
        { montoReal: 1200, sumaAlPresupuesto: true },
        { montoReal: -200, incluirMontoReal: true },
      ],
      esperado: { presupuesto: 1200, gastoReal: 200, resultado: 1000 },
    },
  ];

  escenarios.forEach(({ contexto, gastos, esperado }) => {
    assert.deepEqual(
      resumirPresupuestoYGastoReal(gastos),
      esperado,
      `falló el escenario ${contexto.cuentaId}/${contexto.mes}/${contexto.moneda}`,
    );
  });
});

test("los movimientos de tarjeta no generan ahorro directo", () => {
  const pago = {
    tipoMovimiento: "pago",
    montoBancario: 5000,
    origen: { tipo: "tarjeta" },
  };

  assert.equal(esPagoTarjeta(pago), true);
  assert.equal(calcularResultadoTarjetaGasto(pago), 0);
});
