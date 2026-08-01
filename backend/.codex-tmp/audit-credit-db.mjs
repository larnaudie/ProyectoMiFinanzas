import "dotenv/config";
import mongoose from "mongoose";
import ResumenTarjeta from "../v1/0.1-models/resumenTarjeta.model.js";
import Gasto from "../v1/0.1-models/gasto.model.js";
import { calcularTotalesResumen } from "../v1/utils/resumenTarjetaTotales.js";

const cuentaId = process.argv[2];
if (!cuentaId) throw new Error("Falta cuentaId");
if (!process.env.MONGO_URI) throw new Error("Falta MONGO_URI");

await mongoose.connect(process.env.MONGO_URI);

const resumenes = await ResumenTarjeta.find({ cuentaId })
  .sort({ cierre: 1 })
  .lean();

for (const resumen of resumenes) {
  const mes = resumen.cierre?.toISOString().slice(0, 7);
  if (!["2026-06", "2026-07"].includes(mes)) continue;
  const gastos = await Gasto.find({ resumenTarjetaId: resumen._id })
    .sort({ fecha: 1, _id: 1 })
    .lean();
  console.log(JSON.stringify({
    resumen: {
      id: String(resumen._id),
      periodo: resumen.periodo,
      cierre: resumen.cierre,
      archivoNombre: resumen.archivoNombre,
      limiteCredito: resumen.limiteCredito,
      saldoAnterior: resumen.saldoAnterior,
      saldoFinal: resumen.saldoFinal,
      pagoContado: resumen.pagoContado,
      cantidadMovimientos: resumen.cantidadMovimientos,
    },
    totales: calcularTotalesResumen(resumen, gastos, ["UYU", "USD"]),
    gastos: gastos.map((gasto) => ({
      fecha: gasto.fecha?.toISOString().slice(0, 10),
      detalle: gasto.detalle,
      moneda: gasto.moneda,
      tipo: gasto.tipoMovimiento,
      estado: gasto.estado,
      montoOriginalTarjeta: gasto.montoOriginalTarjeta,
      montoBancario: gasto.montoBancario,
    })),
  }));
}

await mongoose.disconnect();
