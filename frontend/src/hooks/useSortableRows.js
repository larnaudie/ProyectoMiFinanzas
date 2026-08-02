import { useMemo, useState } from "react";

const estaVacio = (valor) =>
  valor === "" || valor === null || valor === undefined;

const compararValores = (valorA, valorB, tipo) => {
  if (tipo === "number") return Number(valorA) - Number(valorB);
  if (tipo === "date") {
    return new Date(valorA).getTime() - new Date(valorB).getTime();
  }

  return String(valorA).localeCompare(String(valorB), "es", {
    numeric: true,
    sensitivity: "base",
  });
};

export const useSortableRows = (rows, columns) => {
  const [sortConfig, setSortConfig] = useState(null);

  const sortedRows = useMemo(() => {
    if (!sortConfig || !columns[sortConfig.key]) return rows;

    const column = columns[sortConfig.key];
    const getValue = column.getValue
      || ((row) => row[column.field || sortConfig.key]);
    const direction = sortConfig.direction === "ascending" ? 1 : -1;

    return rows
      .map((row, index) => ({ row, index }))
      .sort((itemA, itemB) => {
        const valorA = getValue(itemA.row);
        const valorB = getValue(itemB.row);
        const vacioA = estaVacio(valorA);
        const vacioB = estaVacio(valorB);

        if (vacioA && vacioB) return itemA.index - itemB.index;
        if (vacioA) return 1;
        if (vacioB) return -1;

        const comparacion = compararValores(valorA, valorB, column.type);
        return comparacion === 0
          ? itemA.index - itemB.index
          : comparacion * direction;
      })
      .map(({ row }) => row);
  }, [columns, rows, sortConfig]);

  const requestSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current?.key === key && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  };

  return { sortedRows, sortConfig, requestSort };
};
