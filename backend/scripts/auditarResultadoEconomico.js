import "dotenv/config";
import mongoose from "mongoose";
import Cuenta from "../v1/0.1-models/cuenta.model.js";
import Gasto from "../v1/0.1-models/gasto.model.js";

const redondear = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;

await mongoose.connect(process.env.MONGO_URI);

try {
  const cuentas = await Cuenta.find({})
    .select("_id nombreCuenta moneda tipoCuenta")
    .lean();
  const cuentasPorId = new Map(
    cuentas.map((cuenta) => [String(cuenta._id), cuenta]),
  );
  const gastos = await Gasto.find({
    estado: "creado",
  })
    .select("cuentaId fecha montoBancario montoReal incluirMontoReal")
    .lean();

  const resultadoPorCuenta = {};
  const resultadoPorMoneda = {};

  for (const gasto of gastos) {
    const cuenta = cuentasPorId.get(String(gasto.cuentaId));
    if (!cuenta || cuenta.tipoCuenta === "credito") continue;

    const fecha = new Date(gasto.fecha);
    if (Number.isNaN(fecha.getTime())) continue;

    const mes = [
      fecha.getUTCFullYear(),
      String(fecha.getUTCMonth() + 1).padStart(2, "0"),
    ].join("-");
    const moneda = cuenta.moneda || "UYU";
    const claveCuenta = `${cuenta.nombreCuenta} [${moneda}]`;
    const montoBancario = Number(gasto.montoBancario) || 0;
    const montoReal = Number(gasto.montoReal) || 0;
    const resultadoEconomico = gasto.incluirMontoReal ? montoReal : 0;
    const resultadoCuenta = gasto.incluirMontoReal
      ? montoReal
      : montoBancario;

    resultadoPorCuenta[claveCuenta] ??= {
      resultadoEconomico: 0,
      resultadoCuenta: 0,
      transferenciasNetas: 0,
      meses: {},
    };
    resultadoPorCuenta[claveCuenta].meses[mes] ??= {
      resultadoEconomico: 0,
      resultadoCuenta: 0,
      transferenciasNetas: 0,
    };
    resultadoPorCuenta[claveCuenta].resultadoEconomico +=
      resultadoEconomico;
    resultadoPorCuenta[claveCuenta].resultadoCuenta += resultadoCuenta;
    resultadoPorCuenta[claveCuenta].meses[mes].resultadoEconomico +=
      resultadoEconomico;
    resultadoPorCuenta[claveCuenta].meses[mes].resultadoCuenta +=
      resultadoCuenta;
    if (!gasto.incluirMontoReal) {
      resultadoPorCuenta[claveCuenta].transferenciasNetas += montoBancario;
      resultadoPorCuenta[claveCuenta].meses[mes].transferenciasNetas +=
        montoBancario;
    }
    resultadoPorMoneda[moneda] ??= {
      resultadoEconomico: 0,
      resultadoCuentas: 0,
    };
    resultadoPorMoneda[moneda].resultadoEconomico += resultadoEconomico;
    resultadoPorMoneda[moneda].resultadoCuentas += resultadoCuenta;
  }

  for (const resultado of Object.values(resultadoPorCuenta)) {
    resultado.resultadoEconomico = redondear(resultado.resultadoEconomico);
    resultado.resultadoCuenta = redondear(resultado.resultadoCuenta);
    resultado.transferenciasNetas = redondear(resultado.transferenciasNetas);
    for (const mes of Object.keys(resultado.meses)) {
      const resultadoMes = resultado.meses[mes];
      resultadoMes.resultadoEconomico = redondear(
        resultadoMes.resultadoEconomico,
      );
      resultadoMes.resultadoCuenta = redondear(
        resultadoMes.resultadoCuenta,
      );
      resultadoMes.transferenciasNetas = redondear(
        resultadoMes.transferenciasNetas,
      );
    }
  }
  for (const moneda of Object.keys(resultadoPorMoneda)) {
    resultadoPorMoneda[moneda].resultadoEconomico = redondear(
      resultadoPorMoneda[moneda].resultadoEconomico,
    );
    resultadoPorMoneda[moneda].resultadoCuentas = redondear(
      resultadoPorMoneda[moneda].resultadoCuentas,
    );
  }

  console.log(JSON.stringify({
    reglas: {
      resultadoEconomico:
        "Monto real incluido; transferencias neutrales",
      resultadoCuenta:
        "Monto real incluido + monto bancario de transferencias",
    },
    resultadoPorMoneda,
    resultadoPorCuenta,
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
