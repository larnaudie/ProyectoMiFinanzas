import { formatearMontoMoneda } from "../utils/monedas.js";

const formatearFecha = (fecha) => (
  fecha
    ? new Date(fecha).toLocaleDateString("es-UY", { timeZone: "UTC" })
    : "Sin fecha"
);

export function PlanesCuotasTarjeta({ planes = [], compacto = false }) {
  if (planes.length === 0) return null;

  return (
    <section className={`credit-installment-plans${compacto ? " is-compact" : ""}`}>
      <header>
        <div>
          <h3>Planes de cuotas</h3>
          <p>
            Las cuotas restantes consumen límite, pero no generan monto real
            dentro de la tarjeta.
          </p>
        </div>
        <span>{planes.filter((plan) => plan.estado === "activo").length} activos</span>
      </header>
      <div className="credit-installment-table">
        <table>
          <thead>
            <tr>
              <th>Compra</th>
              <th>Fecha</th>
              <th>Cuota</th>
              <th>Monto cuota</th>
              <th>Restantes</th>
              <th>Comprometido</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {planes.map((plan) => (
              <tr key={plan.planKey}>
                <td title={plan.detalleBase}>{plan.detalleBase}</td>
                <td>{formatearFecha(plan.fechaCompra)}</td>
                <td>{plan.cuotaActual}/{plan.cuotasTotales}</td>
                <td>{formatearMontoMoneda(plan.montoCuota, plan.moneda)}</td>
                <td>{plan.cuotasRestantes}</td>
                <td>{formatearMontoMoneda(plan.montoFuturo, plan.moneda)}</td>
                <td>
                  <span className={`credit-installment-status is-${plan.estado}`}>
                    {plan.estado === "activo" ? "Activo" : "Finalizado"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
