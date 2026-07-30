import {
  calcularMontoRealGasto,
  esMontoDistintoDeCero,
  esPorcentajeGastoValido,
} from "./montosGasto.js";

const normalizarNombre = (valor) => String(valor || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

export const esSubcategoriaTransferencia = (nombreSubcategoria) => (
  /^transf(?:\.|\s|$)/.test(normalizarNombre(nombreSubcategoria))
);

export const aplicarPoliticaImpactoEconomico = (
  gasto,
  nombreSubcategoria,
) => {
  const normalizado = { ...gasto };

  if (!nombreSubcategoria) {
    return normalizado;
  }

  if (esSubcategoriaTransferencia(nombreSubcategoria)) {
    return {
      ...normalizado,
      incluirMontoReal: false,
      porcentaje: 0,
      montoReal: 0,
    };
  }

  normalizado.incluirMontoReal = true;

  if (
    esMontoDistintoDeCero(normalizado.montoBancario)
    && (
      !esPorcentajeGastoValido(normalizado.porcentaje)
      || Number(normalizado.porcentaje) === 0
    )
  ) {
    normalizado.porcentaje = 100;
  }

  normalizado.montoReal = calcularMontoRealGasto(normalizado);
  return normalizado;
};
