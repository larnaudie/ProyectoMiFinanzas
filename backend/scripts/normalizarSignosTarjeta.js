import "dotenv/config";
import mongoose from "mongoose";
import Gasto from "../v1/0.1-models/gasto.model.js";

const filtro = {
  "origen.tipo": "tarjeta",
  resumenTarjetaId: { $ne: null },
  hashImportacion: { $type: "string" },
};
const soloLectura = process.argv.includes("--dry-run");

try {
  if (!process.env.MONGO_URI) {
    throw new Error("Falta MONGO_URI para ejecutar la normalización");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const encontrados = await Gasto.countDocuments(filtro);
  const inconsistentes = await Gasto.countDocuments({
    ...filtro,
    $or: [
      { tipoMovimiento: "pago", montoBancario: { $lt: 0 } },
      { tipoMovimiento: { $ne: "pago" }, montoBancario: { $gt: 0 } },
    ],
  });

  if (soloLectura) {
    console.log(JSON.stringify({ soloLectura, encontrados, inconsistentes }));
  } else {
    const resultado = await Gasto.collection.updateMany(filtro, [
      {
        $set: {
          montoBancario: {
            $cond: [
              { $eq: ["$tipoMovimiento", "pago"] },
              { $abs: { $ifNull: ["$montoBancario", 0] } },
              { $multiply: [-1, { $abs: { $ifNull: ["$montoBancario", 0] } }] },
            ],
          },
        },
      },
      {
        $set: {
          montoReal: {
            $cond: [
              { $eq: ["$incluirMontoReal", true] },
              {
                $multiply: [
                  "$montoBancario",
                  { $divide: [{ $ifNull: ["$porcentaje", 0] }, 100] },
                ],
              },
              0,
            ],
          },
        },
      },
    ]);

    console.log(JSON.stringify({
      soloLectura,
      encontrados,
      inconsistentes,
      coincidentes: resultado.matchedCount,
      modificados: resultado.modifiedCount,
    }));
  }
} finally {
  await mongoose.disconnect();
}
