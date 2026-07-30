import "dotenv/config";
import mongoose from "mongoose";
import Cuenta from "../v1/0.1-models/cuenta.model.js";
import Gasto from "../v1/0.1-models/gasto.model.js";
import Subcategoria from "../v1/0.1-models/subcategoria.model.js";
import { aplicarPoliticaImpactoEconomico } from "../v1/utils/politicaImpactoEconomico.js";

const aplicarCambios = process.argv.includes("--apply");

const mismoNumero = (izquierda, derecha) => (
  Number(izquierda || 0) === Number(derecha || 0)
);

await mongoose.connect(process.env.MONGO_URI);

try {
  const cuentas = await Cuenta.find({ tipoCuenta: { $ne: "credito" } })
    .select("_id");
  const cuentaIds = cuentas.map((cuenta) => cuenta._id);
  const [gastos, subcategorias] = await Promise.all([
    Gasto.find({ cuentaId: { $in: cuentaIds } }),
    Subcategoria.find({}).select("_id nombreSubcategoria"),
  ]);
  const nombresPorId = new Map(
    subcategorias.map((subcategoria) => [
      String(subcategoria._id),
      subcategoria.nombreSubcategoria,
    ]),
  );

  const operaciones = [];
  const ejemplosFuncionales = [];
  const ejemplosRedondeo = [];
  const totales = {
    revisados: gastos.length,
    modificados: 0,
    cambiosFuncionales: 0,
    soloRedondeo: 0,
    activados: 0,
    desactivados: 0,
    porcentajesCorregidos: 0,
    transferenciasNeutrales: 0,
    movimientosIncluidos: 0,
  };

  for (const gasto of gastos) {
    const nombreSubcategoria = nombresPorId.get(
      String(gasto.subcategoriaId || ""),
    );
    if (!nombreSubcategoria) continue;

    const anterior = gasto.toObject();
    const actualizado = aplicarPoliticaImpactoEconomico(
      anterior,
      nombreSubcategoria,
    );
    const cambiaIncluir =
      anterior.incluirMontoReal !== actualizado.incluirMontoReal;
    const cambiaPorcentaje =
      !mismoNumero(anterior.porcentaje, actualizado.porcentaje);
    const cambiaMontoReal =
      !mismoNumero(anterior.montoReal, actualizado.montoReal);
    const cambia = cambiaIncluir || cambiaPorcentaje || cambiaMontoReal;

    if (!cambia) continue;

    totales.modificados += 1;
    if (cambiaIncluir || cambiaPorcentaje) {
      totales.cambiosFuncionales += 1;
    } else {
      totales.soloRedondeo += 1;
    }
    if (cambiaIncluir && actualizado.incluirMontoReal) {
      totales.activados += 1;
    }
    if (cambiaIncluir && !actualizado.incluirMontoReal) {
      totales.desactivados += 1;
    }
    if (cambiaPorcentaje) {
      totales.porcentajesCorregidos += 1;
    }
    if (actualizado.incluirMontoReal) {
      totales.movimientosIncluidos += 1;
    } else {
      totales.transferenciasNeutrales += 1;
    }

    operaciones.push({
      updateOne: {
        filter: { _id: gasto._id },
        update: {
          $set: {
            incluirMontoReal: actualizado.incluirMontoReal,
            porcentaje: actualizado.porcentaje,
            montoReal: actualizado.montoReal,
          },
        },
      },
    });

    const ejemplo = {
      detalle: gasto.detalle,
      subcategoria: nombreSubcategoria,
      antes: {
        incluir: anterior.incluirMontoReal,
        porcentaje: anterior.porcentaje,
        montoReal: anterior.montoReal,
      },
      despues: {
        incluir: actualizado.incluirMontoReal,
        porcentaje: actualizado.porcentaje,
        montoReal: actualizado.montoReal,
      },
    };

    if (
      (cambiaIncluir || cambiaPorcentaje)
      && ejemplosFuncionales.length < 20
    ) {
      ejemplosFuncionales.push(ejemplo);
    } else if (
      !cambiaIncluir
      && !cambiaPorcentaje
      && ejemplosRedondeo.length < 5
    ) {
      ejemplosRedondeo.push({
        detalle: gasto.detalle,
        subcategoria: nombreSubcategoria,
        antes: anterior.montoReal,
        despues: actualizado.montoReal,
      });
    }
  }

  if (aplicarCambios && operaciones.length > 0) {
    await Gasto.bulkWrite(operaciones, { ordered: false });
  }

  console.log(JSON.stringify({
    modo: aplicarCambios ? "APLICADO" : "VISTA_PREVIA",
    ...totales,
    ejemplosFuncionales,
    ejemplosRedondeo,
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
