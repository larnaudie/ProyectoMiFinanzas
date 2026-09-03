import Banco from "../0.1-models/banco.model.js";
import Categoria from "../0.1-models/categoria.model.js";
import Cuenta from "../0.1-models/cuenta.model.js";
import Gasto from "../0.1-models/gasto.model.js";
import MovimientoImportado from "../0.1-models/movimientoImportado.model.js";
import SaldoCuenta from "../0.1-models/saldoCuenta.model.js";
import Subcategoria from "../0.1-models/subcategoria.model.js";

const configuraciones = [
  { modelo: Banco, indicesLegados: ["nombreBanco_1"] },
  { modelo: Cuenta, indicesLegados: ["nombreCuenta_1"] },
  { modelo: Gasto, indicesLegados: [] },
  { modelo: Categoria, indicesLegados: ["nombreCategoria_1"] },
  { modelo: Subcategoria, indicesLegados: ["nombreSubcategoria_1"] },
  { modelo: MovimientoImportado, indicesLegados: ["hashBanco_1"] },
  { modelo: SaldoCuenta, indicesLegados: [] },
];

export const migrarIndicesUnicosPorUsuario = async () => {
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
};

export default migrarIndicesUnicosPorUsuario;
