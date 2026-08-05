import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularCuotaFrancesa,
  calcularResumenPrestamo,
  gastoCoincideConPrestamo,
  tasaMensualDesdeTea,
} from "../v1/utils/prestamos.js";

test("calcula Mi Auto con TEA efectiva y sistema francés", () => {
  const cuota = calcularCuotaFrancesa({
    capital: 93091.43,
    tea: 6.3,
    plazoCuotas: 72,
  });
  assert.equal(cuota, 1548.296596);
  assert.ok(Math.abs(tasaMensualDesdeTea(6.3) * 100 - 0.510424) < 0.000001);

  const resumen = calcularResumenPrestamo({
    capitalFinanciado: 93091.43,
    tea: 6.3,
    plazoCuotas: 72,
    cuotaTeorica: cuota,
    pagos: [{ gastoId: "1" }],
  });
  assert.equal(resumen.cuotasPagadas, 1);
  assert.equal(resumen.cuotasRestantes, 71);
  assert.ok(resumen.capitalPendiente < 93091.43);
  assert.ok(Math.abs(resumen.totalFinanciado - 111477.3549) < 0.01);
});

test("detecta una cuota sólo cuando coincide cuenta, subcategoría y referencia", () => {
  const prestamo = {
    reglaDeteccion: {
      cuentaId: "cuenta-uyu",
      subcategoriaId: "auto-cuotas",
      textos: ["PAGO MI AUTO"],
      referencia: "52681977",
      desde: "2026-07-01",
    },
  };
  const gasto = {
    estado: "creado",
    cuentaId: "cuenta-uyu",
    subcategoriaId: "auto-cuotas",
    fecha: "2026-07-06",
    detalle: "SERVICIO PAC DEBITO PAGO MI AUTO UYU /REF: 52681977",
  };

  assert.equal(gastoCoincideConPrestamo(gasto, prestamo), true);
  assert.equal(
    gastoCoincideConPrestamo({ ...gasto, detalle: "OTRO PRESTAMO 52681977" }, prestamo),
    false,
  );
  assert.equal(
    gastoCoincideConPrestamo({ ...gasto, subcategoriaId: "otra" }, prestamo),
    false,
  );
});

