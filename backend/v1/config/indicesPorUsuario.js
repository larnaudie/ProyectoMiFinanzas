import mongoose from "mongoose";
import Banco from "../0.1-models/banco.model.js";
import Categoria from "../0.1-models/categoria.model.js";
import Cuenta from "../0.1-models/cuenta.model.js";
import DeudaCobrar from "../0.1-models/deudaCobrar.model.js";
import Gasto from "../0.1-models/gasto.model.js";
import MovimientoImportado from "../0.1-models/movimientoImportado.model.js";
import SaldoCuenta from "../0.1-models/saldoCuenta.model.js";
import Subcategoria from "../0.1-models/subcategoria.model.js";

const VERSION_INDICES = "2026-09-03-deudas-cobrar-v2";
const ID_MIGRACION_INDICES = "indices-aplicacion";

const configuraciones = [
  { modelo: Banco, indicesLegados: ["nombreBanco_1"] },
  { modelo: Cuenta, indicesLegados: ["nombreCuenta_1"] },
  { modelo: DeudaCobrar, indicesLegados: [] },
  { modelo: Gasto, indicesLegados: [] },
  { modelo: Categoria, indicesLegados: ["nombreCategoria_1"] },
  { modelo: Subcategoria, indicesLegados: ["nombreSubcategoria_1"] },
  { modelo: MovimientoImportado, indicesLegados: ["hashBanco_1"] },
  { modelo: SaldoCuenta, indicesLegados: [] },
];

export const migrarIndicesUnicosPorUsuario = async () => {
  const migraciones = mongoose.connection.collection("migracionesTecnicas");
  const migracionActual = await migraciones.findOne({
    _id: ID_MIGRACION_INDICES,
    version: VERSION_INDICES,
  });
  if (migracionActual) return;

  for (const { modelo, indicesLegados } of configuraciones) {
    // Primero crea el índice compuesto. Así nunca queda una ventana sin la
    // protección de duplicados dentro del mismo usuario.
    await modelo.createIndexes();

    const existentes = await modelo.collection.indexes();
    const nombresExistentes = new Set(existentes.map((indice) => indice.name));

    for (const indice of indicesLegados) {
      if (nombresExistentes.has(indice)) {
        await modelo.collection.dropIndex(indice);
      }
    }
  }

  await migraciones.updateOne(
    { _id: ID_MIGRACION_INDICES },
    {
      $set: {
        version: VERSION_INDICES,
        actualizadoEn: new Date(),
      },
    },
    { upsert: true },
  );
};

export default migrarIndicesUnicosPorUsuario;
