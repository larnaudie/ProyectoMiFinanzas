import fs from "node:fs";
import XLSX from "xlsx";
import { parsearExcelTarjeta } from "../v1/utils/excelParsers.js";

const files = process.argv.slice(2);

for (const file of files) {
  const buffer = fs.readFileSync(file);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const parsed = parsearExcelTarjeta(buffer);
  console.log(JSON.stringify({
    kind: "parsed",
    file,
    sheetNames: workbook.SheetNames,
    resumen: parsed.resumen,
    movimientos: parsed.movimientos.map((item) => ({
      fila: item.fila,
      fecha: item.fecha.toISOString().slice(0, 10),
      detalle: item.detalle,
      importePesos: item.importePesos,
      importeDolares: item.importeDolares,
      montoEstadoCuenta: item.montoEstadoCuenta,
      montoBancario: item.montoBancario,
      moneda: item.moneda,
      tipo: item.tipo,
    })),
  }));

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const ref = worksheet["!ref"];
    const cells = [];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let row = range.s.r; row <= range.e.r; row += 1) {
        for (let col = range.s.c; col <= range.e.c; col += 1) {
          const address = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[address];
          if (!cell || cell.v === undefined || cell.v === null || cell.v === "") continue;
          cells.push({ address, value: cell.v, formatted: cell.w ?? null });
        }
      }
    }
    console.log(JSON.stringify({ kind: "sheet", file, sheetName, ref, cells }));
  }
}
