import "dotenv/config";
import mongoose from "mongoose";
import Gasto from "../v1/0.1-models/gasto.model.js";
import Cuenta from "../v1/0.1-models/cuenta.model.js";

const aplicarCambios = process.argv.includes("--apply");

if (!process.env.MONGO_URI) {
  throw new Error("Falta MONGO_URI para ejecutar la normalización");
}

await mongoose.connect(process.env.MONGO_URI);

try {
  const cuentasCredito = await Cuenta.find({ tipoCuenta: "credito" })
    .select("_id");
  const cuentaIds = cuentasCredito.map((cuenta) => cuenta._id);
  const filtro = {
    $or: [
      { cuentaId: { $in: cuentaIds } },
      { resumenTarjetaId: { $ne: null } },
      { "origen.tipo": "tarjeta" },
    ],
  };
  const inconsistentes = await Gasto.countDocuments({
    $and: [
      filtro,
      {
        $or: [
          { montoReal: { $ne: 0 } },
          { porcentaje: { $ne: 0 } },
          { incluirMontoReal: { $ne: false } },
        ],
      },
    ],
  });

  let resultado = null;
  if (aplicarCambios && inconsistentes > 0) {
    resultado = await Gasto.updateMany(filtro, {
      $set: {
        montoReal: 0,
        porcentaje: 0,
        incluirMontoReal: false,
      },
    });
  }

  console.log(JSON.stringify({
    modo: aplicarCambios ? "APLICADO" : "VISTA_PREVIA",
    cuentasCredito: cuentaIds.length,
    inconsistentes,
    coincidentes: resultado?.matchedCount || 0,
    modificados: resultado?.modifiedCount || 0,
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
