import { useId, useState } from "react";
import { formatearMontoMoneda } from "../utils/monedas.js";

export function RegistroSubcategorias({
  registros = [],
  mostrarCuentas = false,
}) {
  const [contraido, setContraido] = useState(false);
  const contenidoId = useId();

  return (
    <section
      id="dashboard-registro-subcategorias"
      className="monthly-comparison-card subcategory-expense-registry page-scroll-section"
    >
      <header className="monthly-comparison-header">
        <div>
          <h2>Registro de gastos por subcategoría</h2>
          <p>
            Agrupa únicamente salidas que impactan tu economía. Ingresos,
            transferencias internas y consumos de crédito informativos quedan
            fuera de este total.
          </p>
        </div>
        <button
          type="button"
          className="monthly-comparison-toggle"
          onClick={() => setContraido((actual) => !actual)}
          aria-expanded={!contraido}
          aria-controls={contenidoId}
          aria-label={contraido ? "Desplegar gastos por subcategoría" : "Contraer gastos por subcategoría"}
          title={contraido ? "Desplegar registro" : "Contraer registro"}
        >
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={contraido ? "is-collapsed" : ""}
          >
            <path d="M5.5 7.5 10 12l4.5-4.5" />
          </svg>
        </button>
      </header>

      <div
        id={contenidoId}
        className="subcategory-expense-registry-content"
        hidden={contraido}
      >
        {registros.length === 0 ? (
          <div className="subcategory-expense-empty">
            <strong>No hay gastos para agrupar en el período.</strong>
            <span>
              Los movimientos pendientes y los importes positivos no forman
              parte de este registro.
            </span>
          </div>
        ) : (
          registros.map((registro) => {
            const maximo = Math.max(
              1,
              ...registro.filas.map((fila) => fila.total),
            );

            return (
              <article className="subcategory-expense-currency" key={registro.moneda}>
                <header>
                  <div>
                    <span>Moneda</span>
                    <strong>{registro.moneda}</strong>
                  </div>
                  <div>
                    <span>{registro.cantidad} movimientos</span>
                    <strong>{formatearMontoMoneda(registro.total, registro.moneda)}</strong>
                  </div>
                </header>

                <div className="subcategory-expense-table-shell">
                  <table>
                    <thead>
                      <tr>
                        <th>Subcategoría</th>
                        <th>Categoría</th>
                        {mostrarCuentas && <th>Cuenta</th>}
                        <th>Movimientos</th>
                        <th>Gasto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registro.filas.map((fila) => (
                        <tr key={`${fila.categoria}-${fila.subcategoria}`}>
                          <td>
                            <strong>{fila.subcategoria}</strong>
                            <span className="subcategory-expense-bar" aria-hidden="true">
                              <i style={{ width: `${(fila.total / maximo) * 100}%` }} />
                            </span>
                          </td>
                          <td>{fila.categoria}</td>
                          {mostrarCuentas && <td>{fila.cuentas.join(", ")}</td>}
                          <td>{fila.cantidad}</td>
                          <td>
                            <strong>{formatearMontoMoneda(fila.total, fila.moneda)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })
        )}

        <p className="subcategory-expense-footnote">
          El pago de una tarjeta aparece en la cuenta bancaria que lo realizó.
          Para analizar qué compraste con crédito, usá el registro de consumos
          del dashboard de la tarjeta.
        </p>
      </div>
    </section>
  );
}
