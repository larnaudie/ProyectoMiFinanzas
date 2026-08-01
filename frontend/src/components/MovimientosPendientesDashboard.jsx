import { useState } from "react";
import { Link } from "react-router-dom";
import {
  formatearMontoMoneda,
  obtenerMonedaMovimiento,
} from "../utils/monedas.js";

const obtenerId = (valor) => {
  if (!valor) return "";
  return typeof valor === "object" ? valor._id || valor.id || "" : valor;
};

const formatearFecha = (fecha) => (
  fecha
    ? new Date(fecha).toLocaleDateString("es-UY", { timeZone: "UTC" })
    : "Sin fecha"
);

export function MovimientosPendientesDashboard({
  movimientos = [],
  cuentas = [],
  mostrarCuenta = false,
}) {
  const [contraido, setContraido] = useState(false);
  const cuentasPorId = new Map(
    cuentas.map((cuenta) => [obtenerId(cuenta._id), cuenta]),
  );

  return (
    <section
      id="dashboard-movimientos-pendientes"
      className="monthly-comparison-card dashboard-pending-list page-scroll-section"
    >
      <header className="monthly-comparison-header">
        <div>
          <h2>Movimientos pendientes</h2>
          <p>
            Son los movimientos del período que todavía necesitan revisión o
            completar información antes de quedar creados.
          </p>
        </div>
        <div className="dashboard-pending-header-actions">
          <span>{movimientos.length} pendientes</span>
          <button
            type="button"
            className="monthly-comparison-toggle"
            onClick={() => setContraido((actual) => !actual)}
            aria-expanded={!contraido}
            aria-controls="dashboard-movimientos-pendientes-contenido"
            aria-label={contraido ? "Desplegar movimientos pendientes" : "Contraer movimientos pendientes"}
            title={contraido ? "Desplegar pendientes" : "Contraer pendientes"}
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className={contraido ? "is-collapsed" : ""}
            >
              <path d="M5.5 7.5 10 12l4.5-4.5" />
            </svg>
          </button>
        </div>
      </header>

      <div
        id="dashboard-movimientos-pendientes-contenido"
        className="dashboard-pending-content"
        hidden={contraido}
      >
        {movimientos.length === 0 ? (
          <div className="subcategory-expense-empty">
            <strong>No hay movimientos pendientes en este período.</strong>
            <span>La lista se actualiza automáticamente con los filtros del dashboard.</span>
          </div>
        ) : (
          <div className="dashboard-pending-table-shell">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Detalle</th>
                  {mostrarCuenta && <th>Cuenta</th>}
                  <th>Moneda</th>
                  <th>Bancario</th>
                  <th>Real</th>
                  <th>Subcategoría</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((movimiento) => {
                  const cuentaId = obtenerId(movimiento.cuentaId);
                  const cuenta = cuentasPorId.get(cuentaId);
                  const moneda = obtenerMonedaMovimiento(cuenta, movimiento.moneda);

                  return (
                    <tr key={movimiento._id}>
                      <td>{formatearFecha(movimiento.fecha)}</td>
                      <td title={movimiento.detalle}>{movimiento.detalle || "Sin detalle"}</td>
                      {mostrarCuenta && <td>{cuenta?.nombreCuenta || "Cuenta"}</td>}
                      <td>{moneda}</td>
                      <td>{formatearMontoMoneda(movimiento.montoBancario, moneda)}</td>
                      <td>{formatearMontoMoneda(movimiento.montoReal, moneda)}</td>
                      <td>
                        {movimiento.subcategoriaId?.nombreSubcategoria
                          || "Sin subcategoría"}
                      </td>
                      <td>
                        <Link
                          className="secondary-link dashboard-pending-open-link"
                          to={`/cuentas/${cuentaId}/gastos/gasto/${movimiento._id}`}
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
